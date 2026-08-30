import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from http.server import BaseHTTPRequestHandler

import psycopg2.extras

from _db import get_conn, send_error, send_json, verify_token


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            try:
                verify_token(self.headers)
            except PermissionError as e:
                return send_json(self, 401, {"error": str(e)})

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT vo2_max, fitness_age, training_status,
                               training_load, acute_load,
                               hrv_last_night, hrv_weekly_avg, hrv_status,
                               training_readiness, readiness_level, readiness_feedback,
                               sleep_score, recovery_time, acwr_feedback,
                               resting_hr, resting_hr_7day,
                               race_5k, race_10k, race_hm, race_marathon,
                               sleep_score_feedback, recovery_time_feedback, vo2_max_label,
                               lt_hr, lt_pace, endurance_score, endurance_label,
                               avg_stress, heat_acclim_level,
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
                "training_readiness": row["training_readiness"],
                "readiness_level": row["readiness_level"],
                "readiness_feedback": row["readiness_feedback"],
                "sleep_score": row["sleep_score"],
                "recovery_time": row["recovery_time"],
                "acwr_feedback": row["acwr_feedback"],
                "resting_hr": row["resting_hr"],
                "resting_hr_7day": row["resting_hr_7day"],
                "race_5k": row["race_5k"],
                "race_10k": row["race_10k"],
                "race_hm": row["race_hm"],
                "race_marathon": row["race_marathon"],
                "sleep_score_feedback": row["sleep_score_feedback"],
                "recovery_time_feedback": row["recovery_time_feedback"],
                "vo2_max_label": row["vo2_max_label"],
                "lt_hr": row["lt_hr"],
                "lt_pace": row["lt_pace"],
                "endurance_score": row["endurance_score"],
                "endurance_label": row["endurance_label"],
                "avg_stress": row["avg_stress"],
                "heat_acclim_level": row["heat_acclim_level"],
                "synced_at": row["synced_at"],
            })

        except Exception as e:
            send_error(self, e)
