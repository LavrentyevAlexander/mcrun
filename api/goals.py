import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from http.server import BaseHTTPRequestHandler

import psycopg2.extras

from _db import BadRequest, get_conn, read_json_body, send_error, send_json, validate, verify_token

VALID_STATUSES = {"in_progress", "achieved", "failed"}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute("""
                        SELECT id, year, description, status, result, sort_order
                        FROM goals
                        ORDER BY year DESC, sort_order ASC, id ASC
                    """)
                    rows = cur.fetchall()
            send_json(self, 200, [dict(r) for r in rows])
        except Exception as e:
            send_error(self, e)

    def do_POST(self):
        try:
            verify_token(self.headers)
        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
            return
        try:
            body = read_json_body(self)

            errs = validate(body, {
                "year": {"required": True, "type": (int, float), "min": 2000},
                "description": {"required": True, "type": str, "min_len": 1},
            })
            if errs:
                send_json(self, 400, {"error": "; ".join(errs)})
                return

            year = int(body["year"])
            description = body["description"].strip()
            status = body.get("status", "in_progress")
            if status not in VALID_STATUSES:
                status = "in_progress"
            result = body.get("result") or None
            sort_order = int(body.get("sort_order", 0))
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute("""
                        INSERT INTO goals (year, description, status, result, sort_order)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id, year, description, status, result, sort_order
                    """, (year, description, status, result, sort_order))
                    row = cur.fetchone()
                conn.commit()
            send_json(self, 200, dict(row))
        except BadRequest as e:
            send_json(self, 400, {"error": str(e)})
        except Exception as e:
            send_error(self, e)

    def do_PATCH(self):
        try:
            verify_token(self.headers)
        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
            return
        try:
            body = read_json_body(self)
            try:
                goal_id = int(body["id"])
            except (KeyError, TypeError, ValueError):
                raise BadRequest("'id' is required and must be an integer")
            fields, values = [], []
            for field in ("year", "description", "status", "result", "sort_order"):
                if field not in body:
                    continue
                if field == "status":
                    val = body[field] if body[field] in VALID_STATUSES else "in_progress"
                elif field == "result":
                    val = body[field] or None
                else:
                    val = body[field]
                fields.append(f"{field} = %s")
                values.append(val)
            if not fields:
                send_json(self, 400, {"error": "nothing to update"})
                return
            values.append(goal_id)
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        f"UPDATE goals SET {', '.join(fields)} WHERE id = %s "
                        "RETURNING id, year, description, status, result, sort_order",
                        values,
                    )
                    row = cur.fetchone()
                conn.commit()
            if not row:
                send_json(self, 404, {"error": "not found"})
                return
            send_json(self, 200, dict(row))
        except BadRequest as e:
            send_json(self, 400, {"error": str(e)})
        except Exception as e:
            send_error(self, e)
