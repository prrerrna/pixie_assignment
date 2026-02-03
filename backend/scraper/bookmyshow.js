const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer-core");
const { toISODate } = require("../utils/date");

const buildUrl = (city) => `https://in.bookmyshow.com/explore/events-${city}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseJsonLd = ($, city) => {
  const events = [];
  $("script[type='application/ld+json']").each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const json = JSON.parse(raw);
      const nodes = Array.isArray(json) ? json : [json];
      nodes.forEach((node) => {
        if (!node) return;
        if (node["@type"] === "Event") {
          const isoDate = toISODate(node.startDate);
          events.push({
            event_name: node.name || "",
            event_date: isoDate || node.startDate || "",
            venue: node.location?.name || node.location?.address?.streetAddress || "",
            city,
            category: node.category || node.eventType || "events",
            event_url: node.url || ""
          });
        }
        if (node["@type"] === "ItemList" && Array.isArray(node.itemListElement)) {
          node.itemListElement.forEach((item) => {
            const event = item?.item;
            if (event?.["@type"] !== "Event") return;
            const isoDate = toISODate(event.startDate);
            events.push({
              event_name: event.name || "",
              event_date: isoDate || event.startDate || "",
              venue: event.location?.name || event.location?.address?.streetAddress || "",
              city,
              category: event.category || event.eventType || "events",
              event_url: event.url || ""
            });
          });
        }
      });
    } catch (err) {
      // ignore JSON parse errors
    }
  });
  return events.filter((event) => event.event_url);
};

const extractEventFromObject = (node, city) => {
  if (!node || typeof node !== "object") return null;
  const type = node["@type"];
  const isEventType = Array.isArray(type) ? type.includes("Event") : type === "Event";
  const hasEventShape = node.name && node.startDate && node.url;
  if (!isEventType && !hasEventShape) return null;

  const isoDate = toISODate(node.startDate);
  return {
    event_name: node.name || "",
    event_date: isoDate || node.startDate || "",
    venue: node.location?.name || node.location?.address?.streetAddress || "",
    city,
    category: node.category || node.eventType || node.genre || "events",
    event_url: node.url || ""
  };
};

const collectEventsFromObject = (node, city, out) => {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectEventsFromObject(item, city, out));
    return;
  }
  if (typeof node === "object") {
    const event = extractEventFromObject(node, city);
    if (event?.event_url) out.push(event);
    Object.keys(node).forEach((key) => collectEventsFromObject(node[key], city, out));
  }
};

const parseNextData = ($, city) => {
  const raw = $("#__NEXT_DATA__").text();
  if (!raw) return [];
  try {
    const json = JSON.parse(raw);
    const events = [];
    collectEventsFromObject(json, city, events);
    return events.filter((event) => event.event_url);
  } catch (err) {
    return [];
  }
};

const parseCards = ($, city) => {
  const events = [];
  $("a[href*='/events/']").each((_, el) => {
    const link = $(el).attr("href");
    if (!link) return;
    const url = link.startsWith("http") ? link : `https://in.bookmyshow.com${link}`;
    const name = $(el).find("h3, h4, .__event-name, .___event-name").first().text().trim();
    const dateText = $(el).find(".__date, .__event-date, time").first().text().trim();
    const venue = $(el).find(".__event-venue, .__venue, .__location, .__event-location").first().text().trim();
    const category = $(el).find(".__event-type, .__category").first().text().trim() || "events";

    if (!name) return;
    events.push({
      event_name: name,
      event_date: dateText,
      venue,
      city,
      category,
      event_url: url
    });
  });
  return events;
};

const getHtmlWithAxios = async (url, timeoutMs) => {
  const response = await axios.get(url, {
    timeout: timeoutMs,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-IN,en;q=0.9",
      Referer: "https://in.bookmyshow.com/",
      DNT: "1",
      "Upgrade-Insecure-Requests": "1"
    }
  });
  return response.data;
};

const findChromeExecutable = () => {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return "";
};

const getHtmlWithPuppeteer = async (url, timeoutMs) => {
  const executablePath = findChromeExecutable();
  if (!executablePath) {
    throw new Error("Chrome not found. Set CHROME_PATH in .env");
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled"
    ]
  });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "languages", { get: () => ["en-IN", "en"] });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-IN,en;q=0.9",
      Referer: "https://in.bookmyshow.com/"
    });
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForSelector("script[type='application/ld+json'],#__NEXT_DATA__", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
    return await page.content();
  } finally {
    await browser.close();
  }
};

const withRetry = async (fn, attempts = 2) => {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await sleep(1000 * (i + 1));
    }
  }
  throw lastError;
};

const scrapeBookMyShow = async (city, timeoutMs = 20000) => {
  const url = buildUrl(city);
  let html = "";
  try {
    html = await withRetry(() => getHtmlWithPuppeteer(url, timeoutMs + 10000), 2);
  } catch (error) {
    html = await withRetry(() => getHtmlWithAxios(url, timeoutMs), 2);
  }

  const $ = cheerio.load(html);
  const fromJsonLd = parseJsonLd($, city);
  const fromNext = parseNextData($, city);
  const fromCards = parseCards($, city);

  const merged = [...fromJsonLd, ...fromNext, ...fromCards];
  const unique = new Map();
  merged.forEach((event) => {
    if (!event.event_url) return;
    if (!unique.has(event.event_url)) unique.set(event.event_url, event);
  });

  return Array.from(unique.values());
};

module.exports = { scrapeBookMyShow };
