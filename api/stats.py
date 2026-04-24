import csv
import hashlib
import io
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import psycopg2.extras

from _db import get_conn, send_json, verify_token


def format_pace(moving_sec, distance_km):
    if not distance_km or not moving_sec:
        return None
    pace_sec = moving_sec / distance_km
    return f"{int(pace_sec // 60)}:{int(pace_sec % 60):02d}"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            after_date = query.get("after_date", [None])[0]
            if after_date is None:
                after_date = f"{datetime.now().year}-01-01"
            fmt = query.get("format", [None])[0]

            # CSV export requires auth
            if fmt == "csv":
                try:
                    verify_token(self.headers)
                except PermissionError as e:
                    return send_json(self, 401, {"error": str(e)})

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # Compute ETag from the latest synced_at timestamp so the
                    # response is considered fresh until the next sync.
                    cur.execute("SELECT MAX(synced_at) FROM activities")
                    latest_synced = cur.fetchone()["max"]
                    etag = '"' + hashlib.md5(f"{after_date}:{latest_synced}".encode()).hexdigest() + '"'
                    if self.headers.get("If-None-Match") == etag:
                        self.send_response(304)
                        self.send_header("ETag", etag)
                        self.end_headers()
                        return

                    cur.execute(
                        """
                        SELECT a.strava_id,
                               a.date::text,
                               a.name,
                               a.distance_km,
                               a.moving_sec,
                               a.elapsed_sec,
                               a.avg_hr,
                               a.elevation_m,
                               a.relative_effort,
                               a.fitness_score,
                               a.fitness_delta,
                               g.name AS gear_name
                        FROM activities a
                        LEFT JOIN gear g ON g.id = a.gear_id
                        WHERE a.date >= %s
                        ORDER BY a.date DESC
                        """,
                        (after_date,),
                    )
                    act_rows = cur.fetchall()

                    cur.execute(
                        """
                        SELECT id, name, total_km, limit_km, image_url
                        FROM gear
                        ORDER BY total_km DESC
                        """
                    )
                    gear_rows = cur.fetchall()

            activities = []
            for r in act_rows:
                dist = float(r["distance_km"])
                # Use moving_sec for both display time and pace (matches original behavior)
                time_sec = r["moving_sec"] or r["elapsed_sec"]
                activities.append(
                    {
                        "date": r["date"],
                        "name": r["name"],
                        "strava_id": r["strava_id"],
                        "km": round(dist, 2),
                        "elapsed_sec": time_sec,
                        "avg_pace": format_pace(time_sec, dist),
                        "avg_hr": r["avg_hr"],
                        "elevation": float(r["elevation_m"]) if r["elevation_m"] is not None else None,
                        "relative_effort": r["relative_effort"],
                        "fitness_score": round(r["fitness_score"]) if r["fitness_score"] is not None else None,
                        "fitness_delta": round(r["fitness_delta"]) if r["fitness_delta"] is not None else None,
                        "gear": r["gear_name"] or "",
                    }
                )

            gear_summary = {
                g["name"]: {
                    "id": g["id"],
                    "total_km": round(float(g["total_km"] or 0), 2),
                    "limit_km": g["limit_km"],
                    "image_url": g["image_url"],
                }
                for g in gear_rows
            }

            if fmt == "csv":
                buf = io.StringIO()
                writer = csv.writer(buf)
                writer.writerow([
                    "date", "name", "strava_id", "distance_km", "moving_sec",
                    "elapsed_sec", "avg_hr", "elevation_m", "relative_effort",
                    "fitness_score", "gear",
                ])
                for a in activities:
                    writer.writerow([
                        a["date"], a["name"], a["strava_id"], a["km"],
                        a["elapsed_sec"], a["elapsed_sec"],
                        a["avg_hr"] or "", a["elevation"] or "",
                        a["relative_effort"] or "", a["fitness_score"] or "",
                        a["gear"],
                    ])
                body = buf.getvalue().encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header("Content-Disposition", 'attachment; filename="activities.csv"')
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            send_json(self, 200, {"activities": activities, "gear_summary": gear_summary},
                      extra_headers={"ETag": etag, "Cache-Control": "private, no-cache"})

        except Exception as e:
            send_json(self, 500, {"error": str(e)})
