import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

from _db import get_conn, send_json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT value FROM garmin_tokens WHERE key = 'ban_until'")
                    row = cur.fetchone()
            if row:
                try:
                    ban_until = datetime.fromisoformat(row[0])
                    if ban_until > datetime.now(timezone.utc):
                        send_json(self, 200, {"banned": True, "ban_until": row[0]})
                        return
                except (ValueError, TypeError):
                    pass
            send_json(self, 200, {"banned": False})
        except Exception as e:
            send_json(self, 200, {"banned": None, "error": str(e)})
