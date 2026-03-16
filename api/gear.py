import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

import json
from http.server import BaseHTTPRequestHandler

import psycopg2.extras

from _db import get_conn, send_json, verify_token


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            verify_token(self.headers)

            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))

            name = (payload.get("name") or "").strip()
            limit_km = payload.get("limit_km") or None
            image_url = (payload.get("image_url") or "").strip() or None

            if not name:
                return send_json(self, 400, {"error": "name is required"})

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "INSERT INTO gear (name, limit_km, image_url, total_km) "
                        "VALUES (%s, %s, %s, 0) "
                        "RETURNING id, name, total_km, limit_km, image_url",
                        (name, limit_km, image_url),
                    )
                    row = dict(cur.fetchone())
                conn.commit()

            send_json(self, 201, {
                "id": row["id"],
                "name": row["name"],
                "total_km": float(row["total_km"] or 0),
                "limit_km": row["limit_km"],
                "image_url": row["image_url"],
            })

        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
        except Exception as e:
            send_json(self, 500, {"error": str(e)})

    def do_PATCH(self):
        try:
            verify_token(self.headers)

            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))

            gear_id = payload.get("id")
            if not gear_id:
                return send_json(self, 400, {"error": "id is required"})

            name = (payload.get("name") or "").strip() or None
            limit_km = payload.get("limit_km") or None
            image_url = (payload.get("image_url") or "").strip() or None

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "UPDATE gear SET "
                        "  name      = COALESCE(%s, name), "
                        "  limit_km  = %s, "
                        "  image_url = %s "
                        "WHERE id = %s "
                        "RETURNING id, name, total_km, limit_km, image_url",
                        (name, limit_km, image_url, gear_id),
                    )
                    row = cur.fetchone()
                    if not row:
                        raise KeyError("Gear not found")
                    row = dict(row)
                conn.commit()

            send_json(self, 200, {
                "id": row["id"],
                "name": row["name"],
                "total_km": float(row["total_km"] or 0),
                "limit_km": row["limit_km"],
                "image_url": row["image_url"],
            })

        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
        except KeyError as e:
            send_json(self, 404, {"error": str(e)})
        except Exception as e:
            send_json(self, 500, {"error": str(e)})