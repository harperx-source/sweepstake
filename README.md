# World Cup 2026 Sweepstake Site

Dark-themed static MVP for the sweepstake.

## Run locally
Open `index.html`, or run:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000

The local site uses `data/fixtures.json` and `data/results-overrides.json` if no live API endpoint is available.

## Deploy free
Upload this folder to GitHub and connect it to Vercel or Netlify.

## Live results automation
The front end now tries to load `/api/worldcup` first, then safely falls back to the local JSON data.

The serverless endpoint uses the free WorldCupJSON API at `worldcupjson.net`, so no API key is required.

It reads:

- `https://worldcupjson.net/matches` for fixtures, live states and scores.
- `https://worldcupjson.net/teams` for group table data when available.

Optional environment variable:

```bash
WORLDCUP_JSON_BASE_URL=https://worldcupjson.net
```

The endpoint normalises WorldCupJSON data into the app's own fixture and standings format. If WorldCupJSON is down or returns unexpected data, the site keeps using the local schedule and `data/results-overrides.json`.

## Data
- `data/allocations.json` contains players and teams.
- `data/fixtures.json` contains the group fixture calendar.
- `data/results-overrides.json` is the resilience fallback for any API mismatch.

Use `data/results-overrides.json` for emergency corrections if a provider has a naming mismatch or late result.
