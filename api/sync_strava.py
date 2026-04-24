import logging
import math
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [sync_strava] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)

import psycopg2.extras
import requests

from _db import get_conn, send_json, verify_token


_CTL_TAU = 42.0  # days — Chronic Training Load time constant


def _fetch_all_strava_efforts(token: str) -> list[tuple[str, float]]:
    """Fetch (date, suffer_score) for ALL Strava activities, oldest first."""
    all_efforts = []
    page = 1
    while True:
        resp = requests.get(
            "https://www.strava.com/api/v3/athlete/activities",
            headers={"Authorization": f"Bearer {token}"},
            params={"per_page": 200, "page": page},
            timeout=30,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        for act in batch:
            score = act.get("suffer_score")
            if score:
                all_efforts.append((act["start_date_local"][:10], float(score)))
        page += 1
    all_efforts.sort(key=lambda x: x[0])
    return all_efforts


def _recompute_fitness(conn):
    """Recompute CTL-based fitness score and delta for every activity.

    Fetches the full Strava activity history to build an accurate CTL baseline,
    then applies the scores to activities stored in our DB.
    """
    # Full history from Strava for correct CTL baseline
    try:
        token = get_access_token()
        all_efforts = _fetch_all_strava_efforts(token)
    except Exception:
        all_efforts = []

    # Activities in our DB (need id + date for final update)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, date::text, relative_effort FROM activities ORDER BY date ASC, id ASC"
        )
        db_rows = {row[1]: (row[0], row[2]) for row in cur.fetchall()}  # date -> (id, effort)

    # Build a merged timeline: (date, effort, db_id_or_None)
    # Use all_efforts for CTL computation; mark which dates map to our DB rows
    k = 1 - math.exp(-1 / _CTL_TAU)
    ctl = 0.0
    prev_date_dt = None
    updates = []

    # Index our DB rows by date for matching
    db_by_date: dict[str, list[tuple[int, float]]] = {}
    for date_str, (act_id, effort) in db_rows.items():
        db_by_date.setdefault(date_str, []).append((act_id, effort or 0))

    for date_str, effort in all_efforts:
        date_dt = datetime.strptime(date_str, "%Y-%m-%d")

        if prev_date_dt is not None:
            days_gap = (date_dt - prev_date_dt).days
            if days_gap > 0:
                ctl *= math.exp(-days_gap / _CTL_TAU)

        ctl_before = ctl
        ctl += effort * k

        # If this date has a DB activity, record the score
        if date_str in db_by_date:
            for act_id, _eff in db_by_date[date_str]:
                updates.append((round(ctl, 1), round(ctl - ctl_before, 1), act_id))
            del db_by_date[date_str]

        prev_date_dt = date_dt

    # Any DB activities not in Strava full history (edge case) — compute from DB data
    for date_str, entries in sorted(db_by_date.items()):
        date_dt = datetime.strptime(date_str, "%Y-%m-%d")
        if prev_date_dt is not None:
            days_gap = (date_dt - prev_date_dt).days
            if days_gap > 0:
                ctl *= math.exp(-days_gap / _CTL_TAU)
        for act_id, effort in entries:
            ctl_before = ctl
            ctl += effort * k
            updates.append((round(ctl, 1), round(ctl - ctl_before, 1), act_id))
        prev_date_dt = date_dt

    with conn.cursor() as cur:
        cur.executemany(
            "UPDATE activities SET fitness_score = %s, fitness_delta = %s WHERE id = %s",
            updates,
        )
    conn.commit()

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


def fetch_all_athlete_shoes(token):
    """Returns list of (strava_id, name, total_km) for all shoes from athlete profile."""
    resp = requests.get(
        "https://www.strava.com/api/v3/athlete",
        headers={"Authorization": f"Bearer {token}"},
    )
    if resp.status_code != 200:
        return []
    shoes = resp.json().get("shoes", [])
    return [
        (s["id"], s.get("name", s["id"]), round(s.get("distance", 0) / 1000, 2))
        for s in shoes
    ]


def sync_strava() -> dict:
    """Core sync logic — called from HTTP handler and cron."""
    started_at = datetime.now(timezone.utc)
    try:
        token = get_access_token()

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT MAX(date) FROM activities")
                row = cur.fetchone()

        latest_date = row[0]
        if latest_date:
            cutoff = latest_date - timedelta(days=3)
            after_ts = int(datetime.combine(cutoff, datetime.min.time()).timestamp())
        else:
            after_ts = 0

        activities = fetch_all_activities(token, after_timestamp=after_ts)
        athlete_shoes = fetch_all_athlete_shoes(token)
        activity_gear_ids = {
            a["gear_id"]
            for a in activities
            if a.get("gear_id") and not a["gear_id"].startswith("b")
        }

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                gear_db_ids = {}
                for gid, name, total_km in athlete_shoes:
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

                for gid in activity_gear_ids - {s[0] for s in athlete_shoes}:
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

        # ── Recompute fitness scores (CTL) ───────────────────────────
        # Runs in a separate connection/transaction so a failure here
        # doesn't roll back the already-committed activity upserts.
        try:
            with get_conn() as fitness_conn:
                _recompute_fitness(fitness_conn)
        except Exception as fit_err:
            logging.warning("Fitness recompute failed (activities saved): %s", fit_err)

        logging.info("Strava sync complete: %d activities", synced)
        return {"synced": synced}

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
        raise


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            verify_token(self.headers)
            result = sync_strava()
            send_json(self, 200, result)
        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
        except Exception as e:
            send_json(self, 500, {"error": str(e)})
