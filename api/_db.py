import json
import os

import psycopg2
import psycopg2.extras
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

POSTGRES_URL = os.environ.get("mcrun_db_POSTGRES_URL_NON_POOLING") or os.environ.get("mcrun_db_POSTGRES_URL")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
ALLOWED_EMAIL = os.environ.get("ALLOWED_EMAIL")


def get_conn():
    if not POSTGRES_URL:
        raise RuntimeError("POSTGRES_URL is not set")
    return psycopg2.connect(POSTGRES_URL)


def verify_token(headers):
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise PermissionError("Unauthorized")
    token = auth[7:]
    idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
    if ALLOWED_EMAIL and idinfo.get("email") != ALLOWED_EMAIL:
        raise PermissionError("Forbidden")


def send_json(handler, status, data):
    body = json.dumps(data, default=str).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.end_headers()
    handler.wfile.write(body)
