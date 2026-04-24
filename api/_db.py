import json
import os
import sys

# Ensure api/ directory is in path so _db is importable from any subdirectory
sys.path.insert(0, os.path.dirname(__file__))

import psycopg2
import psycopg2.extras

POSTGRES_URL = os.environ.get("mcrun_db_POSTGRES_URL_NON_POOLING") or os.environ.get("mcrun_db_POSTGRES_URL")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
ALLOWED_EMAIL = os.environ.get("ALLOWED_EMAIL")


def get_conn():
    if not POSTGRES_URL:
        raise RuntimeError("POSTGRES_URL is not set")
    return psycopg2.connect(POSTGRES_URL)


def verify_token(headers):
    # Lazy import to avoid module-level failures if google-auth is slow to load
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise PermissionError("Unauthorized")
    token = auth[7:]
    idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
    if ALLOWED_EMAIL and idinfo.get("email") != ALLOWED_EMAIL:
        raise PermissionError("Forbidden")


def send_json(handler, status, data, extra_headers: dict | None = None):
    body = json.dumps(data, default=str).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    if extra_headers:
        for k, v in extra_headers.items():
            handler.send_header(k, v)
    handler.end_headers()
    handler.wfile.write(body)


def validate(payload: dict, rules: dict) -> list[str]:
    """Return list of validation error strings.

    rules: { field_name: {"required": bool, "type": type, "min_len": int, "min": number} }
    """
    errors = []
    for field, opts in rules.items():
        val = payload.get(field)
        if opts.get("required") and (val is None or val == ""):
            errors.append(f"'{field}' is required")
            continue
        if val is None:
            continue
        expected_type = opts.get("type")
        if expected_type and not isinstance(val, expected_type):
            type_name = (
                " or ".join(t.__name__ for t in expected_type)
                if isinstance(expected_type, tuple)
                else expected_type.__name__
            )
            errors.append(f"'{field}' must be {type_name}")
            continue
        if opts.get("min_len") and isinstance(val, str) and len(val.strip()) < opts["min_len"]:
            errors.append(f"'{field}' must not be empty")
        if opts.get("min") is not None and isinstance(val, (int, float)) and val < opts["min"]:
            errors.append(f"'{field}' must be >= {opts['min']}")
    return errors
