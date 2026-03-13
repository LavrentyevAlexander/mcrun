import os
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

            send_json(self, 200, {"synced": len(records)})

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
