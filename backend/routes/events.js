const express = require("express");
const { cities } = require("../config/cities");
const { upsertEvents, readEvents, getAnalytics } = require("../db/supabase");
const { scrapeBookMyShow } = require("../scraper/bookmyshow");
const { syncToSheets } = require("../sheets/sync");

const router = express.Router();

/**
 * Scrape a city, save to Supabase, sync to Google Sheets.
 */
const refreshCityEvents = async (city) => {
  try {
    // 1. Scrape
    const scraped = await scrapeBookMyShow(city, Number(process.env.SCRAPE_TIMEOUT_MS || 60000));

    // 2. Save to Supabase
    await upsertEvents(scraped);

    // 3. Read back city events (status computed client-side)
    const cityEvents = await readEvents(city);

    // 5. Sync ALL events to Google Sheets (async, don't block response)
    readEvents().then((allEvents) => syncToSheets(allEvents)).catch(console.error);

    return { source: "scrape", events: cityEvents };
  } catch (err) {
    console.error(`Scrape failed for ${city}:`, err.message);
    // Fallback: return cached data from Supabase
    try {
      const cached = await readEvents(city);
      return { source: "cache", events: cached };
    } catch (dbErr) {
      return { source: "cache", events: [] };
    }
  }
};

// GET /cities
router.get("/cities", (req, res) => {
  res.json({ cities });
});

// GET /events?city=jaipur
router.get("/events", async (req, res) => {
  try {
    const city = (req.query.city || "").toLowerCase() || null;
    const events = await readEvents(city);
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: "Failed to read events", details: err.message });
  }
});

// GET /analytics
router.get("/analytics", async (req, res) => {
  try {
    const analytics = await getAnalytics();
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: "Failed to get analytics", details: err.message });
  }
});

// POST /refresh-events?city=jaipur
router.post("/refresh-events", async (req, res) => {
  const city = (req.query.city || "").toLowerCase();
  if (!city || !cities.includes(city)) {
    return res.status(400).json({ error: "Invalid city", validCities: cities });
  }
  try {
    const result = await refreshCityEvents(city);
    return res.json({
      refreshed: result.events.length,
      events: result.events,
      source: result.source,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to refresh events", details: err.message });
  }
});

module.exports = { router, refreshCityEvents };
