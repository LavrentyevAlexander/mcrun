#!/usr/bin/env python3
"""Probe Garmin SSO to check if the rate-limit ban is still active.
Does NOT attempt to log in — safe to run at any time.

Usage:
    python3 check_garmin_ban.py
"""

import sys
import requests

URL = "https://sso.garmin.com/sso/signin"
PARAMS = {"id": "gauth-widget", "embedWidget": "true"}
HEADERS = {"User-Agent": "Mozilla/5.0"}

try:
    resp = requests.get(URL, params=PARAMS, headers=HEADERS, timeout=10)
except requests.RequestException as e:
    print(f"Request failed: {e}")
    sys.exit(2)

print(f"HTTP {resp.status_code}")

if resp.status_code == 429:
    print("Ban still active — do NOT attempt to sync yet.")
    sys.exit(1)
elif resp.status_code == 200:
    print("SSO accessible — ban appears lifted, safe to sync.")
    sys.exit(0)
else:
    print("Unexpected status — check manually before syncing.")
    sys.exit(2)
