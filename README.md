# McRun

Personal running stats dashboard. Pulls activities from Strava and health/records from Garmin, stores everything in PostgreSQL, displays it as a React SPA deployed on Vercel.

## Features

| Tab            | Description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| Home           | Landing page                                                             |
| Run History    | All runs with date, distance, pace, HR, elevation, relative effort, gear |
| Yearly Mileage | SVG chart of km per year across all time                                 |
| Gear           | Shoes with total km, wear limit and wear % (colour-coded)                |
| Records        | Garmin personal records: 1 km, 1 mi, 5k, 10k, Half, Marathon             |
| Competitions   | Race log with results — visible and editable after Google sign-in        |
| Health         | Garmin fitness/recovery metrics — visible after Google sign-in           |
| Goals          | Season goals — visible after Google sign-in                              |

Authenticated users (single allowed email) can also sync Strava/Garmin, edit competitions/goals and manage gear directly in the UI.

## Stack

- **Frontend** — React 18 + TypeScript + Vite, deployed as Vercel static output
- **Backend** — Python serverless functions in `api/` (Vercel Functions)
- **Database** — PostgreSQL (Vercel Postgres / any `POSTGRES_URL`)
- **Auth** — Google OAuth 2.0 (ID token verified server-side; single-user via `ALLOWED_EMAIL`)

## Project structure

```
api/                Python serverless endpoints (one file = one route)
  _db.py            DB connection, token verification, JSON helper
  stats.py          GET   /api/stats             — activities + gear summary
  gear.py           POST  /api/gear              — add shoe
                    PATCH /api/gear              — edit shoe
  competitions.py   GET/POST/PATCH /api/competitions
  goals.py          GET/POST/PATCH /api/goals
  records.py        GET   /api/records           — Garmin personal records
  garmin_metrics.py GET   /api/garmin_metrics    — health & fitness metrics
  garmin_calendar.py GET  /api/garmin_calendar   — planned workouts
  garmin_status.py  GET   /api/garmin_status     — Garmin device/sync status
  sync_strava.py    POST  /api/sync_strava       — incremental Strava sync
  sync_garmin.py    POST  /api/sync_garmin       — Garmin records + metrics sync
  sync_status.py    GET   /api/sync_status       — last sync timestamps
  cron_sync.py      POST  /api/cron_sync         — scheduled auto-sync

src/
  App.tsx           All state, data fetching, routing
  App.css           All styles
  constants.tsx     Tab metadata, nav config
  types.ts          Shared TypeScript types
  utils.ts          Pure helpers (+ utils.test.ts)
  components/
    tabs/           One presentational component per tab (HomeTab, RunsTab, …)

tests/              Python tests (pytest)
conftest.py         Adds api/ to sys.path for tests
migrations/         SQL files applied manually in order
  001–014_*.sql
```

## Environment variables

| Variable                     | Used by        | Purpose                                                  |
| ---------------------------- | -------------- | ------------------------------------------------------- |
| `POSTGRES_URL`               | api            | PostgreSQL connection string                            |
| `POSTGRES_URL_NON_POOLING`   | api            | Non-pooling URL — preferred; used when set               |
| `CLIENT_ID`                  | sync_strava    | Strava app client ID                                    |
| `CLIENT_SECRET`              | sync_strava    | Strava app client secret                                |
| `REFRESH_TOKEN`              | sync_strava    | Strava refresh token                                    |
| `GARMIN_EMAIL` / `GARMIN_PASSWORD` | sync_garmin | Garmin Connect credentials                          |
| `GARMIN_TOTP_SECRET`         | sync_garmin    | Optional — only if Garmin MFA is enabled                 |
| `GOOGLE_CLIENT_ID`           | api            | Google OAuth client ID (server-side verification)       |
| `ALLOWED_EMAIL`              | api            | Only this email is granted access to authed endpoints   |
| `VITE_GOOGLE_CLIENT_ID`      | frontend build | Google OAuth client ID (exposed to browser)             |
| `CRON_SECRET` / `APP_URL`    | GitHub Actions | Auth + target for the hourly `/api/cron_sync` trigger    |

Copy `.env.example` to `.env.local` for local development. If your Postgres env
vars carry a provider prefix (e.g. Vercel's `mcrun_db_*`), also expose them
un-prefixed as `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`.

## Local development

```bash
npm install
vercel dev          # starts Vite + Python functions on http://localhost:3000
```

Requires [Vercel CLI](https://vercel.com/docs/cli) and Python 3 (`pip install -r requirements-dev.txt`).

`npm run dev` (Vite alone) proxies `/api` to `http://localhost:3000` — i.e. `vercel dev`
must be running. To point the proxy at a deployed environment instead (read-only!),
set `VITE_API_PROXY=https://…` before `npm run dev`.

## Tests

```bash
npm test              # frontend (vitest)
python -m pytest      # backend (pytest)
```

Both run in CI (`.github/workflows/ci.yml`) on every push and PR.

## Database setup

Apply pending migrations (tracked in a `schema_migrations` table, safe to re-run):

```bash
DATABASE_URL=postgres://user:pass@host/db ./migrations/run.sh
```

Or apply a single file by hand: `psql $DATABASE_URL -f migrations/001_schema.sql`.

## Deploy

```bash
vercel --prod
```

Add all environment variables in Vercel → Project → Settings → Environment Variables before the first deploy.
