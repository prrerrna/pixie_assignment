/**
 * BookMyShow Event Scraper
 *
 * Key capabilities:
 *  - Headless Chromium (production-safe, override with HEADLESS=false for debugging)
 *  - Scroll-until-stable: keeps scrolling until no new events appear
 *  - Robust text-line parsing for name, category, venue
 *  - City-specific dates decoded from Base64 in image CDN URLs
 *    (BMS uses ImageKit text overlay: l-text,ie-{base64-date})
 *  - Status (upcoming / expired) computed at scrape time
 *  - Quality gates: drops banner/footer cards (no venue = not a real event)
 */

const { chromium } = require("playwright");
const { toISODate } = require("../utils/date");

/* ── Configuration ────────────────────────────────────────────────────── */
const CONFIG = {
  SCROLL_STEP_PX: 120,
  SCROLL_DELAY_MS: 80,
  STABLE_INTERVAL_MS: 2000,
  LONG_WAIT_MS: 10000,
  INITIAL_WAIT_MS: 3000,
  FINAL_WAIT_MS: 2000,
  MAX_SCROLL_TIME_MS: 90000,
};

const buildUrl = (city) => `https://in.bookmyshow.com/explore/events-${city}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Scroll Until Stable ──────────────────────────────────────────────── */
const scrollUntilStable = async (page) => {
  console.log("\n🔄 Scrolling until all events loaded...\n");

  const t0 = Date.now();
  let prevCount = 0;
  let stableRounds = 0;

  while (true) {
    const elapsed = Date.now() - t0;
    if (elapsed > CONFIG.MAX_SCROLL_TIME_MS) {
      console.log("   ⏱️ Max scroll time reached");
      break;
    }

    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const currentPos = await page.evaluate(() => window.scrollY);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const target = scrollHeight - viewportHeight;

    let pos = currentPos;
    const chunkEnd = Math.min(pos + viewportHeight * 2, target);
    while (pos < chunkEnd) {
      pos = Math.min(pos + CONFIG.SCROLL_STEP_PX, chunkEnd);
      await page.evaluate((p) => window.scrollTo({ top: p, behavior: "smooth" }), pos);
      await sleep(CONFIG.SCROLL_DELAY_MS);
    }

    await sleep(CONFIG.STABLE_INTERVAL_MS);

    const count = await page.locator('a[href*="/events/"]').count();
    const sec = ((Date.now() - t0) / 1000).toFixed(0);

    if (count === prevCount) {
      stableRounds++;
      console.log(`   ${sec}s — ${count} links (stable ${stableRounds})`);

      if (stableRounds === 2) {
        console.log(`   ⏳ Waiting 10s for any late-loading events...`);
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(1000);
        const fullHeight = await page.evaluate(() => document.body.scrollHeight);
        await page.evaluate((h) => window.scrollTo({ top: h, behavior: "smooth" }), fullHeight);
        await sleep(CONFIG.LONG_WAIT_MS);

        const finalCount = await page.locator('a[href*="/events/"]').count();
        if (finalCount === count) {
          console.log(`   ✅ Confirmed stable at ${finalCount} links. All loaded.\n`);
          break;
        } else {
          console.log(`   🔄 Found ${finalCount - count} more! Continuing...`);
          prevCount = finalCount;
          stableRounds = 0;
        }
      }
    } else {
      stableRounds = 0;
      console.log(`   ${sec}s — ${count} links (+${count - prevCount} new)`);
      prevCount = count;
    }
  }

  await sleep(CONFIG.FINAL_WAIT_MS);
  const total = await page.locator('a[href*="/events/"]').count();
  console.log(`✓ Scroll complete: ${total} links found\n`);
  return total;
};

/* ── Decode city-specific date from image URL ─────────────────────────── */
/**
 * BMS uses ImageKit CDN with text overlays. The image URL contains:
 *   l-text,ie-{base64-encoded-date},fs-29,co-FFFFFF,...
 *
 * The first `ie-` parameter is the city-specific date, e.g.:
 *   ie-U2F0LCAyOCBNYXI%3D  →  Base64("Sat, 28 Mar")
 *   ie-U3VuLCAyMiBGZWI%3D  →  Base64("Sun, 22 Feb")
 *
 * This is the ACTUAL city date (not the tour range), rendered as
 * a white text overlay on the bottom of the card image.
 */
const decodeDateFromImageUrl = (imgSrc) => {
  if (!imgSrc) return "";

  try {
    // URL-decode the src first
    const decoded = decodeURIComponent(imgSrc);

    // Find the first ie- parameter (the date overlay text)
    // Pattern: ie-{base64},  or  ie-{base64}: (ends at comma/colon/end)
    const match = decoded.match(/l-text,ie-([A-Za-z0-9+/=]+)/);
    if (!match) return "";

    // Base64 decode
    const dateText = Buffer.from(match[1], "base64").toString("utf8");

    // Validate it looks like a date (e.g. "Sat, 28 Mar", "Sun, 22 Feb onwards")
    if (/\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(dateText) ||
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}/i.test(dateText) ||
      /^(mon|tue|wed|thu|fri|sat|sun)/i.test(dateText)) {
      return dateText;
    }

    return "";
  } catch {
    return "";
  }
};

/* ── Parse one event card ─────────────────────────────────────────────── */
const parseEventCard = (lines, city) => {
  const event = {
    event_name: "",
    event_date: "",
    venue: "",
    city: city.toLowerCase(),
    category: "",
    event_url: "",
    status: "upcoming",
  };

  if (!lines.length) return event;
  event.event_name = lines[0].trim();

  let dateFound = false;
  let venueFound = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("₹") || line.toUpperCase() === "FREE" || /^\d+$/.test(line)) {
      continue;
    }

    const looksLikeDate =
      /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line) ||
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}/i.test(line) ||
      /onwards?$/i.test(line) ||
      /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,/i.test(line) ||
      /^today$/i.test(line) ||
      /^tomorrow$/i.test(line) ||
      /^multiple\s+dates?$/i.test(line);

    if (looksLikeDate && !dateFound) {
      event.event_date = line;
      dateFound = true;
      continue;
    }

    if (line.includes(":") && !venueFound) {
      const [venuePart] = line.split(":").map((p) => p.trim());
      if (venuePart && venuePart.length >= 3 && venuePart.length <= 100) {
        event.venue = venuePart;
        venueFound = true;
        continue;
      }
    }

    if (/^multiple venues$/i.test(line) && !venueFound) {
      event.venue = "Multiple Venues";
      venueFound = true;
      continue;
    }

    if (
      !event.category &&
      line.length >= 3 &&
      line.length <= 60 &&
      /^[a-zA-Z\s&\-\/]+$/.test(line) &&
      line.toLowerCase() !== city.toLowerCase()
    ) {
      event.category = line;
      continue;
    }
  }

  return event;
};

/* ── Extract events from loaded page ──────────────────────────────────── */
const extractEvents = async (page, city) => {
  console.log("📊 Extracting events...\n");

  const allLinks = await page.locator('a[href*="/events/"]').all();
  console.log(`   Total links on page: ${allLinks.length}`);

  const events = [];
  const seenUrls = new Set();
  const counters = { extracted: 0, noET: 0, noVenue: 0, dupes: 0, datesFromImage: 0, datesFromText: 0 };

  for (const link of allLinks) {
    try {
      const href = await link.getAttribute("href");
      if (!href || !href.match(/\/ET\d+/i)) { counters.noET++; continue; }
      if (seenUrls.has(href)) { counters.dupes++; continue; }
      seenUrls.add(href);

      const fullUrl = href.startsWith("http") ? href : `https://in.bookmyshow.com${href}`;
      const cardText = await link.innerText();
      if (!cardText?.trim()) continue;

      const lines = cardText.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) continue;

      const event = parseEventCard(lines, city);
      event.event_url = fullUrl;

      // Quality gates
      if (!event.event_name) continue;
      if (!event.venue) { counters.noVenue++; continue; }

      // ── Extract city-specific date from image URL ──────────────────
      const imgEl = link.locator("img").first();
      let imgSrc = "";
      try {
        imgSrc = (await imgEl.getAttribute("src")) || "";
      } catch { }

      const imageDate = decodeDateFromImageUrl(imgSrc);
      if (imageDate) {
        // Image URL date is always the city-specific date — priority
        event.event_date = imageDate;
        counters.datesFromImage++;
      } else if (event.event_date) {
        counters.datesFromText++;
      }

      // ── Normalise date to ISO ─────────────────────────────────────
      const isoDate = toISODate(event.event_date);
      event.event_date = isoDate;
      // Status is computed client-side (frontend + Google Sheets formula)

      events.push(event);
      counters.extracted++;

      if (counters.extracted <= 3 || counters.extracted % 25 === 0) {
        console.log(`   [${counters.extracted}] ${event.event_name.slice(0, 50)}`);
        console.log(`       📅 ${event.event_date || "—"}  ⟶  ${event.status}  (${imageDate ? "from image" : "from text"})`);
        console.log(`       📍 ${event.venue}  |  🏷️  ${event.category || "—"}`);
      }
    } catch {
      continue;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  const withDate = events.filter((e) => e.event_date).length;
  const upcoming = events.filter((e) => e.status === "upcoming").length;
  const expired = events.filter((e) => e.status === "expired").length;

  console.log(`\n${"─".repeat(50)}`);
  console.log(`   ✅ Extracted: ${counters.extracted} events`);
  console.log(`   ⏭️  Skipped:  ${counters.noET} no-ET  |  ${counters.noVenue} no-venue  |  ${counters.dupes} dupes`);
  console.log(`   📅 Dates:    ${withDate}/${counters.extracted} (${counters.extracted ? Math.round((withDate / counters.extracted) * 100) : 0}%)`);
  console.log(`   📸 Source:   ${counters.datesFromImage} from image URL  |  ${counters.datesFromText} from card text`);
  console.log(`   🟢 Upcoming: ${upcoming}   🔴 Expired: ${expired}`);
  console.log(`${"─".repeat(50)}\n`);

  return events;
};

/* ── Main Scrape Function ─────────────────────────────────────────────── */
const scrapeBookMyShow = async (city, timeoutMs = 120000) => {
  const url = buildUrl(city);
  const headless = process.env.HEADLESS !== "false";

  console.log("\n" + "═".repeat(60));
  console.log(`  🎯 SCRAPING: ${city.toUpperCase()}`);
  console.log("═".repeat(60));
  console.log(`  URL:      ${url}`);
  console.log(`  Headless: ${headless}`);
  console.log(`  Timeout:  ${timeoutMs}ms`);
  console.log("═".repeat(60) + "\n");

  let browser;
  const t0 = Date.now();

  try {
    browser = await chromium.launch({
      headless,
      timeout: timeoutMs,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-infobars",
        "--window-position=0,0",
        "--ignore-certificate-errors",
        "--ignore-certificate-errors-spki-list",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    console.log("📄 Loading page...");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await sleep(CONFIG.INITIAL_WAIT_MS);

    await scrollUntilStable(page);
    const events = await extractEvents(page, city);

    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`✅ Done: ${events.length} events in ${sec}s\n`);

    return events;
  } catch (error) {
    console.error(`❌ Scrape error for ${city}: ${error.message}`);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = { scrapeBookMyShow };
