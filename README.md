# McRun Strava Stats

Web app that shows your running statistics from Strava: runs table with distance/duration and gear summary with total km per shoe.

## Stack

- **Backend**: Python serverless function on Vercel (Strava API)
- **Frontend**: React + TypeScript + Vite

## Setup

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Set environment variables. For local dev, create `.env` based on `.env.example`:

```
CLIENT_ID=your_strava_client_id
CLIENT_SECRET=your_strava_client_secret
REFRESH_TOKEN=your_strava_refresh_token
```

3. Run locally with Vercel CLI:

```bash
vercel dev
```

4. Open `http://localhost:3000`, pick a start date and click **Load**.

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Add `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN` in Vercel → Settings → Environment Variables.
4. Deploy.

## CLI usage (legacy)

The original CLI script is still available:

```bash
pip install -r requirements.txt python-dotenv tabulate
python main.py
```
