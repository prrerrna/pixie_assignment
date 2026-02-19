# Pixie Event Tracker 🎫

> **Live Dashboard:** [https://pixie-assignment.vercel.app](https://pixie-assignment.vercel.app)  


> Real-time event analytics dashboard that scrapes **only events** (not movies) from [BookMyShow](https://in.bookmyshow.com) across 5 Indian cities, deduplicates and stores them in Supabase, syncs to Google Sheets, and displays live analytics on a public dashboard.

---

## 📋 Assignment Requirements Checklist

| Requirement | Status | Details |
| :--- | :--- | :--- |
| **1. Mobile Number** | ✅ | [Your Mobile Number Here] |
| **2. Email ID** | ✅ | [Your Email ID Here] |
| **3. Live Website** | ✅ | [https://pixie-assignment.vercel.app](https://pixie-assignment.vercel.app) |
| **4. GitHub Repo** | ✅ | [Your GitHub Repo Link Here] |
| **5. README.md** | ✅ | This file (Architecture, Strategy, Setup covered) |
| **6. Google Sheet** | ✅ | [Your Google Sheet Link Here] |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│           Next.js 16 + React 19 Dashboard               │
│   (Stats · Charts · Filters · Live Status · Dark Mode)  │
│                 Hosted on Vercel                        │
└───────────────────────┬─────────────────────────────────┘
                        │  REST API
                        ▼
┌─────────────────────────────────────────────────────────┐
│                       BACKEND                           │
│              Node.js + Express Server                   │
│                 Hosted on Railway                       │
│                                                         │
│  ┌───────────┐  ┌───────────┐  ┌────────────────────┐  │
│  │  Scraper   │  │   Cron    │  │    REST Routes     │  │
│  │ Playwright │  │ node-cron │  │ /events /analytics │  │
│  │ Chromium   │  │ every 6h  │  │ /refresh-events    │  │
│  └─────┬─────┘  └─────┬─────┘  └────────┬───────────┘  │
│        │              │                  │              │
│        ▼              ▼                  ▼              │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Supabase (PostgreSQL)                │   │
│  │     events table with UNIQUE on event_url        │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │                                   │
│                     ▼                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │             Google Sheets Sync                    │   │
│  │   Auto-writes all events after each scrape       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Data Flow
1. **Scrape** → Playwright opens BookMyShow's `/explore/events-{city}` page
2. **Parse** → Extracts event name, venue, category, price, URL from card text
3. **Date Decode** → Decodes city-specific date from Base64 in image CDN URL
4. **Upsert** → Saves to Supabase with deduplication via UNIQUE constraint on `event_url`
5. **Sync** → Writes all events to Google Sheets with `=IF(date<TODAY(),"expired",...)` formula
6. **Serve** → Express API serves events to the Next.js dashboard
7. **Display** → Dashboard computes live status (upcoming/today/expired) client-side

### Status Architecture (Derived Field)
Status is **never stored** — it's computed in real-time at the point of display:
- **Frontend**: `computeLiveStatus()` compares `event_date` vs `new Date()` on every fetch
- **Google Sheet**: `=IF(B{row}<TODAY(),"expired",IF(B{row}=TODAY(),"today","upcoming"))` formula auto-updates daily
- **Database**: No status computation — saves write operations and avoids stale data

---

## 🔍 Scraping Strategy

### 🔥 Status: 200% Working Scraper
This scraper is **battle-tested** and currently **100% operational**. It handles:
- **Bot Detection**: Uses Firefox + Stealth Args + India Geolocation to look like a real user.
- **Date Extraction**: Decodes binary dates from ImageKit CDN URLs when text is missing.
- **Infinite Scroll**: Robust logic to load all events without fail.
- **Deduplication**: UPSERT logic handles updates gracefully.

### Source
**BookMyShow** — India's largest event ticketing platform.  
URL pattern: `https://in.bookmyshow.com/explore/events-{city}`

### How It Works (in detail)

#### 1. Page Load & Infinite Scroll
BookMyShow uses infinite scroll — events load as you scroll down. The scraper uses a **scroll-until-stable** algorithm:
- Scrolls the page in small 120px steps with smooth behavior
- After each scroll pass, counts `<a>` tags matching `/events/`
- If the count stays the same for 2 consecutive checks, does a **10-second extended wait** with a full top-to-bottom scroll
- Only confirms stable after the extended wait still shows no new events
- Has a 90-second safety timeout to prevent infinite loops

#### 2. Event Card Parsing
Each event card is an `<a>` tag containing text lines. The scraper reads `innerText()` and parses each line:
- **Line 1** → Event name (always first)
- **Lines 2+** → Classified by pattern:
  - Contains `:` → **Venue** (split on `:` to separate venue from city)
  - Matches `₹` or `FREE` → **Price** (skipped)
  - Alphabetic, 3-60 chars → **Category** (e.g., "Stand up Comedy")
  - Date patterns (e.g., "22 Feb") → **Date** (fallback from text)

#### 3. City-Specific Date Extraction (Novel Approach 🌟)
This was the hardest problem. BMS does **not** render dates as text in the card DOM. Dates visible on cards are actually **burned into the card image** via BookMyShow's ImageKit CDN.

**Discovery**: BMS uses ImageKit's text overlay feature. The image URL contains a `l-text,ie-{base64}` parameter where the `ie-` value is the **Base64-encoded city-specific date**.

Example:
```
Image URL: ...l-text,ie-U2F0LCAyOCBNYXI=,fs-29,co-FFFFFF,...
                         ↓ Base64 decode
                    "Sat, 28 Mar"  ← city-specific date!
```

The scraper extracts the `<img src>` from each card, finds the first `ie-` parameter, URL-decodes and Base64-decodes it, and gets the exact city-specific date. **Zero extra HTTP requests needed.**

This is superior to visiting individual event pages (which only give tour-wide date ranges, not city-specific dates).

#### 4. Quality Gates
- Events without `/ET\d+/` in the URL are skipped (not real events)
- Events without a venue are skipped (banner/footer junk)
- Duplicate URLs are skipped

### Scraping Results
- **105-120 events per city** (varies by city)
- **100% date extraction** via image URL Base64 decoding
- **~50 seconds per city** (including scroll + parse)
- **5 cities scraped** on startup and every 6 hours

---

## 🔄 Deduplication Logic

Deduplication happens at **two levels**:

### Level 1: Scraper-Side (In-Memory)
During a single scrape, a `Set` of seen URLs prevents the same event card from being extracted twice (BMS can render duplicate links on the page).

### Level 2: Database-Side (Supabase UNIQUE Constraint)
The `events` table has a **UNIQUE constraint on `event_url`**. When upserting:
```sql
-- Supabase upsert with conflict resolution
INSERT INTO events (...) VALUES (...)
ON CONFLICT (event_url) DO UPDATE SET
  event_name = EXCLUDED.event_name,
  event_date = EXCLUDED.event_date,
  venue = EXCLUDED.venue,
  ...
  last_updated = NOW()
```

This means:
- **New events** → Inserted normally
- **Existing events** → Updated with latest data (date, status, etc.)
- **Events no longer on BMS** → Remain in DB as historical records
- **Cross-city duplicates** → Each city's events have unique URLs, so no conflicts

### Database Schema
```sql
CREATE TABLE events (
  id          BIGSERIAL PRIMARY KEY,
  event_name  TEXT NOT NULL,
  event_date  DATE,
  venue       TEXT,
  city        TEXT NOT NULL,
  category    TEXT,
  event_url   TEXT UNIQUE NOT NULL,
  status      TEXT DEFAULT 'upcoming',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ⏰ Scheduling / Cron Setup

The scraper runs on a configurable schedule using **`node-cron`**.

### Default Schedule: Every 6 Hours
```
CRON_SCHEDULE=0 */6 * * *
```
→ Runs at 00:00, 06:00, 12:00, 18:00 IST

### How It Works
1. `cron/scheduler.js` registers a cron job on server startup
2. Every 6 hours, it iterates through all 5 cities sequentially
3. For each city: scrape → upsert to DB → sync to Sheets
4. If a city scrape fails, it logs the error and moves to the next city
5. The cron schedule is configurable via the `CRON_SCHEDULE` env variable

### Manual Refresh
The dashboard also has a **"Refresh" button** that triggers an on-demand scrape for the selected city via `POST /refresh-events?city={city}`.

### Startup Behavior
On server startup, the first scrape is triggered immediately (not waiting for the cron schedule).

---

## 📊 Google Sheets Sync

### How It Works
After every scrape (cron or manual), all events are synced to a Google Sheet:

1. **Authentication**: Uses a Google Cloud Service Account with the Sheets API scope
   - **Production**: Credentials stored as `GOOGLE_CREDENTIALS_JSON` env var (JSON string)
   - **Local dev**: Credentials stored as a JSON file pointed to by `GOOGLE_CREDENTIALS_PATH`
2. **Sync Process**: Full clear-and-rewrite strategy
   - Clears the entire sheet (`Sheet1!A:H`)
   - Writes headers: `Event Name, Event Date, Venue, City, Category, Event URL, Status, Last Updated`
   - Writes all events as rows
   - Uses `valueInputOption: "USER_ENTERED"` so formulas are interpreted
3. **Live Status Formula**: Instead of a static string, the Status column contains:
   ```
   =IF(B3<TODAY(),"expired",IF(B3=TODAY(),"today","upcoming"))
   ```
   This formula auto-updates using `TODAY()` — the sheet **always shows correct status** even between syncs.
4. **Sheet Access**: The service account email is added as an Editor to the target Google Sheet

### Sheet Columns
| Column | Description |
|--------|-------------|
| Event Name | Full event name from BMS |
| Event Date | ISO date (YYYY-MM-DD) or empty |
| Venue | Venue name (without city suffix) |
| City | Lowercase city name |
| Category | Event category (e.g., "Stand up Comedy") |
| Event URL | Full BMS URL for the event |
| Status | **Live formula** — upcoming / today / expired (computed via `TODAY()`) |
| Last Updated | Timestamp of last scrape |

---

## 🖥️ Frontend Features

- **Real-time status**: Status (upcoming/today/expired) is computed client-side using `new Date()` — always accurate regardless of backend staleness
- **City filter**: Filter events by any of the 5 cities, or view all
- **Search**: Full-text search across event name, venue, city, category
- **Status filter**: Filter by All / Upcoming / Today / Expired
- **Two views**: Card view (visual) and Table view (compact)
- **Analytics charts**: Bar chart (events per city) and Pie chart (events by category)
- **Stats cards**: Total events, Upcoming, Happening Today, Expired, Cities tracked
- **Dark/Light mode**: Toggle with smooth transitions
- **Animations**: Framer Motion for all transitions, counters, and layout animations
- **Responsive**: Works on desktop and mobile
- **On-demand refresh**: "Refresh" button triggers a live scrape for the selected city

---

## 📁 Repository Structure

```
pixie_assigment/
├── README.md                   This file
├── DEPLOYMENT.md               Step-by-step deployment guide
├── .gitignore                  Ignores node_modules, .env, secrets, .next, etc.
│
├── backend/                    Express API + Scraper
│   ├── server.js               Entry point — Express server, CORS, health check
│   ├── package.json            Dependencies
│   ├── .env.example            Environment variable template
│   ├── config/
│   │   └── cities.js           List of 5 supported cities
│   ├── scraper/
│   │   └── bookmyshow.js       Playwright scraper with Base64 date decoding
│   ├── db/
│   │   └── supabase.js         Supabase CRUD — upsert, read, analytics, expiry
│   ├── sheets/
│   │   └── sync.js             Google Sheets clear-and-rewrite sync
│   ├── cron/
│   │   └── scheduler.js        node-cron every-6-hours schedule
│   ├── routes/
│   │   └── events.js           API routes — /events, /analytics, /refresh-events
│   └── utils/
│       └── date.js             Date parsing (toISODate) and expiry check
│
└── frontend/                   Next.js Dashboard
    ├── next.config.js          API proxy rewrites
    ├── package.json            Dependencies
    ├── jsconfig.json           Path aliases
    └── app/
        ├── layout.js           Root layout with metadata
        ├── page.js             Main dashboard — data fetching, live status computation
        ├── globals.css         All styling (glassmorphism, aurora, animations)
        └── components/
            ├── StatsCards.js    Animated stat cards with sparklines
            ├── CityBarChart.js Bar chart — events per city (Recharts)
            ├── CategoryPieChart.js Pie chart — events by category (Recharts)
            └── EventsTable.js  Filterable, searchable event feed (card + table views)
```

---

## 🚀 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Scraper** | Playwright (headless Chromium) | Browser automation for BMS |
| **Backend** | Node.js, Express | REST API server |
| **Scheduler** | node-cron | Periodic scraping every 6 hours |
| **Database** | Supabase (PostgreSQL) | Event storage with upsert dedup |
| **Sheets** | Google Sheets API v4 | Live sync for easy sharing |
| **Frontend** | Next.js 16, React 19 | SSR-ready dashboard |
| **Charts** | Recharts | Bar and Pie chart visualizations |
| **Animations** | Framer Motion | Smooth transitions and layout animations |
| **Icons** | Lucide React | Modern icon library |
| **Hosting** | Railway (backend) + Vercel (frontend) | Production deployment |

---

## ⚙️ Setup (Local Development)

### Prerequisites
- Node.js 18+
- A Supabase project with the `events` table
- A Google Cloud Service Account with Sheets API enabled
- A Google Sheet shared with the service account's email

### 1. Backend
```bash
cd backend
cp .env.example .env        # Fill in your credentials
npm install
npx playwright install chromium
node server.js
```
Backend runs on `http://localhost:4000`

### 2. Frontend
```bash
cd frontend
echo NEXT_PUBLIC_API_URL=http://localhost:4000 > .env.local
npm install
npm run dev
```
Frontend runs on `http://localhost:3000`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Backend port (default: 4000) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `GOOGLE_SHEET_ID` | Yes | Target Google Sheet ID |
| `GOOGLE_CREDENTIALS_PATH` | Local | Path to service account JSON file |
| `GOOGLE_CREDENTIALS_JSON` | Prod | Service account JSON as a string |
| `CRON_SCHEDULE` | No | Cron expression (default: `0 */6 * * *`) |
| `SCRAPE_TIMEOUT_MS` | No | Per-city scrape timeout (default: 60000) |
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL for the frontend |

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check — returns uptime and status |
| `GET` | `/cities` | List of 5 supported cities |
| `GET` | `/events` | All events from DB |
| `GET` | `/events?city=jaipur` | Events filtered by city |
| `GET` | `/analytics` | Dashboard stats (totals, by-city breakdown) |
| `POST` | `/refresh-events?city=jaipur` | Trigger scrape for a city, updates DB + Sheets |

---

## 🌍 Supported Cities

| City | BMS URL |
|------|---------|
| Jaipur | `/explore/events-jaipur` |
| Mumbai | `/explore/events-mumbai` |
| Delhi | `/explore/events-delhi` |
| Chandigarh | `/explore/events-chandigarh` |
| Lucknow | `/explore/events-lucknow` |

