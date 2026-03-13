from http.server import BaseHTTPRequestHandler

import psycopg2.extras

from _db import get_conn, send_json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT DISTINCT ON (source)
                            source, status, records_synced, error_detail, finished_at
                        FROM sync_log
                        ORDER BY source, started_at DESC
                        """
                    )
                    rows = cur.fetchall()

            result = {r["source"]: dict(r) for r in rows}
            send_json(self, 200, result)

        except Exception as e:
            send_json(self, 500, {"error": str(e)})
