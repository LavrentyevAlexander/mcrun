import json
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import garminconnect

GARMIN_EMAIL = os.environ.get("GARMIN_EMAIL")
GARMIN_PASSWORD = os.environ.get("GARMIN_PASSWORD")
GARMIN_TOTP_SECRET = os.environ.get("GARMIN_TOTP_SECRET")

# typeId → (label, distance_m)
TYPE_ID_MAP = {
    1: ("1 km", 1000),
    2: ("1 mile", 1609),
    3: ("5 km", 5000),
    4: ("10 km", 10000),
    5: ("Half marathon", 21097),
    6: ("Marathon", 42195),
}


def get_garmin_client():
    def totp_callback():
        import pyotp
        return pyotp.TOTP(GARMIN_TOTP_SECRET).now()

    client = garminconnect.Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
    if GARMIN_TOTP_SECRET:
        client.login(prompt_mfa=totp_callback)
    else:
        client.login()
    return client


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
    pace_sec_per_km = total_sec / (distance_m / 1000)
    m = int(pace_sec_per_km // 60)
    s = int(pace_sec_per_km % 60)
    return f"{m}:{s:02d}"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            debug = query.get("debug", ["0"])[0] == "1"

            client = get_garmin_client()
            prs = client.get_personal_record()

            if debug:
                body = json.dumps(prs)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(body.encode())
                return

            results = []
            for pr in prs:
                if pr.get("activityType") != "running":
                    continue

                type_info = TYPE_ID_MAP.get(pr.get("typeId"))
                if not type_info:
                    continue

                label, distance_m = type_info
                duration_sec = pr.get("value")
                date_raw = pr.get("actStartDateTimeInGMTFormatted") or ""
                date = date_raw[:10] if date_raw else "—"
                activity_id = pr.get("activityId") or 0

                results.append({
                    "label": label,
                    "distance_m": distance_m,
                    "time": format_seconds(duration_sec) if duration_sec else "—",
                    "pace": format_pace(distance_m, duration_sec),
                    "date": date,
                    "activity_id": activity_id,
                })

            results.sort(key=lambda r: r["distance_m"])

            body = json.dumps(results)
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
