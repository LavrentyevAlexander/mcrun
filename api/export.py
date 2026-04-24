import csv
import io
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import psycopg2.extras

from _db import get_conn, send_json, verify_token


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            verify_token(self.headers)

            query = parse_qs(urlparse(self.path).query)
            after_date = (query.get("after_date", [None])[0] or "1970-01-01")

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT a.date::text,
                               a.name,
                               a.strava_id,
                               a.distance_km,
                               a.moving_sec,
                               a.elapsed_sec,
                               a.avg_hr,
                               a.elevation_m,
                               a.relative_effort,
                               a.fitness_score,
                               g.name AS gear
                        FROM activities a
                        LEFT JOIN gear g ON g.id = a.gear_id
                        WHERE a.date >= %s
                        ORDER BY a.date DESC
                        """,
                        (after_date,),
                    )
                    rows = cur.fetchall()

            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow([
                "date", "name", "strava_id", "distance_km", "moving_sec",
                "elapsed_sec", "avg_hr", "elevation_m", "relative_effort",
                "fitness_score", "gear",
            ])
            for r in rows:
                writer.writerow([
                    r["date"], r["name"], r["strava_id"],
                    round(float(r["distance_km"]), 3) if r["distance_km"] else "",
                    r["moving_sec"] or "", r["elapsed_sec"] or "",
                    r["avg_hr"] or "", r["elevation_m"] or "",
                    r["relative_effort"] or "", r["fitness_score"] or "",
                    r["gear"] or "",
                ])

            body = buf.getvalue().encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", "attachment; filename=\"activities.csv\"")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
        except Exception as e:
            send_json(self, 500, {"error": str(e)})
