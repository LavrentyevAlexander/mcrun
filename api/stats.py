from datetime import datetime
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import psycopg2.extras

from _db import get_conn, send_json


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

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
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
                        SELECT g.name,
                               g.total_km,
                               g.limit_km,
                               COALESCE(
                                   SUM(a.distance_km) FILTER (WHERE a.date >= %s), 0
                               ) AS period_km
                        FROM gear g
                        LEFT JOIN activities a ON a.gear_id = g.id
                        GROUP BY g.id
                        """,
                        (after_date,),
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
                        "gear": r["gear_name"] or "",
                    }
                )

            gear_summary = {
                g["name"]: {
                    "km": round(float(g["period_km"]), 2),
                    "total_km": round(float(g["total_km"] or 0), 2),
                    "limit_km": g["limit_km"],
                }
                for g in gear_rows
            }

            send_json(self, 200, {"activities": activities, "gear_summary": gear_summary})

        except Exception as e:
            send_json(self, 500, {"error": str(e)})
