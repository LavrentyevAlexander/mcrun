import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

import psycopg2.extras
import requests

from _db import get_conn, send_json, verify_token

CLIENT_ID = os.environ.get("CLIENT_ID")
CLIENT_SECRET = os.environ.get("CLIENT_SECRET")
REFRESH_TOKEN = os.environ.get("REFRESH_TOKEN")


def get_access_token():
    resp = requests.post(
        "https://www.strava.com/oauth/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": REFRESH_TOKEN,
        },
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def fetch_all_activities(token, after_timestamp=0):
    headers = {"Authorization": f"Bearer {token}"}
    activities = []
    page = 1
    while True:
        resp = requests.get(
            "https://www.strava.com/api/v3/athlete/activities",
            headers=headers,
            params={"after": after_timestamp, "per_page": 100, "page": page},
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            break
        activities.extend(data)
        page += 1
    return activities


def fetch_gear(token, gear_id):
    resp = requests.get(
        f"https://www.strava.com/api/v3/gear/{gear_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    if resp.status_code == 200:
        d = resp.json()
        return d.get("name", gear_id), round(d.get("distance", 0) / 1000, 2)
    return gear_id, 0.0


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        started_at = datetime.now(timezone.utc)
        try:
            verify_token(self.headers)

            token = get_access_token()

            # Incremental sync: only fetch activities newer than the latest in DB
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT MAX(date) FROM activities")
                    row = cur.fetchone()

            latest_date = row[0]
            if latest_date:
                # Subtract 3 days to catch any late-arriving activities
                from datetime import timedelta
                cutoff = latest_date - timedelta(days=3)
                after_ts = int(datetime.combine(cutoff, datetime.min.time()).timestamp())
            else:
                after_ts = 0

            activities = fetch_all_activities(token, after_timestamp=after_ts)

            # Collect unique running gear ids
            gear_ids = {
                a["gear_id"]
                for a in activities
                if a.get("gear_id") and not a["gear_id"].startswith("b")
            }

            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # Upsert gear
                    gear_db_ids = {}
                    for gid in gear_ids:
                        name, total_km = fetch_gear(token, gid)
                        cur.execute(
                            """
                            INSERT INTO gear (strava_id, name, total_km, synced_at)
                            VALUES (%s, %s, %s, NOW())
                            ON CONFLICT (strava_id) DO UPDATE
                                SET name      = EXCLUDED.name,
                                    total_km  = EXCLUDED.total_km,
                                    synced_at = EXCLUDED.synced_at
                            RETURNING id
                            """,
                            (gid, name, total_km),
                        )
                        gear_db_ids[gid] = cur.fetchone()["id"]

                    # Upsert activities (runs only)
                    synced = 0
                    for act in activities:
                        if act.get("type") != "Run":
                            continue
                        gear_id = act.get("gear_id")
                        if not gear_id:
                            continue

                        cur.execute(
                            """
                            INSERT INTO activities (
                                strava_id, date, name, distance_km, elapsed_sec, moving_sec,
                                avg_hr, elevation_m, relative_effort, gear_id, synced_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                            ON CONFLICT (strava_id) DO UPDATE SET
                                date            = EXCLUDED.date,
                                name            = EXCLUDED.name,
                                distance_km     = EXCLUDED.distance_km,
                                elapsed_sec     = EXCLUDED.elapsed_sec,
                                moving_sec      = EXCLUDED.moving_sec,
                                avg_hr          = EXCLUDED.avg_hr,
                                elevation_m     = EXCLUDED.elevation_m,
                                relative_effort = EXCLUDED.relative_effort,
                                gear_id         = EXCLUDED.gear_id,
                                synced_at       = EXCLUDED.synced_at
                            """,
                            (
                                act["id"],
                                act["start_date_local"][:10],
                                act["name"],
                                round(act["distance"] / 1000, 3),
                                act["elapsed_time"],
                                act["moving_time"],
                                round(act["average_heartrate"]) if act.get("average_heartrate") else None,
                                act.get("total_elevation_gain"),
                                act.get("suffer_score"),
                                gear_db_ids.get(gear_id),
                            ),
                        )
                        synced += 1

                    cur.execute(
                        """
                        INSERT INTO sync_log (source, status, records_synced, started_at, finished_at)
                        VALUES ('strava', 'success', %s, %s, NOW())
                        """,
                        (synced, started_at),
                    )
                conn.commit()

            send_json(self, 200, {"synced": synced})

        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
        except Exception as e:
            try:
                with get_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO sync_log (source, status, error_detail, started_at, finished_at)
                            VALUES ('strava', 'error', %s, %s, NOW())
                            """,
                            (str(e), started_at),
                        )
                    conn.commit()
            except Exception:
                pass
            send_json(self, 500, {"error": str(e)})
