import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from http.server import BaseHTTPRequestHandler

import psycopg2.extras

from _db import get_conn, send_json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT vo2_max, fitness_age, training_status,
                               training_load, acute_load,
                               hrv_last_night, hrv_weekly_avg, hrv_status,
                               synced_at::text
                        FROM garmin_metrics
                        WHERE id = 1
                        """
                    )
                    row = cur.fetchone()

            if not row:
                return send_json(self, 200, None)

            send_json(self, 200, {
                "vo2_max": float(row["vo2_max"]) if row["vo2_max"] is not None else None,
                "fitness_age": row["fitness_age"],
                "training_status": row["training_status"],
                "training_load": float(row["training_load"]) if row["training_load"] is not None else None,
                "acute_load": float(row["acute_load"]) if row["acute_load"] is not None else None,
                "hrv_last_night": row["hrv_last_night"],
                "hrv_weekly_avg": row["hrv_weekly_avg"],
                "hrv_status": row["hrv_status"],
                "synced_at": row["synced_at"],
            })

        except Exception as e:
            send_json(self, 500, {"error": str(e)})
