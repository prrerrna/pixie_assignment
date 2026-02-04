const express = require("express");
const { cities } = require("../config/cities");
const { readEvents, upsertEvents, ensureFile, refreshExpiry } = require("../storage/excelStore");
const { scrapeBookMyShow } = require("../scraper/bookmyshow");

const router = express.Router();

const getDataFile = () => process.env.DATA_FILE || "./data/events.xlsx";

const refreshCityEvents = async (city) => {
  const filePath = getDataFile();
  ensureFile(filePath);
  try {
    const scraped = await scrapeBookMyShow(city, Number(process.env.SCRAPE_TIMEOUT_MS || 20000));
    try {
      const updated = upsertEvents(filePath, scraped);
      return { source: "scrape", events: updated.filter((event) => event.city.toLowerCase() === city.toLowerCase()) };
    } catch (error) {
      const cached = readEvents(filePath);
      return {
        source: "cache",
        events: cached.filter((event) => event.city.toLowerCase() === city.toLowerCase())
      };
    }
  } catch (error) {
    try {
      const updated = refreshExpiry(filePath);
      return {
        source: "cache",
        events: updated.filter((event) => event.city.toLowerCase() === city.toLowerCase())
      };
    } catch (writeError) {
      const cached = readEvents(filePath);
      return {
        source: "cache",
        events: cached.filter((event) => event.city.toLowerCase() === city.toLowerCase())
      };
    }
  }
};

router.get("/cities", (req, res) => {
  res.json({ cities });
});

router.get("/events", (req, res) => {
  const city = (req.query.city || "").toString().toLowerCase();
  const filePath = getDataFile();
  const events = readEvents(filePath);
  const filtered = city ? events.filter((event) => event.city.toLowerCase() === city) : events;
  res.json({ events: filtered });
});

router.post("/refresh-events", async (req, res) => {
  const city = (req.query.city || "").toString().toLowerCase();
  if (!city || !cities.includes(city)) {
    return res.status(400).json({ error: "Invalid city" });
  }
  try {
    const result = await refreshCityEvents(city);
    return res.json({
      refreshed: result.events.length,
      events: result.events,
      source: result.source,
      refreshedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to refresh events", details: error.message });
  }
});

module.exports = { router, refreshCityEvents };
