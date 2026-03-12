import json
import os
from http.server import BaseHTTPRequestHandler

import psycopg2
import psycopg2.extras
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

POSTGRES_URL = os.environ.get("mcrun_db_POSTGRES_URL_NON_POOLING") or os.environ.get("mcrun_db_POSTGRES_URL")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
ALLOWED_EMAIL = os.environ.get("ALLOWED_EMAIL")


def get_conn():
    if not POSTGRES_URL:
        raise RuntimeError("POSTGRES_URL is not set")
    return psycopg2.connect(POSTGRES_URL)


def verify_token(headers):
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise PermissionError("Unauthorized")
    token = auth[7:]
    idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
    if ALLOWED_EMAIL and idinfo.get("email") != ALLOWED_EMAIL:
        raise PermissionError("Forbidden")


def send_json(handler, status, data):
    body = json.dumps(data).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            verify_token(self.headers)

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "SELECT id, competition, date::text, distance, time, rank, link "
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
            time = payload.get("time") or None
            rank = payload.get("rank") or None
            link = payload.get("link") or None

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "INSERT INTO competitions (competition, date, distance, time, rank, link) "
                        "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id, competition, date::text, distance, time, rank, link",
                        (competition, date, distance, time, rank, link),
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
            time = payload.get("time") or None
            rank = payload.get("rank") or None
            link = payload.get("link") or None

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "UPDATE competitions SET competition=%s, date=%s, distance=%s, time=%s, rank=%s, link=%s "
                        "WHERE id=%s RETURNING id, competition, date::text, distance, time, rank, link",
                        (competition, date, distance, time, rank, link, record_id),
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
