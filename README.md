# McRun

Personal running stats dashboard. Pulls activities from Strava and personal records from Garmin, stores everything in PostgreSQL, displays it as a React SPA deployed on Vercel.

## Features

| Tab            | Description                                                              |
|----------------|--------------------------------------------------------------------------|
| Home           | Landing page                                                             |
| Run History    | All runs with date, distance, pace, HR, elevation, relative effort, gear |
| Yearly Mileage | SVG chart of km per year across all time                                 |
| Gear           | Shoes with total km, wear limit and wear % (colour-coded)                |
| Records        | Garmin personal records: 1 km, 1 mi, 5k, 10k, Half, Marathon             |
| Competitions   | Race log with results — visible and editable after Google sign-in        |

Authenticated users (single allowed email) can also sync Strava/Garmin, edit competitions and manage gear directly in the UI.

## Stack

- **Frontend** — React 18 + TypeScript + Vite, deployed as Vercel static output
- **Backend** — Python serverless functions in `api/` (Vercel Functions)
- **Database** — PostgreSQL (Vercel Postgres / any `POSTGRES_URL`)
- **Auth** — Google OAuth 2.0 (ID token verified server-side; single-user via `ALLOWED_EMAIL`)

## Project structure

```
api/              Python serverless endpoints (one file = one route)
  _db.py          DB connection, token verification, JSON helper
  stats.py        GET  /api/stats        — activities + gear summary
  gear.py         POST /api/gear         — add shoe
                  PATCH /api/gear        — edit shoe
  competitions.py GET/POST/PATCH /api/competitions
  records.py      GET  /api/records      — Garmin personal records
  sync_strava.py  POST /api/sync_strava  — incremental Strava sync
  sync_garmin.py  POST /api/sync_garmin  — Garmin records sync
  sync_status.py  GET  /api/sync_status  — last sync timestamps

src/
  App.tsx         Entire frontend (single-file SPA)
  App.css         All styles

migrations/       SQL files applied manually in order
  001_schema.sql
  002_gear_image_url.sql
  003_gear_nullable_strava_id.sql
```

## Environment variables

| Variable                            | Used by        | Purpose                                           |
|-------------------------------------|----------------|---------------------------------------------------|
| `mcrun_db_POSTGRES_URL`             | api            | PostgreSQL connection string                      |
| `mcrun_db_POSTGRES_URL_NON_POOLING` | api            | Non-pooling URL (preferred for serverless)        |
| `CLIENT_ID`                         | sync_strava    | Strava app client ID                              |
| `CLIENT_SECRET`                     | sync_strava    | Strava app client secret                          |
| `REFRESH_TOKEN`                     | sync_strava    | Strava refresh token                              |
| `GOOGLE_CLIENT_ID`                  | api            | Google OAuth client ID (server-side verification) |
| `ALLOWED_EMAIL`                     | api            | Only this email is granted write access           |
| `VITE_GOOGLE_CLIENT_ID`             | frontend build | Google OAuth client ID (exposed to browser)       |

Copy `.env.example` to `.env.local` for local development.

## Local development

```bash
npm install
vercel dev          # starts Vite + Python functions on http://localhost:3000
```

Requires [Vercel CLI](https://vercel.com/docs/cli) and Python 3 with `psycopg2`, `requests`, and `google-auth` installed.

## Database setup

Apply migrations in order against your PostgreSQL instance:

```bash
psql $DATABASE_URL -f migrations/001_schema.sql
psql $DATABASE_URL -f migrations/002_gear_image_url.sql
psql $DATABASE_URL -f migrations/003_gear_nullable_strava_id.sql
```

## Deploy

```bash
vercel --prod
```

Add all environment variables in Vercel → Project → Settings → Environment Variables before the first deploy.
