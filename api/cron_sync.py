import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from http.server import BaseHTTPRequestHandler

from _db import send_json

CRON_SECRET = os.environ.get("CRON_SECRET")


def verify_cron(headers):
    auth = headers.get("Authorization", "")
    if not CRON_SECRET or auth != f"Bearer {CRON_SECRET}":
        raise PermissionError("Unauthorized")


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            verify_cron(self.headers)
        except PermissionError as e:
            return send_json(self, 401, {"error": str(e)})

        results = {}

        try:
            from sync_strava import sync_strava
            results["strava"] = sync_strava()
        except Exception as e:
            results["strava"] = {"error": str(e)}

        try:
            from sync_garmin import sync_garmin
            results["garmin"] = sync_garmin()
        except Exception as e:
            results["garmin"] = {"error": str(e)}

        send_json(self, 200, results)
