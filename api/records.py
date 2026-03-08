import json
import os
from http.server import BaseHTTPRequestHandler

import garminconnect

GARMIN_EMAIL = os.environ.get("GARMIN_EMAIL")
GARMIN_PASSWORD = os.environ.get("GARMIN_PASSWORD")
GARMIN_TOTP_SECRET = os.environ.get("GARMIN_TOTP_SECRET")

DISTANCE_LABELS = {
    400: "400 m",
    804: "1/2 mile",
    1000: "1 km",
    1609: "1 mile",
    3219: "2 miles",
    5000: "5 km",
    10000: "10 km",
    15000: "15 km",
    16093: "10 miles",
    20000: "20 km",
    21097: "Half marathon",
    30000: "30 km",
    42195: "Marathon",
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
    total_sec = int(total_sec)
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


def closest_label(distance_m):
    if not distance_m:
        return None
    best = min(DISTANCE_LABELS.keys(), key=lambda d: abs(d - distance_m))
    if abs(best - distance_m) / best < 0.05:
        return DISTANCE_LABELS[best], best
    return None


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            client = get_garmin_client()
            prs = client.get_personal_record()

            results = []
            for pr in prs:
                if pr.get("activityType") != "running":
                    continue

                distance_m = pr.get("value")
                match = closest_label(distance_m)
                if not match:
                    continue
                label, canonical_m = match

                duration_sec = pr.get("duration")
                date_raw = pr.get("startTimeLocal") or pr.get("startTimeGMT") or ""
                date = date_raw[:10] if date_raw else "—"
                activity_id = pr.get("activityId") or 0

                results.append({
                    "label": label,
                    "distance_m": canonical_m,
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
