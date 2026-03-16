import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

import garminconnect

from _db import get_conn, send_json, verify_token

GARMIN_EMAIL = os.environ.get("GARMIN_EMAIL")
GARMIN_PASSWORD = os.environ.get("GARMIN_PASSWORD")
GARMIN_TOTP_SECRET = os.environ.get("GARMIN_TOTP_SECRET")

TYPE_ID_MAP = {
    1: ("1 km", 1000),
    2: ("1 mile", 1609),
    3: ("5 km", 5000),
    4: ("10 km", 10000),
    5: ("Half marathon", 21097),
    6: ("Marathon", 42195),
}


def get_garmin_client():
    client = garminconnect.Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
    if GARMIN_TOTP_SECRET:
        import pyotp
        client.login(prompt_mfa=lambda: pyotp.TOTP(GARMIN_TOTP_SECRET).now())
    else:
        client.login()
    return client


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        started_at = datetime.now(timezone.utc)
        try:
            verify_token(self.headers)

            client = get_garmin_client()
            prs = client.get_personal_record()

            records = []
            for pr in prs:
                if pr.get("activityType") != "running":
                    continue
                type_info = TYPE_ID_MAP.get(pr.get("typeId"))
                if not type_info:
                    continue
                label, distance_m = type_info
                duration_sec = pr.get("value")
                if not duration_sec:
                    continue
                date_raw = pr.get("actStartDateTimeInGMTFormatted") or ""
                records.append(
                    (
                        label,
                        distance_m,
                        round(duration_sec),
                        date_raw[:10] or None,
                        pr.get("activityId"),
                        pr.get("activityName") or "",
                    )
                )

            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("TRUNCATE TABLE personal_records")
                    for label, distance_m, time_sec, date, garmin_id, activity_name in records:
                        cur.execute(
                            """
                            INSERT INTO personal_records
                                (label, distance_m, time_sec, date, garmin_activity_id, activity_name, synced_at)
                            VALUES (%s, %s, %s, %s, %s, %s, NOW())
                            """,
                            (label, distance_m, time_sec, date, garmin_id, activity_name),
                        )
                    cur.execute(
                        """
                        INSERT INTO sync_log (source, status, records_synced, started_at, finished_at)
                        VALUES ('garmin', 'success', %s, %s, NOW())
                        """,
                        (len(records), started_at),
                    )
                conn.commit()

            # ── Fitness metrics ──────────────────────────────────────────
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

            # Keep raw responses for debug output
            raw_max_metrics = raw_training_status = raw_hrv = None

            def _num(val):
                """Return val as float/int if scalar, else None."""
                if val is None:
                    return None
                if isinstance(val, (int, float)):
                    return val
                if isinstance(val, str):
                    try:
                        return float(val)
                    except ValueError:
                        return None
                return None

            def _str(val):
                """Return val as str if scalar, else None."""
                if val is None:
                    return None
                if isinstance(val, str):
                    return val
                if isinstance(val, (int, float, bool)):
                    return str(val)
                return None

            vo2_max = fitness_age = None
            try:
                raw_max_metrics = client.get_max_metrics(today)
                entry = raw_max_metrics[0] if isinstance(raw_max_metrics, list) and raw_max_metrics else (raw_max_metrics if isinstance(raw_max_metrics, dict) else {})
                g = entry.get("generic") or {}
                vo2_max = _num(g.get("vo2MaxValue"))
                fitness_age = _num(g.get("fitnessAge"))
            except Exception:
                pass

            training_status = training_load = acute_load = None
            try:
                raw_training_status = client.get_training_status(today)
                ts = raw_training_status
                if isinstance(ts, list) and ts:
                    ts = ts[0]
                if isinstance(ts, dict):
                    training_status = _str(
                        ts.get("trainingStatus")
                        or ts.get("mostRecentTrainingStatus")
                    )
                    training_load = _num(ts.get("trainingLoad7Day") or ts.get("trainingLoad"))
                    acute_load = _num(ts.get("acuteLoad"))
            except Exception:
                pass

            hrv_last_night = hrv_weekly_avg = hrv_status = None
            try:
                raw_hrv = client.get_hrv_data(today)
                hrv = raw_hrv
                if isinstance(hrv, dict):
                    hrv_last_night = _num(hrv.get("lastNightAvg"))
                    hrv_weekly_avg = _num(hrv.get("weeklyAvg"))
                    hrv_status = _str(hrv.get("status"))
            except Exception:
                pass

            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO garmin_metrics
                            (id, vo2_max, fitness_age, training_status,
                             training_load, acute_load,
                             hrv_last_night, hrv_weekly_avg, hrv_status, synced_at)
                        VALUES (1, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        ON CONFLICT (id) DO UPDATE SET
                            vo2_max         = EXCLUDED.vo2_max,
                            fitness_age     = EXCLUDED.fitness_age,
                            training_status = EXCLUDED.training_status,
                            training_load   = EXCLUDED.training_load,
                            acute_load      = EXCLUDED.acute_load,
                            hrv_last_night  = EXCLUDED.hrv_last_night,
                            hrv_weekly_avg  = EXCLUDED.hrv_weekly_avg,
                            hrv_status      = EXCLUDED.hrv_status,
                            synced_at       = EXCLUDED.synced_at
                        """,
                        (vo2_max, fitness_age, training_status,
                         training_load, acute_load,
                         hrv_last_night, hrv_weekly_avg, hrv_status),
                    )
                conn.commit()

            send_json(self, 200, {
                "synced": len(records),
                "metrics_debug": {
                    "max_metrics": raw_max_metrics,
                    "training_status": raw_training_status,
                    "hrv": raw_hrv,
                },
            })

        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
        except Exception as e:
            try:
                with get_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO sync_log (source, status, error_detail, started_at, finished_at)
                            VALUES ('garmin', 'error', %s, %s, NOW())
                            """,
                            (str(e), started_at),
                        )
                    conn.commit()
            except Exception:
                pass
            send_json(self, 500, {"error": str(e)})
