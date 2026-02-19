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

const { firefox } = require("playwright"); // Switch to Firefox for better stealth
const { toISODate } = require("../utils/date");

/* ── ... existing config ... ── */

/* ... */

/* ── Main Scrape Function ─────────────────────────────────────────────── */
const scrapeBookMyShow = async (city, timeoutMs = 120000) => {
  const url = buildUrl(city);
  const headless = process.env.HEADLESS !== "false";

  console.log("\n" + "═".repeat(60));
  console.log(`  🎯 SCRAPING: ${city.toUpperCase()}`);
  console.log("═".repeat(60));
  console.log(`  URL:      ${url}`);
  console.log(`  Headless: ${headless} (Firefox)`); // Noted Firefox
  console.log(`  Timeout:  ${timeoutMs}ms`);
  console.log("═".repeat(60) + "\n");

  let browser;
  const t0 = Date.now();

  try {
    // Firefox is often less detected than Chromium in headless mode
    browser = await firefox.launch({
      headless,
      timeout: timeoutMs,
      args: ["--quiet"], // Firefox uses different args
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
      viewport: { width: 1920, height: 1080 },
      locale: "en-IN",
      timezoneId: "Asia/Kolkata",
      geolocation: { latitude: 26.9124, longitude: 75.7873 }, // Jaipur coordinates
      permissions: ["geolocation"],
    });

    const page = await context.newPage();

    console.log("📄 Loading page...");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    // Debug logging to catch redirects or Cloudflare
    const title = await page.title();
    const finalUrl = page.url();
    console.log(`   🔎 Page Title: "${title}"`);
    console.log(`   📍 Final URL:  "${finalUrl}"`);

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
