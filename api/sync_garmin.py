import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

import garminconnect

from _db import get_conn, send_json, verify_token

GARMIN_EMAIL = os.environ.get("GARMIN_EMAIL")
GARMIN_PASSWORD = os.environ.get("GARMIN_PASSWORD")
GARMIN_TOTP_SECRET = os.environ.get("GARMIN_TOTP_SECRET")

TRAINING_STATUS_MAP = {
    1: "no data",
    2: "recovery",
    3: "unproductive",
    4: "maintaining",
    5: "productive",
    6: "peaking",
    7: "overreaching",
    8: "strained",
}

READINESS_FEEDBACK_MAP = {
    "GOOD_SLEEP_LAST_NIGHT": "Good sleep last night",
    "RECOVERED_AND_READY": "Recovered and ready",
    "HIGH_HRV": "High HRV",
    "LOW_HRV": "Low HRV",
    "GOOD_HRV": "Good HRV",
    "HIGH_STRESS_HISTORY": "High recent stress",
    "POOR_SLEEP_HISTORY": "Poor sleep history",
    "GOOD_SLEEP_HISTORY": "Good sleep history",
    "LOW_BODY_BATTERY": "Low body battery",
    "HIGH_ACTIVITY": "High recent activity",
    "LOW_ACTIVITY": "Low recent activity",
    "POOR_SLEEP_LAST_NIGHT": "Poor sleep last night",
    "MODERATE_SLEEP_LAST_NIGHT": "Moderate sleep last night",
    "HIGH_RECOVERY_TIME": "High recovery time remaining",
    "NO_CHANGE_SLEEP": "No change since waking",
}

ACWR_FEEDBACK_MAP = {
    "VERY_GOOD": "very good",
    "GOOD": "good",
    "MODERATE": "moderate",
    "FAIR": "fair",
    "POOR": "poor",
    "VERY_POOR": "very poor",
}

TYPE_ID_MAP = {
    1: ("1 km", 1000),
    2: ("1 mile", 1609),
    3: ("5 km", 5000),
    4: ("10 km", 10000),
    5: ("Half marathon", 21097),
    6: ("Marathon", 42195),
}


TOKEN_STORE = "/tmp/garmin_tokens"


def get_garmin_client():
    # Try cached tokens first — avoids a full OAuth login on every sync call
    try:
        client = garminconnect.Garmin(tokenstore=TOKEN_STORE)
        client.login()
        return client
    except Exception:
        pass

    # Full login — runs when no cached tokens or tokens are expired
    client = garminconnect.Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
    if GARMIN_TOTP_SECRET:
        import pyotp
        client.login(prompt_mfa=lambda: pyotp.TOTP(GARMIN_TOTP_SECRET).now())
    else:
        client.login()

    try:
        client.garth.dump(TOKEN_STORE)
    except Exception:
        pass

    return client


def _num(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return val
    if isinstance(val, str):
        try:
            return float(val)
        except ValueError:
            return None
    return None


def _str(val):
    if val is None:
        return None
    if isinstance(val, str):
        return val
    if isinstance(val, (int, float, bool)):
        return str(val)
    return None


def sync_garmin() -> dict:
    """Core sync logic — called from HTTP handler and cron."""
    started_at = datetime.now(timezone.utc)
    try:
        client = get_garmin_client()

        # ── Personal records ─────────────────────────────────────────
        prs = client.get_personal_record()
        records = []
        for pr in prs:
            if pr.get("activityType") != "running":
                continue
            type_info = TYPE_ID_MAP.get(pr.get("typeId"))
            if not type_info:
                continue
            label, distance_m = type_info
            duration_sec = pr.get("value")
            if not duration_sec:
                continue
            date_raw = pr.get("actStartDateTimeInGMTFormatted") or ""
            records.append((
                label,
                distance_m,
                round(duration_sec),
                date_raw[:10] or None,
                pr.get("activityId"),
                pr.get("activityName") or "",
            ))

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("TRUNCATE TABLE personal_records")
                for label, distance_m, time_sec, date, garmin_id, activity_name in records:
                    cur.execute(
                        """
                        INSERT INTO personal_records
                            (label, distance_m, time_sec, date, garmin_activity_id, activity_name, synced_at)
                        VALUES (%s, %s, %s, %s, %s, %s, NOW())
                        """,
                        (label, distance_m, time_sec, date, garmin_id, activity_name),
                    )
                cur.execute(
                    """
                    INSERT INTO sync_log (source, status, records_synced, started_at, finished_at)
                    VALUES ('garmin', 'success', %s, %s, NOW())
                    """,
                    (len(records), started_at),
                )
            conn.commit()

        # ── Fitness metrics ──────────────────────────────────────────
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        vo2_max = fitness_age = None
        debug_vo2max = None
        try:
            from datetime import timedelta
            for days_back in range(3):
                check_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y-%m-%d")
                raw = client.get_max_metrics(check_date)
                entry = raw[0] if isinstance(raw, list) and raw else (raw if isinstance(raw, dict) else {})
                debug_vo2max = {"date": check_date, "raw": raw}
                g = (entry or {}).get("generic") or {}
                vo2_max = _num(g.get("vo2MaxPreciseValue") or g.get("vo2MaxValue"))
                fitness_age = _num(g.get("fitnessAge"))
                if vo2_max is not None:
                    break
        except Exception as e:
            debug_vo2max = {"error": str(e)}

        if fitness_age is None:
            try:
                raw_fa = client.get_fitnessage_data(today)
                debug_vo2max = {**(debug_vo2max or {}), "fitnessage_raw": raw_fa}
                if isinstance(raw_fa, dict):
                    fitness_age = _num(
                        raw_fa.get("fitnessAge") or raw_fa.get("fitness_age")
                        or raw_fa.get("value")
                    )
            except Exception:
                pass

        training_status = training_load = acute_load = None
        try:
            raw_ts = client.get_training_status(today)
            latest = (
                (raw_ts or {})
                .get("mostRecentTrainingStatus", {})
                .get("latestTrainingStatusData", {})
            )
            device_data = next(iter(latest.values()), {}) if latest else {}
            training_status = TRAINING_STATUS_MAP.get(device_data.get("trainingStatus"))
            acl = device_data.get("acuteTrainingLoadDTO") or {}
            acute_load = _num(acl.get("dailyTrainingLoadAcute"))
            training_load = _num(acl.get("dailyTrainingLoadChronic"))
        except Exception:
            pass

        hrv_last_night = hrv_weekly_avg = hrv_status = None
        try:
            raw_hrv = client.get_hrv_data(today)
            hrv_summary = (raw_hrv or {}).get("hrvSummary") or {}
            hrv_last_night = _num(hrv_summary.get("lastNightAvg"))
            hrv_weekly_avg = _num(hrv_summary.get("weeklyAvg"))
            hrv_status = _str(hrv_summary.get("status"))
        except Exception:
            pass

        # ── Training Readiness ───────────────────────────────────────
        training_readiness = readiness_level = readiness_feedback = None
        sleep_score = recovery_time = acwr_feedback = None
        debug_readiness = None
        try:
            raw_tr = client.get_training_readiness(today)
            debug_readiness = raw_tr
            entry_tr = None
            if isinstance(raw_tr, list) and raw_tr:
                # prefer post-exercise reset (most recent state), fallback to first
                entry_tr = next(
                    (e for e in raw_tr if e.get("inputContext") == "AFTER_POST_EXERCISE_RESET"),
                    raw_tr[0],
                )
            elif isinstance(raw_tr, dict):
                entry_tr = raw_tr
            if entry_tr:
                training_readiness = _num(
                    entry_tr.get("score") or entry_tr.get("trainingReadinessScore")
                    or entry_tr.get("value") or entry_tr.get("trainingReadiness")
                )
                readiness_level = _str(entry_tr.get("level"))
                feedback_key = entry_tr.get("feedbackShort")
                readiness_feedback = READINESS_FEEDBACK_MAP.get(feedback_key, feedback_key)
                sleep_score = entry_tr.get("sleepScore")
                recovery_time = entry_tr.get("recoveryTime")
                acwr_raw = entry_tr.get("acwrFactorFeedback")
                acwr_feedback = ACWR_FEEDBACK_MAP.get(acwr_raw, acwr_raw.lower().replace("_", " ") if acwr_raw else None)
        except Exception:
            pass

        # ── Resting HR (today + 7-day list) ─────────────────────────
        resting_hr = None
        resting_hr_7day = None
        debug_rhr = None
        try:
            from datetime import timedelta
            import json as _json
            seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=6)).strftime("%Y-%m-%d")
            raw_rhr = client.get_rhr_day(today)
            debug_rhr = raw_rhr
            if isinstance(raw_rhr, dict):
                # Try direct keys first
                resting_hr = _num(
                    raw_rhr.get("restingHeartRate") or raw_rhr.get("value") or raw_rhr.get("rhr")
                )
                # Fallback: allMetrics.metricsMap.WELLNESS_RESTING_HEART_RATE[0].value
                if resting_hr is None:
                    entries = (
                        (raw_rhr.get("allMetrics") or {})
                        .get("metricsMap", {})
                        .get("WELLNESS_RESTING_HEART_RATE", [])
                    )
                    if entries:
                        resting_hr = _num(entries[0].get("value"))
            elif isinstance(raw_rhr, list) and raw_rhr:
                last = raw_rhr[-1]
                resting_hr = _num(
                    last.get("restingHeartRate") or last.get("value") or last.get("rhr")
                )
            # 7-day trend via get_heart_rates
            raw_rhr7 = client.get_rhr_data(seven_days_ago, today)
            if isinstance(raw_rhr7, list):
                trend = [
                    {"date": e.get("calendarDate") or e.get("date"), "value": _num(e.get("restingHeartRate") or e.get("value") or e.get("rhr"))}
                    for e in raw_rhr7
                    if isinstance(e, dict)
                ]
                resting_hr_7day = _json.dumps(trend)
        except Exception:
            pass

        # ── Race Predictions ─────────────────────────────────────────
        race_5k = race_10k = race_hm = race_marathon = None
        debug_race = None
        try:
            raw_race = client.get_race_predictions()
            debug_race = raw_race
            if isinstance(raw_race, list) and raw_race:
                raw_race = raw_race[0]
            if isinstance(raw_race, dict):
                def _fmt_time(seconds):
                    if seconds is None:
                        return None
                    s = int(seconds)
                    h, rem = divmod(s, 3600)
                    m, sec = divmod(rem, 60)
                    if h:
                        return f"{h}:{m:02d}:{sec:02d}"
                    return f"{m}:{sec:02d}"

                race_5k = _fmt_time(_num(
                    raw_race.get("time5K") or raw_race.get("racePrediction5K")
                    or raw_race.get("fiveK") or raw_race.get("5k")
                ))
                race_10k = _fmt_time(_num(
                    raw_race.get("time10K") or raw_race.get("racePrediction10K")
                    or raw_race.get("tenK") or raw_race.get("10k")
                ))
                race_hm = _fmt_time(_num(
                    raw_race.get("timeHalfMarathon") or raw_race.get("racePredictionHalfMarathon")
                    or raw_race.get("halfMarathon")
                ))
                race_marathon = _fmt_time(_num(
                    raw_race.get("timeMarathon") or raw_race.get("racePredictionMarathon")
                    or raw_race.get("marathon")
                ))
        except Exception:
            pass

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO garmin_metrics
                        (id, vo2_max, fitness_age, training_status,
                         training_load, acute_load,
                         hrv_last_night, hrv_weekly_avg, hrv_status,
                         training_readiness, readiness_level, readiness_feedback,
                         sleep_score, recovery_time, acwr_feedback,
                         resting_hr, resting_hr_7day,
                         race_5k, race_10k, race_hm, race_marathon,
                         synced_at)
                    VALUES (1, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        vo2_max             = EXCLUDED.vo2_max,
                        fitness_age         = EXCLUDED.fitness_age,
                        training_status     = EXCLUDED.training_status,
                        training_load       = EXCLUDED.training_load,
                        acute_load          = EXCLUDED.acute_load,
                        hrv_last_night      = EXCLUDED.hrv_last_night,
                        hrv_weekly_avg      = EXCLUDED.hrv_weekly_avg,
                        hrv_status          = EXCLUDED.hrv_status,
                        training_readiness  = EXCLUDED.training_readiness,
                        readiness_level     = EXCLUDED.readiness_level,
                        readiness_feedback  = EXCLUDED.readiness_feedback,
                        sleep_score         = EXCLUDED.sleep_score,
                        recovery_time       = EXCLUDED.recovery_time,
                        acwr_feedback       = EXCLUDED.acwr_feedback,
                        resting_hr          = EXCLUDED.resting_hr,
                        resting_hr_7day     = EXCLUDED.resting_hr_7day,
                        race_5k             = EXCLUDED.race_5k,
                        race_10k            = EXCLUDED.race_10k,
                        race_hm             = EXCLUDED.race_hm,
                        race_marathon       = EXCLUDED.race_marathon,
                        synced_at           = EXCLUDED.synced_at
                    """,
                    (vo2_max, fitness_age, training_status,
                     training_load, acute_load,
                     hrv_last_night, hrv_weekly_avg, hrv_status,
                     training_readiness, readiness_level, readiness_feedback,
                     sleep_score, recovery_time, acwr_feedback,
                     resting_hr, resting_hr_7day,
                     race_5k, race_10k, race_hm, race_marathon),
                )
            conn.commit()

        # ── Planned workouts (upcoming calendar) ─────────────────────
        planned_synced = 0
        try:
            from datetime import timedelta
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            today_dt = datetime.now(timezone.utc)
            all_planned = []

            # Fetch current month and next month (Garmin calendar month is 0-indexed)
            months = set()
            months.add((today_dt.year, today_dt.month - 1))
            next_m = (today_dt.replace(day=28) + timedelta(days=4))
            months.add((next_m.year, next_m.month - 1))

            for year, month_0 in sorted(months):
                try:
                    raw = client.connectapi(f"/calendarservice/year/{year}/month/{month_0}")
                    for item in (raw or {}).get("calendarItems") or []:
                        if item.get("itemType") != "workout":
                            continue
                        item_date = (item.get("date") or "")[:10]
                        if not item_date or item_date < today_str:
                            continue
                        item_id = item.get("id")
                        if not item_id:
                            continue
                        act_type_raw = item.get("activityType")
                        act_type = (
                            act_type_raw.get("typeKey")
                            if isinstance(act_type_raw, dict)
                            else str(act_type_raw or "")
                        )
                        all_planned.append((
                            int(item_id),
                            item_date,
                            item.get("title") or item.get("workoutName") or "",
                            act_type,
                            round(float(item.get("distance") or 0) / 1000, 2),
                            int(item.get("duration") or 0),
                        ))
                except Exception:
                    pass

            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("TRUNCATE TABLE garmin_activities")
                    for item_id, date, name, act_type, dist_km, dur_sec in all_planned:
                        cur.execute(
                            """
                            INSERT INTO garmin_activities
                                (garmin_id, date, name, activity_type,
                                 distance_km, duration_sec, synced_at)
                            VALUES (%s, %s, %s, %s, %s, %s, NOW())
                            ON CONFLICT (garmin_id) DO UPDATE SET
                                date          = EXCLUDED.date,
                                name          = EXCLUDED.name,
                                activity_type = EXCLUDED.activity_type,
                                distance_km   = EXCLUDED.distance_km,
                                duration_sec  = EXCLUDED.duration_sec,
                                synced_at     = EXCLUDED.synced_at
                            """,
                            (item_id, date, name, act_type, dist_km, dur_sec),
                        )
                        planned_synced += 1
                conn.commit()
        except Exception:
            pass

        return {
            "synced": len(records),
            "planned_synced": planned_synced,
            "metrics_debug": {
                "vo2max_raw": debug_vo2max,
                "training_readiness_raw": debug_readiness,
                "rhr_raw": debug_rhr,
                "race_raw": debug_race,
            },
        }

    except Exception as e:
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO sync_log (source, status, error_detail, started_at, finished_at)
                        VALUES ('garmin', 'error', %s, %s, NOW())
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
            result = sync_garmin()
            send_json(self, 200, result)
        except PermissionError as e:
            send_json(self, 401, {"error": str(e)})
        except Exception as e:
            send_json(self, 500, {"error": str(e)})
