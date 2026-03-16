# CLAUDE.md — McRun

Project context and conventions for Claude Code.

## What this project is

Personal running dashboard for one user. Single-file React SPA (`src/App.tsx`) + Python serverless functions (`api/*.py`) deployed on Vercel. PostgreSQL as the only data store.

## Architecture

All API routes live in `api/`. Vercel maps each file to `/api/<filename>`. There is no framework — each file defines a `handler` class extending `BaseHTTPRequestHandler`.

Shared utilities are in `api/_db.py`:
- `get_conn()` — psycopg2 connection from `POSTGRES_URL`
- `verify_token(headers)` — validates Google ID token and checks `ALLOWED_EMAIL`; raises `PermissionError` on failure
- `send_json(handler, status, data)` — writes JSON response

Authentication pattern (follow this in every write endpoint):
```python
try:
    verify_token(self.headers)
except PermissionError as e:
    send_json(self, 401, {"error": str(e)})
    return
```

The frontend stores the Google credential JWT in `localStorage` and sends it as `Authorization: Bearer <token>`.

## Key files

| File                  | Role                                                     |
|-----------------------|----------------------------------------------------------|
| `src/App.tsx`         | Entire frontend. All state, fetches, and UI in one file. |
| `src/App.css`         | All styles. CSS variables defined at `:root`.            |
| `api/_db.py`          | Shared DB/auth helpers.                                  |
| `api/stats.py`        | Main read endpoint — activities + gear summary.          |
| `api/gear.py`         | Gear CRUD (POST add, PATCH update). Requires auth.       |
| `api/competitions.py` | Competition CRUD. Requires auth.                         |
| `api/sync_strava.py`  | Incremental Strava sync. Requires auth.                  |
| `api/sync_garmin.py`  | Garmin personal records sync. Requires auth.             |

## Database schema (summary)

```
gear          id, strava_id (nullable), name, total_km, limit_km, image_url, synced_at
activities    id, strava_id, date, name, distance_km, elapsed_sec, moving_sec,
              avg_hr, elevation_m, relative_effort, gear_id → gear.id
personal_records  label, distance_m, time_sec, date, garmin_activity_id, activity_name
competitions  id, competition, date, distance, time, rank, link, created_at
sync_log      source, status, records_synced, error_detail, started_at, finished_at
```

Migrations are in `migrations/` and applied manually in order. When adding a schema change, create a new numbered migration file — never edit existing ones.

## Frontend conventions

- All UI lives in `src/App.tsx`. Do not split into multiple components unless there is a strong reason.
- Tabs: `home`, `runs`, `yearly`, `gear`, `competitions`, `records`. Adding a tab requires updating `TAB_META`, `Tab` type, and optionally `NAV_TABS`.
- All-time data (gear + yearly chart) is fetched once on mount via `fetchAllTime()` and stored in `allTimeData`. Runs tab has its own date-filtered fetch.
- Error messages go through `friendlyError()` before being shown to the user.
- The gear tab shows edit controls only when `googleCredential` is set (authenticated).
- `handleGoogleSuccess` must clear `addError` and `syncError` so stale messages disappear on re-login.

## Strava sync notes

- Incremental: only fetches activities newer than `MAX(date) - 3 days`.
- Gear is upserted from the athlete's shoe list; `strava_id` is the Strava gear ID (string like `"g12345"`).
- Manually added gear has `strava_id = NULL` (allowed after migration 003).

## What requires a migration

Any `ALTER TABLE` or schema change needs a new file in `migrations/` before the API change ships.
