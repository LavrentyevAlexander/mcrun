import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from http.server import BaseHTTPRequestHandler

import requests

from _db import send_json

SSO_URL = "https://sso.garmin.com/sso/signin"
SSO_PARAMS = {"id": "gauth-widget", "embedWidget": "true"}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            resp = requests.get(
                SSO_URL,
                params=SSO_PARAMS,
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=10,
            )
            if resp.status_code == 429:
                send_json(self, 200, {"banned": True})
            elif resp.status_code == 200:
                send_json(self, 200, {"banned": False})
            else:
                send_json(self, 200, {"banned": None, "status": resp.status_code})
        except Exception as e:
            send_json(self, 200, {"banned": None, "error": str(e)})
