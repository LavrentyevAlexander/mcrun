import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

import json
from http.server import BaseHTTPRequestHandler

import psycopg2.extras

from _db import get_conn, send_json, verify_token


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            verify_token(self.headers)

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "SELECT id, competition, location, date::text, distance, time, rank, link "
                        "FROM competitions ORDER BY date ASC"
                    )
                    rows = cur.fetchall()

            send_json(self, 200, [dict(r) for r in rows])

        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
        except Exception as e:
            send_json(self, 500, {"error": str(e)})

    def do_POST(self):
        try:
            verify_token(self.headers)

            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))

            competition = payload["competition"]
            date = payload["date"]
            distance = payload["distance"]
            location = payload.get("location") or None
            time = payload.get("time") or None
            rank = payload.get("rank") or None
            link = payload.get("link") or None

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "INSERT INTO competitions (competition, location, date, distance, time, rank, link) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id, competition, location, date::text, distance, time, rank, link",
                        (competition, location, date, distance, time, rank, link),
                    )
                    row = dict(cur.fetchone())
                conn.commit()

            send_json(self, 201, row)

        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
        except KeyError as e:
            send_json(self, 400, {"error": f"Missing field: {e}"})
        except Exception as e:
            send_json(self, 500, {"error": str(e)})

    def do_PATCH(self):
        try:
            verify_token(self.headers)

            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))

            record_id = payload["id"]
            competition = payload["competition"]
            date = payload["date"]
            distance = payload["distance"]
            location = payload.get("location") or None
            time = payload.get("time") or None
            rank = payload.get("rank") or None
            link = payload.get("link") or None

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "UPDATE competitions SET competition=%s, location=%s, date=%s, distance=%s, time=%s, rank=%s, link=%s "
                        "WHERE id=%s RETURNING id, competition, location, date::text, distance, time, rank, link",
                        (competition, location, date, distance, time, rank, link, record_id),
                    )
                    row = cur.fetchone()
                    if not row:
                        raise KeyError("Record not found")
                    row = dict(row)
                conn.commit()

            send_json(self, 200, row)

        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
        except KeyError as e:
            send_json(self, 404, {"error": str(e)})
        except Exception as e:
            send_json(self, 500, {"error": str(e)})
