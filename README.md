# Pixie Event Discovery & Tracking Tool

## Product summary
Pixie’s ops team uses this dashboard to proactively identify event opportunities for photobooth outreach by refreshing event listings, tracking status, and exporting the latest Excel sheet.

## Tech decisions
- Platform: BookMyShow (public event listings and stable city-based URLs).
- Scraper: Puppeteer-core + Cheerio (uses local Chrome for reliable scraping, then parses HTML).
- Storage: Excel (.xlsx) as the single source of truth (no database).

## Repository structure
- backend/: Express API, scraper, scheduler, Excel storage
- client/: React admin dashboard

## Setup
### One-command start (recommended)
```bash
npm install
npm run install:all
npm start
```
This runs backend + frontend together.

### 1) Backend
```bash
cd backend
npm install
npm start
```
Backend runs on http://localhost:4000

### 2) Frontend
```bash
cd client
npm install
npm start
```
Frontend runs on http://localhost:5173

## Environment
Copy backend/.env.example to backend/.env and adjust as needed.
Add CHROME_PATH if Chrome is installed in a custom location. Example:
CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

## How it works
- `GET /cities` returns supported cities.
- `GET /events?city={city}` reads events from Excel.
- `POST /refresh-events?city={city}` scrapes BookMyShow, deduplicates by `event_url`, updates rows, and marks expired events.
- A cron job runs the same refresh logic on a schedule (default: every 6 hours).

## Excel sheet structure
Columns: event_name, event_date, venue, city, category, event_url, status, last_updated

## Supported cities (5)
jaipur, mumbai, delhi, chandigarh, lucknow

## Deduplication & expiry
- Deduplication uses `event_url` as unique key.
- If `event_date` is before today, status becomes `expired`.

## How to validate (quick demo)
1. Start backend and frontend.
2. In the UI, pick a city and click “Refresh Events”.
3. Observe updated rows and status badges.
4. Open backend/data/events.xlsx to verify persisted data.

Note: On first run, the Excel sheet is pre-filled with one sample event per city so the UI shows data immediately.

## What I would do next (if more time)
- Add fallback to a headless browser for stronger scraping resilience.
- Add alerting/monitoring for failed cron runs.
- Expand to multiple platforms with a unified schema.

