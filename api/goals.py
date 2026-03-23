import os
import sys
import json
sys.path.insert(0, os.path.dirname(__file__))

from http.server import BaseHTTPRequestHandler

import psycopg2.extras

from _db import get_conn, send_json, verify_token


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute("""
                        SELECT id, year, description, achieved, result, sort_order
                        FROM goals
                        ORDER BY year DESC, sort_order ASC, id ASC
                    """)
                    rows = cur.fetchall()
            send_json(self, 200, [dict(r) for r in rows])
        except Exception as e:
            send_json(self, 500, {"error": str(e)})

    def do_POST(self):
        try:
            verify_token(self.headers)
        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            year = int(body["year"])
            description = body["description"].strip()
            achieved = bool(body.get("achieved", False))
            result = body.get("result") or None
            sort_order = int(body.get("sort_order", 0))
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute("""
                        INSERT INTO goals (year, description, achieved, result, sort_order)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id, year, description, achieved, result, sort_order
                    """, (year, description, achieved, result, sort_order))
                    row = cur.fetchone()
                conn.commit()
            send_json(self, 200, dict(row))
        except Exception as e:
            send_json(self, 500, {"error": str(e)})

    def do_PATCH(self):
        try:
            verify_token(self.headers)
        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            goal_id = int(body["id"])
            fields, values = [], []
            for field in ("year", "description", "achieved", "result", "sort_order"):
                if field in body:
                    fields.append(f"{field} = %s")
                    values.append(body[field] if body[field] != "" else None if field == "result" else body[field])
            if not fields:
                send_json(self, 400, {"error": "nothing to update"})
                return
            values.append(goal_id)
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        f"UPDATE goals SET {', '.join(fields)} WHERE id = %s "
                        "RETURNING id, year, description, achieved, result, sort_order",
                        values,
                    )
                    row = cur.fetchone()
                conn.commit()
            if not row:
                send_json(self, 404, {"error": "not found"})
                return
            send_json(self, 200, dict(row))
        except Exception as e:
            send_json(self, 500, {"error": str(e)})
