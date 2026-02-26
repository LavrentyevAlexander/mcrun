import json
import os
from collections import defaultdict
from datetime import datetime
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import requests

CLIENT_ID = os.environ.get("CLIENT_ID")
CLIENT_SECRET = os.environ.get("CLIENT_SECRET")
REFRESH_TOKEN = os.environ.get("REFRESH_TOKEN")


def get_access_token():
    response = requests.post(
        "https://www.strava.com/oauth/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": REFRESH_TOKEN,
        },
    )
    response.raise_for_status()
    return response.json()["access_token"]


def get_activities(access_token, after_date=None):
    headers = {"Authorization": f"Bearer {access_token}"}
    after_timestamp = (
        0
        if after_date is None
        else int(datetime.strptime(after_date, "%Y-%m-%d").timestamp())
    )

    activities = []
    page = 1

    while True:
        response = requests.get(
            "https://www.strava.com/api/v3/athlete/activities",
            headers=headers,
            params={"after": after_timestamp, "per_page": 100, "page": page},
        )
        response.raise_for_status()
        data = response.json()
        if not data:
            break
        activities.extend(data)
        page += 1

    return activities


GEAR_LIMITS_PATH = os.path.join(os.path.dirname(__file__), "gear_limits.json")
try:
    with open(GEAR_LIMITS_PATH) as _f:
        GEAR_LIMITS = json.load(_f)
except (FileNotFoundError, json.JSONDecodeError):
    GEAR_LIMITS = {}


def get_gear_info(access_token, gear_id):
    """Returns (name, total_km_alltime)"""
    resp = requests.get(
        f"https://www.strava.com/api/v3/gear/{gear_id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if resp.status_code == 200:
        data = resp.json()
        return data.get("name", gear_id), data.get("distance", 0) / 1000
    return gear_id, 0


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            after_date = query.get("after_date", [None])[0]

            if after_date is None:
                year = datetime.now().year
                after_date = f"{year}-01-01"

            token = get_access_token()
            activities = get_activities(token, after_date=after_date)

            gear_names = {}       # gear_id -> name
            gear_total_km = {}    # gear_id -> all-time km from Strava
            gear_km = defaultdict(float)  # gear_name -> km in selected period
            rows = []

            for act in activities:
                gear_id = act.get("gear_id")
                if gear_id and gear_id not in gear_names:
                    name, total_km = get_gear_info(token, gear_id)
                    gear_names[gear_id] = name
                    gear_total_km[gear_id] = total_km

                # Count all activities with shoes for gear summary (skip bikes: id starts with "b")
                if gear_id and not gear_id.startswith("b"):
                    gear_name = gear_names.get(gear_id, gear_id)
                    gear_km[gear_name] += act["distance"] / 1000

                # Only include runs in the table
                if act.get("type") != "Run" or not gear_id:
                    continue

                distance_km = act["distance"] / 1000
                duration_min = act["moving_time"] // 60

                rows.append(
                    {
                        "date": act["start_date_local"][:10],
                        "name": act["name"],
                        "km": round(distance_km, 2),
                        "min": duration_min,
                        "gear": gear_names.get(gear_id, gear_id),
                    }
                )

            name_to_gid = {name: gid for gid, name in gear_names.items()}
            gear_summary = {
                name: {
                    "km": round(km, 2),
                    "total_km": round(gear_total_km.get(name_to_gid.get(name), 0), 2),
                    "limit_km": GEAR_LIMITS.get(name),
                }
                for name, km in gear_km.items()
            }

            body = json.dumps({"activities": rows, "gear_summary": gear_summary})
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
