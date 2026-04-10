#!/usr/bin/env python3
"""
Initialize Garmin OAuth tokens in the database.

Run this ONCE from your local machine (macOS) when:
  - Setting up for the first time
  - Tokens have expired (~1 year)

Usage:
    source .env        # or set GARMIN_EMAIL, GARMIN_PASSWORD, mcrun_db_POSTGRES_URL
    python3 init_garmin_tokens.py
"""

import os
import re
import subprocess
import sys
import tempfile

# Load .env and .env.local automatically
_HERE = os.path.dirname(os.path.abspath(__file__))
for _env_file in (".env.local", ".env"):
    _path = os.path.join(_HERE, _env_file)
    if os.path.exists(_path):
        with open(_path) as _f:
            for _line in _f:
                _line = _line.strip()
                if not _line or _line.startswith("#") or "=" not in _line:
                    continue
                _k, _, _v = _line.partition("=")
                _k = _k.strip()
                _v = _v.strip().strip('"').strip("'")  # remove surrounding quotes
                os.environ[_k] = _v  # always override (fixes broken shell exports)

sys.path.insert(0, os.path.join(_HERE, "api"))

from _db import get_conn

GARMIN_EMAIL = os.environ.get("GARMIN_EMAIL")
GARMIN_PASSWORD = os.environ.get("GARMIN_PASSWORD")

_SSO_PARAMS = (
    "id=gauth-widget&embedWidget=true"
    "&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed"
    "&service=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed"
    "&source=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed"
    "&redirectAfterAccountLoginUrl=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed"
    "&redirectAfterAccountCreationUrl=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed"
)
_SSO_URL = f"https://sso.garmin.com/sso/signin?{_SSO_PARAMS}"
_UA = "com.garmin.android.apps.connectmobile"

TOKEN_FILES = ("oauth1_token.json", "oauth2_token.json")


def get_service_ticket() -> str:
    print("Step 1: fetching CSRF token from Garmin SSO...")
    r = subprocess.run(
        ["curl", "-s", "-D", "-", "-H", f"User-Agent: {_UA}", _SSO_URL],
        capture_output=True, text=True, timeout=30,
    )
    if r.returncode != 0:
        raise RuntimeError(f"curl GET failed: {r.stderr}")

    csrf_m = re.search(r'name="_csrf"\s+value="(.+?)"', r.stdout)
    if not csrf_m:
        raise RuntimeError("No CSRF token — Garmin SSO page not returned")
    csrf_token = csrf_m.group(1)

    locale_m = re.search(
        r"Set-Cookie: (org\.springframework\.web\.servlet\.i18n\.CookieLocaleResolver\.LOCALE=[^;\s]+)",
        r.stdout,
    )
    spring_cookie = (
        locale_m.group(1) if locale_m
        else "org.springframework.web.servlet.i18n.CookieLocaleResolver.LOCALE=en"
    )

    print("Step 2: posting credentials...")
    r2 = subprocess.run(
        ["curl", "-s",
         "-X", "POST", _SSO_URL,
         "-H", f"User-Agent: {_UA}",
         "-H", f"Referer: {_SSO_URL}",
         "-b", spring_cookie,
         "--data-urlencode", f"username={GARMIN_EMAIL}",
         "--data-urlencode", f"password={GARMIN_PASSWORD}",
         "--data-urlencode", f"_csrf={csrf_token}",
         "--data-urlencode", "embed=true"],
        capture_output=True, text=True, timeout=30,
    )
    if r2.returncode != 0:
        raise RuntimeError(f"curl POST failed: {r2.stderr}")

    if '"status-code":"429"' in r2.stdout or "429" in r2.stdout[:200]:
        raise RuntimeError("Rate limited (429) — wait and try again")

    ticket_m = re.search(r'embed\?ticket=([^"\\]+)', r2.stdout)
    if not ticket_m:
        title_m = re.search(r"<title>(.+?)</title>", r2.stdout, re.I)
        title = title_m.group(1) if title_m else "no title"
        raise RuntimeError(f"No service ticket (page title: {title})")

    return ticket_m.group(1)


def main():
    if not GARMIN_EMAIL or not GARMIN_PASSWORD:
        print("ERROR: set GARMIN_EMAIL and GARMIN_PASSWORD environment variables")
        sys.exit(1)

    postgres_url = (
        os.environ.get("mcrun_db_POSTGRES_URL_NON_POOLING")
        or os.environ.get("mcrun_db_POSTGRES_URL")
    )
    if not postgres_url:
        print("ERROR: set mcrun_db_POSTGRES_URL environment variable")
        sys.exit(1)

    print(f"Logging in as {GARMIN_EMAIL}...")

    ticket = get_service_ticket()
    print(f"Got service ticket: {ticket[:20]}...")

    from garth.http import Client as GarthClient
    from garth.sso import get_oauth1_token, exchange as garth_exchange
    import garminconnect

    print("Step 3: exchanging ticket for OAuth tokens...")
    garth_client = GarthClient()
    oauth1 = get_oauth1_token(ticket, garth_client)
    oauth2 = garth_exchange(oauth1, garth_client)
    garth_client.configure(oauth1_token=oauth1, oauth2_token=oauth2)

    with tempfile.TemporaryDirectory() as tmp:
        garth_client.dump(tmp)

        print("Step 4: verifying tokens with Garmin API...")
        client = garminconnect.Garmin()
        client.login(tokenstore=tmp)
        client.get_full_name()  # simple API call to verify

        print("Step 5: saving tokens to database...")
        with get_conn() as conn:
            with conn.cursor() as cur:
                for fname in TOKEN_FILES:
                    fpath = os.path.join(tmp, fname)
                    if not os.path.exists(fpath):
                        continue
                    with open(fpath) as f:
                        value = f.read()
                    cur.execute(
                        """
                        INSERT INTO garmin_tokens (key, value, updated_at)
                        VALUES (%s, %s, NOW())
                        ON CONFLICT (key) DO UPDATE
                            SET value = EXCLUDED.value, updated_at = NOW()
                        """,
                        (fname, value),
                    )
                    print(f"  Saved {fname}")
                cur.execute("DELETE FROM garmin_tokens WHERE key = 'ban_until'")
            conn.commit()

    print("\nDone! Garmin tokens are active in the database.")
    print("Vercel will use these cached tokens for all future syncs.")
    print("Tokens are valid for ~1 year. Re-run this script if sync stops working.")


if __name__ == "__main__":
    main()
