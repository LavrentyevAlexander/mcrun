# CLAUDE.md — McRun

Project context and conventions for Claude Code.

## What this project is

Personal running dashboard for one user. React SPA (`src/App.tsx` holds all state and data fetching; one presentational component per tab under `src/components/tabs/`) + Python serverless functions (`api/*.py`) deployed on Vercel. PostgreSQL as the only data store.

## Architecture

All API routes live in `api/`. Vercel maps each file to `/api/<filename>`. There is no framework — each file defines a `handler` class extending `BaseHTTPRequestHandler`.

Shared utilities are in `api/_db.py`:
- `get_conn()` — psycopg2 connection from `POSTGRES_URL_NON_POOLING` (falls back to `POSTGRES_URL`)
- `verify_token(headers)` — validates Google ID token and checks `ALLOWED_EMAIL`; raises `PermissionError` on failure
- `read_json_body(handler)` — parses the request body; raises `BadRequest` (→ HTTP 400) on malformed JSON
- `send_json(handler, status, data)` — writes JSON response
- `send_error(handler, exc)` — logs the real exception server-side, returns a non-leaking message (use in the catch-all `except Exception`)

Authentication + error-handling pattern (follow this in every write endpoint):
```python
def do_POST(self):
    try:
        verify_token(self.headers)
        payload = read_json_body(self)
        ...
    except PermissionError as e:
        send_json(self, 401, {"error": str(e)})
    except BadRequest as e:
        send_json(self, 400, {"error": str(e)})
    except Exception as e:
        send_error(self, e)
```

The frontend stores the Google credential JWT in `localStorage` and sends it as `Authorization: Bearer <token>`.

## Key files

| File                     | Role                                                              |
|--------------------------|------------------------------------------------------------------|
| `src/App.tsx`            | All frontend state, data fetching, routing. No JSX beyond tab wiring. |
| `src/components/tabs/`    | One presentational component per tab (props in, no fetching).    |
| `src/components/`         | Shared UI: `Navbar`, `Drawer`, `Skeleton`, chart components.     |
| `src/constants.tsx`      | `TAB_META`, `NAV_TABS`, `LOGOS`.                                 |
| `src/utils.ts`           | Pure helpers (`friendlyError`, `isTokenExpired`, date/format).   |
| `src/App.css`            | All styles. CSS variables defined at `:root` in `src/index.css`. |
| `api/_db.py`             | Shared DB/auth/request helpers.                                  |
| `api/stats.py`           | Main read endpoint — activities + gear summary (+ CSV export).   |
| `api/gear.py`            | Gear CRUD (POST add, PATCH update). Requires auth.               |
| `api/competitions.py`    | Competition CRUD. Requires auth.                                 |
| `api/sync_strava.py`     | Incremental Strava sync + CTL fitness recompute. Requires auth.  |
| `api/sync_garmin.py`     | Garmin records + health metrics sync. Requires auth.             |
| `tests/`                 | Python tests (pytest). Frontend tests live next to `src/utils.ts`. |

## Database schema (summary)

```
gear          id, strava_id (nullable), name, total_km, limit_km, image_url, synced_at
activities    id, strava_id, date, name, distance_km, elapsed_sec, moving_sec,
              avg_hr, elevation_m, relative_effort, gear_id → gear.id
personal_records  label, distance_m, time_sec, date, garmin_activity_id, activity_name
competitions  id, competition, date, distance, time, rank, link, created_at
sync_log      source, status, records_synced, error_detail, started_at, finished_at
```

Migrations are in `migrations/`, applied in filename order by `migrations/run.sh` (tracked in a `schema_migrations` table). When adding a schema change, create a new numbered migration file — never edit existing ones.

## Frontend conventions

- `src/App.tsx` owns **all** state, effects and `fetch` calls. Tab components in `src/components/tabs/` are presentational — they receive data and callbacks as props and never fetch. Keep new data-fetching logic in `App.tsx`; add a component only when a tab needs its own markup.
- Tabs: `home`, `runs`, `yearly`, `gear`, `health`, `calendar`, `competitions`, `goals`, `records`. Adding a tab requires updating `TAB_META`, the `Tab` type, `VALID_TABS`, and optionally `NAV_TABS`.
- All-time data (gear + yearly chart) is fetched once on mount via `fetchAllTime()` and stored in `allTimeData`. Runs tab has its own date-filtered fetch.
- Error messages go through `friendlyError()` before being shown to the user. Each tab has its own `*Error` state — never reuse another tab's error setter.
- Auth-only tabs (`competitions`, `goals`, `health`) live behind the profile menu, not `NAV_TABS`, and the tab body shows a sign-in prompt when `googleCredential` is unset.
- The stored Google credential is purged on mount when `isTokenExpired()` — reactive 401s via `handle401()` are the fallback.
- `handleGoogleSuccess` must clear `addError` and `syncError` so stale messages disappear on re-login.

## Strava sync notes

- Incremental: only fetches activities newer than `MAX(date) - 3 days`.
- Gear is upserted from the athlete's shoe list; `strava_id` is the Strava gear ID (string like `"g12345"`).
- Manually added gear has `strava_id = NULL` (allowed after migration 003).
- The CTL fitness recompute (`_recompute_fitness`) re-fetches the full Strava history, so it only runs when the activity count grew or some rows lack `fitness_score` — not on every no-op cron tick.
- All outbound `requests` calls pass `timeout=30`.

## Tests & CI

- Frontend: `npm test` (vitest) — pure helpers in `src/utils.ts`. `npm run build` also type-checks (`tsc -b`).
- Backend: `python -m pytest` — CTL math and `api/_db.py` helpers. Config in `pytest.ini`; `conftest.py` puts `api/` on the path. Install with `pip install -r requirements-dev.txt`.
- `.github/workflows/ci.yml` runs both on push/PR. `sync.yml` is unrelated (hourly cron trigger).
- Python test files must NOT live in `api/` — Vercel turns every `api/*.py` into a deployed function.

## What requires a migration

Any `ALTER TABLE` or schema change needs a new file in `migrations/` before the API change ships.
