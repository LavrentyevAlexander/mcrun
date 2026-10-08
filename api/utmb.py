import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from http.server import BaseHTTPRequestHandler

import psycopg2.extras

from _db import get_conn, send_error, send_json, verify_token

_HISTORY_LIMIT = 365
_RACES_LIMIT = 20


class handler(BaseHTTPRequestHandler):
    # Combines read (GET) and manual sync trigger (POST) in one file — unlike
    # the Strava/Garmin split (sync_*.py + *_metrics.py) — to stay within
    # Vercel Hobby's 12-Serverless-Function cap. See api/_utmb.py.
    def do_POST(self):
        try:
            verify_token(self.headers)
            from _utmb import sync_utmb
            result = sync_utmb()
            send_json(self, 200, result)
        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
        except Exception as e:
            send_error(self, e)

    def do_GET(self):
        try:
            try:
                verify_token(self.headers)
            except PermissionError as e:
                return send_json(self, 401, {"error": str(e)})

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT date::text, general_index, index_20k, index_50k, index_100k, index_100m,
                               nationality, age_group, synced_at::text
                        FROM utmb_index_history
                        ORDER BY date DESC
                        LIMIT %s
                        """,
                        (_HISTORY_LIMIT,),
                    )
                    history = [dict(r) for r in cur.fetchall()]
                    history.reverse()  # chronological order for charting

                    cur.execute(
                        """
                        SELECT date::text, event_name, race_name, distance_km, elevation_m,
                               time, pi_category, rank, rank_gender, total_ranked, is_dnf, country
                        FROM utmb_races
                        ORDER BY date DESC
                        LIMIT %s
                        """,
                        (_RACES_LIMIT,),
                    )
                    races = [dict(r) for r in cur.fetchall()]
                    for r in races:
                        r["distance_km"] = float(r["distance_km"]) if r["distance_km"] is not None else None

            current = history[-1] if history else None
            send_json(self, 200, {
                "current": current,
                "history": history,
                "races": races,
            })

        except Exception as e:
            send_error(self, e)
