import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from http.server import BaseHTTPRequestHandler

import psycopg2.extras

from _db import get_conn, send_json


def format_seconds(total_sec):
    total_sec = round(total_sec)
    h = total_sec // 3600
    m = (total_sec % 3600) // 60
    s = total_sec % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def format_pace(distance_m, total_sec):
    if not distance_m or not total_sec:
        return "—"
    pace_sec = total_sec / (distance_m / 1000)
    return f"{int(pace_sec // 60)}:{int(pace_sec % 60):02d}"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT label, distance_m, time_sec, date::text,
                               garmin_activity_id, activity_name
                        FROM personal_records
                        ORDER BY distance_m ASC
                        """
                    )
                    rows = cur.fetchall()

            results = [
                {
                    "label": r["label"],
                    "distance_m": r["distance_m"],
                    "time": format_seconds(r["time_sec"]),
                    "pace": format_pace(r["distance_m"], r["time_sec"]),
                    "date": r["date"] or "—",
                    "activity_id": r["garmin_activity_id"] or 0,
                    "activity_name": r["activity_name"] or "",
                }
                for r in rows
            ]

            send_json(self, 200, results)

        except Exception as e:
            send_json(self, 500, {"error": str(e)})
