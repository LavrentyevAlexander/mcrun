import json
import logging
import os
import sys

# Ensure api/ directory is in path so _db is importable from any subdirectory
sys.path.insert(0, os.path.dirname(__file__))

import psycopg2
import psycopg2.extras

POSTGRES_URL = os.environ.get("POSTGRES_URL_NON_POOLING") or os.environ.get("POSTGRES_URL")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
ALLOWED_EMAIL = os.environ.get("ALLOWED_EMAIL")

log = logging.getLogger("mcrun")


class BadRequest(Exception):
    """Raised for malformed client input — maps to HTTP 400."""


def get_conn():
    if not POSTGRES_URL:
        raise RuntimeError("POSTGRES_URL is not set")
    return psycopg2.connect(POSTGRES_URL)


def verify_token(headers):
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token
    import requests as _requests

    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise PermissionError("Unauthorized")
    token = auth[7:]

    # Always use a fresh session so we fetch current Google signing certificates
    # rather than relying on a potentially stale module-level cache.
    # Retried once in case of a transient cert-not-found during key rotation.
    last_err = None
    for _ in range(2):
        try:
            request = google_requests.Request(session=_requests.Session())
            idinfo = id_token.verify_oauth2_token(token, request, GOOGLE_CLIENT_ID)
            break
        except ValueError as e:
            last_err = e
            if "Certificate for key id" not in str(e):
                raise PermissionError(str(e))
    else:
        raise PermissionError(str(last_err))

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


def read_json_body(handler) -> dict:
    """Read and parse a JSON request body. Raises BadRequest on malformed input."""
    try:
        length = int(handler.headers.get("Content-Length", 0) or 0)
    except (TypeError, ValueError):
        raise BadRequest("Invalid Content-Length header")
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        raise BadRequest("Request body must be valid JSON")
    if not isinstance(data, dict):
        raise BadRequest("Request body must be a JSON object")
    return data


# Exception class names that carry no sensitive detail and map to a friendly message.
_SAFE_ERROR_MESSAGES = {
    "OperationalError": "Database temporarily unavailable. Please try again.",
    "InterfaceError": "Database temporarily unavailable. Please try again.",
    "ConnectionError": "Upstream service unavailable. Please try again.",
    "Timeout": "Upstream service timed out. Please try again.",
    "ConnectTimeout": "Upstream service timed out. Please try again.",
    "ReadTimeout": "Upstream service timed out. Please try again.",
}


def send_error(handler, exc, status: int = 500):
    """Log the real exception server-side; return a non-leaking message to the client."""
    log.exception("Unhandled error: %s", exc)
    resp = getattr(exc, "response", None)
    status_code = getattr(resp, "status_code", None)
    if status_code:
        # Preserve the upstream HTTP status (e.g. 429) without leaking the URL/body.
        message = f"Upstream service error (HTTP {status_code})"
    else:
        message = _SAFE_ERROR_MESSAGES.get(type(exc).__name__, "Internal server error")
    send_json(handler, status, {"error": message})


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
