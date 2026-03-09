import json
import os
from http.server import BaseHTTPRequestHandler

import psycopg2
import psycopg2.extras

POSTGRES_URL = os.environ.get("POSTGRES_URL")


def get_conn():
    return psycopg2.connect(POSTGRES_URL, sslmode="require")


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "SELECT id, competition, date::text, distance, time, rank, link "
                        "FROM competitions ORDER BY date ASC"
                    )
                    rows = cur.fetchall()

            body = json.dumps([dict(r) for r in rows])
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body.encode())

        except Exception as e:
            body = json.dumps({"error": str(e)})
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body.encode())

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))

            competition = payload["competition"]
            date = payload["date"]
            distance = payload["distance"]
            time = payload["time"]
            rank = payload["rank"]
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

            body = json.dumps(row)
            self.send_response(201)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body.encode())

        except KeyError as e:
            body = json.dumps({"error": f"Missing field: {e}"})
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body.encode())

        except Exception as e:
            body = json.dumps({"error": str(e)})
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body.encode())
