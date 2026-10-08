import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [sync_utmb] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)

import requests

from _db import get_conn, send_error, send_json, verify_token

# Public, unauthenticated API backing https://utmb.world — no API key needed,
# just the tenant header the website itself sends. Runner URI is the slug
# from the profile URL, e.g. "7222318.alexander.lavrentyev".
UTMB_API_BASE = "https://api.utmb.world"
UTMB_TENANT_ID = "worldseries"
UTMB_RUNNER_URI = os.environ.get("UTMB_RUNNER_URI")

_PI_CATEGORIES = ("general", "20k", "50k", "100k", "100m")


def _index_map(performance_indexes: list) -> dict:
    """Map UTMB's [{piCategory, index}, ...] to {category: index}."""
    out = {cat: None for cat in _PI_CATEGORIES}
    for entry in performance_indexes or []:
        cat = entry.get("piCategory")
        if cat in out:
            out[cat] = entry.get("index")
    return out


def _parse_race(raw: dict):
    """Map one entry of results.results to a utmb_races row tuple, or None if unusable."""
    uri = raw.get("uri")
    date_iso = raw.get("dateIso")
    event_name = raw.get("eventName")
    race_name = raw.get("raceName")
    if not uri or not date_iso or not event_name or not race_name:
        return None

    distance_raw = raw.get("distance")
    try:
        distance_km = float(distance_raw) if distance_raw is not None else None
    except (TypeError, ValueError):
        distance_km = None

    return (
        uri,
        date_iso,
        event_name,
        race_name,
        distance_km,
        raw.get("elevationGain"),
        raw.get("time"),
        raw.get("piCategory"),
        raw.get("rank"),
        raw.get("rankGender"),
        raw.get("totalRanked"),
        bool(raw.get("isDnf")),
        raw.get("country"),
    )


def sync_utmb() -> dict:
    """Core sync logic — called from HTTP handler and cron."""
    started_at = datetime.now(timezone.utc)

    if not UTMB_RUNNER_URI:
        raise RuntimeError("UTMB_RUNNER_URI is not set")

    try:
        resp = requests.get(
            f"{UTMB_API_BASE}/runners/{UTMB_RUNNER_URI}",
            headers={"x-tenant-id": UTMB_TENANT_ID},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        indexes = _index_map(data.get("performanceIndexes"))
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        races = [
            r for raw in (data.get("results") or {}).get("results") or []
            if (r := _parse_race(raw)) is not None
        ]

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO utmb_index_history
                        (date, general_index, index_20k, index_50k, index_100k, index_100m,
                         nationality, age_group, synced_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (date) DO UPDATE SET
                        general_index = EXCLUDED.general_index,
                        index_20k     = EXCLUDED.index_20k,
                        index_50k     = EXCLUDED.index_50k,
                        index_100k    = EXCLUDED.index_100k,
                        index_100m    = EXCLUDED.index_100m,
                        nationality   = EXCLUDED.nationality,
                        age_group     = EXCLUDED.age_group,
                        synced_at     = EXCLUDED.synced_at
                    """,
                    (
                        today,
                        indexes["general"], indexes["20k"], indexes["50k"],
                        indexes["100k"], indexes["100m"],
                        data.get("nationality"), data.get("ageGroup"),
                    ),
                )

                for uri, date, event_name, race_name, distance_km, elevation_m, time, pi_category, rank, rank_gender, total_ranked, is_dnf, country in races:
                    cur.execute(
                        """
                        INSERT INTO utmb_races
                            (utmb_uri, date, event_name, race_name, distance_km, elevation_m,
                             time, pi_category, rank, rank_gender, total_ranked, is_dnf, country, synced_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        ON CONFLICT (utmb_uri) DO UPDATE SET
                            date          = EXCLUDED.date,
                            event_name    = EXCLUDED.event_name,
                            race_name     = EXCLUDED.race_name,
                            distance_km   = EXCLUDED.distance_km,
                            elevation_m   = EXCLUDED.elevation_m,
                            time          = EXCLUDED.time,
                            pi_category   = EXCLUDED.pi_category,
                            rank          = EXCLUDED.rank,
                            rank_gender   = EXCLUDED.rank_gender,
                            total_ranked  = EXCLUDED.total_ranked,
                            is_dnf        = EXCLUDED.is_dnf,
                            country       = EXCLUDED.country,
                            synced_at     = EXCLUDED.synced_at
                        """,
                        (uri, date, event_name, race_name, distance_km, elevation_m,
                         time, pi_category, rank, rank_gender, total_ranked, is_dnf, country),
                    )

                cur.execute(
                    """
                    INSERT INTO sync_log (source, status, records_synced, started_at, finished_at)
                    VALUES ('utmb', 'success', %s, %s, NOW())
                    """,
                    (len(races), started_at),
                )
            conn.commit()

        logging.info("Sync complete: general index %s, %d races", indexes["general"], len(races))
        return {"synced": len(races), "general_index": indexes["general"]}

    except Exception as e:
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO sync_log (source, status, error_detail, started_at, finished_at)
                        VALUES ('utmb', 'error', %s, %s, NOW())
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
            result = sync_utmb()
            send_json(self, 200, result)
        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
        except Exception as e:
            send_error(self, e)
