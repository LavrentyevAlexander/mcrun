import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from datetime import datetime, date
import calendar

import psycopg2.extras

from _db import get_conn, send_json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            now = datetime.now()
            year = int(query.get("year", [now.year])[0])
            month = int(query.get("month", [now.month])[0])
            _, last_day = calendar.monthrange(year, month)
            start = date(year, month, 1).isoformat()
            end = date(year, month, last_day).isoformat()

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT garmin_id::text AS id,
                               date::text,
                               name,
                               activity_type,
                               distance_km,
                               duration_sec,
                               calories,
                               aerobic_te,
                               anaerobic_te
                        FROM garmin_activities
                        WHERE date >= %s AND date <= %s
                        ORDER BY date ASC, garmin_id ASC
                        """,
                        (start, end),
                    )
                    rows = cur.fetchall()

            result = []
            for r in rows:
                result.append({
                    "id": str(r["id"]),
                    "date": r["date"],
                    "name": r["name"] or "",
                    "activity_type": r["activity_type"] or "",
                    "distance_km": float(r["distance_km"]) if r["distance_km"] is not None else 0.0,
                    "duration_sec": r["duration_sec"] or 0,
                    "calories": r["calories"],
                    "aerobic_te": float(r["aerobic_te"]) if r["aerobic_te"] is not None else None,
                    "anaerobic_te": float(r["anaerobic_te"]) if r["anaerobic_te"] is not None else None,
                })
            send_json(self, 200, result)

        except Exception as e:
            send_json(self, 500, {"error": str(e)})
