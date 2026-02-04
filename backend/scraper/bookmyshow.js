/**
 * BookMyShow Event Scraper - Optimized Edition
 * Natural smooth scrolling with Chromium for reliable lazy loading
 * 2 complete passes in ~30-40 seconds total
 */

const { chromium } = require("playwright");

// Configuration
const CONFIG = {
  SCROLL_PASSES: 2,
  PASS_DURATION_MS: 18000, // 18 seconds per pass
  INITIAL_WAIT_MS: 3000,
  SCROLL_STEP_PX: 100, // Smooth pixel-based scrolling
  SCROLL_DELAY_MS: 50, // Delay between scroll steps
  FINAL_WAIT_MS: 2000,
  CATEGORY_KEYWORDS: [
    "comedy",
    "concert",
    "workshop",
    "festival",
    "exhibition",
    "theatre",
    "sport",
    "music",
    "show",
    "open mic",
    "celebration",
    "standup",
    "live"
  ]
};

const buildUrl = (city) => `https://in.bookmyshow.com/explore/events-${city}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Natural smooth scrolling - scrolls like a human
 * Performs 2 complete passes from top to bottom
 */
const smoothScrollToLoadEvents = async (page) => {
  console.log("\n🔄 Starting natural smooth scrolling...");
  console.log(`📋 ${CONFIG.SCROLL_PASSES} passes × ${CONFIG.PASS_DURATION_MS / 1000}s each\n`);

  for (let pass = 1; pass <= CONFIG.SCROLL_PASSES; pass++) {
    const startTime = Date.now();
    console.log(`📜 Pass ${pass}/${CONFIG.SCROLL_PASSES}:`);

    // Scroll to top first
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);

    // Get total scrollable height
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const maxScroll = scrollHeight - viewportHeight;

    // Calculate how many steps we need
    const totalSteps = Math.floor(maxScroll / CONFIG.SCROLL_STEP_PX);
    const delayPerStep = Math.floor(CONFIG.PASS_DURATION_MS / totalSteps);

    let currentPosition = 0;
    let step = 0;

    // Smooth scroll to bottom
    while (currentPosition < maxScroll) {
      currentPosition += CONFIG.SCROLL_STEP_PX;
      if (currentPosition > maxScroll) currentPosition = maxScroll;

      await page.evaluate((pos) => {
        window.scrollTo({ top: pos, behavior: 'smooth' });
      }, currentPosition);

      await sleep(delayPerStep);
      step++;

      // Log progress every 20%
      const progress = Math.floor((currentPosition / maxScroll) * 100);
      if (progress % 20 === 0 && step % 5 === 0) {
        const eventCount = await page.locator('a[href*="/events/"]').count();
        console.log(`   ${progress}% scrolled - ${eventCount} event links loaded`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const finalCount = await page.locator('a[href*="/events/"]').count();
    console.log(`   ✅ Pass ${pass} complete in ${elapsed}s - ${finalCount} links total\n`);

    // Small pause between passes
    if (pass < CONFIG.SCROLL_PASSES) {
      await sleep(1000);
    }
  }

  // Wait for any final lazy loads
  await sleep(CONFIG.FINAL_WAIT_MS);

  const totalCount = await page.locator('a[href*="/events/"]').count();
  console.log(`✓ Scrolling complete: ${totalCount} event links found\n`);
  return totalCount;
};

/**
 * Parses event card text to extract structured event data
 */
const parseEventCard = (lines, city) => {
  const event = {
    event_name: lines[0] || "",
    event_date: "",
    venue: "",
    city: city.toLowerCase(),
    category: "",
    event_url: ""
  };

  // Strategy 1: Parse all lines to extract venue and category
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip price lines
    if (line.startsWith("₹") || line.toUpperCase() === "FREE" || /^\d+$/.test(line)) {
      continue;
    }

    // Venue format: "VenueName: City" or "VenueName : City"
    if (line.includes(":") && !event.venue) {
      const parts = line.split(":").map(p => p.trim());
      if (parts.length >= 2) {
        const venuePart = parts[0].trim();
        const cityPart = parts[1].trim();
        if (venuePart && venuePart.length < 80 && venuePart.length > 2) {
          event.venue = venuePart;
          if (cityPart && cityPart.toLowerCase() !== city.toLowerCase()) {
            event.city = cityPart.toLowerCase();
          }
        }
      }
      continue;
    }

    // Category detection via keywords
    if (!event.category && line.length < 60 && line.length > 2) {
      if (CONFIG.CATEGORY_KEYWORDS.some((kw) => line.toLowerCase().includes(kw))) {
        event.category = line;
      }
    }
  }

  // Strategy 2: Fallback for venue - try to find any line with city name pattern
  if (!event.venue) {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Skip obvious non-venue lines
      if (line.startsWith("₹") || line.toUpperCase() === "FREE" || /^\d+$/.test(line)) {
        continue;
      }
      // Look for lines that might be venue names (reasonable length, has letters)
      if (line.length >= 5 && line.length < 80 && /[a-zA-Z]/.test(line)) {
        // Check if it looks like a venue (not a category keyword)
        const hasKeyword = CONFIG.CATEGORY_KEYWORDS.some((kw) => line.toLowerCase().includes(kw));
        if (!hasKeyword && !line.match(/\d{1,2}\s+\w{3}/i)) { // Not a date
          event.venue = line;
          break;
        }
      }
    }
  }

  // Strategy 3: Fallback for category - be more lenient
  if (!event.category) {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Skip price and venue lines
      if (line.startsWith("₹") || line === event.venue) {
        continue;
      }
      // Accept any reasonable line as category
      if (line.length >= 3 && line.length < 60 && /^[a-zA-Z\s&-]+$/.test(line)) {
        event.category = line;
        break;
      }
    }
  }

  // Strategy 4: Use event name as category hint if still empty
  if (!event.category && event.event_name) {
    const nameLC = event.event_name.toLowerCase();
    for (const kw of CONFIG.CATEGORY_KEYWORDS) {
      if (nameLC.includes(kw)) {
        event.category = kw.charAt(0).toUpperCase() + kw.slice(1);
        break;
      }
    }
  }

  return event;
};

/**
 * Extracts events by parsing structured text from each event card
 */
const extractEvents = async (page, city) => {
  console.log("📊 Extracting event information...\n");

  const allEventLinks = await page.locator('a[href*="/events/"]').all();
  console.log(`Found ${allEventLinks.length} total links`);

  const events = [];
  const seenUrls = new Set();
  let extracted = 0;
  let skipped = 0;

  for (const link of allEventLinks) {
    try {
      const href = await link.getAttribute("href");

      if (!href || seenUrls.has(href)) {
        continue;
      }

      // Only process real event pages (must have ET code)
      if (!href.includes("ET")) {
        skipped++;
        continue;
      }

      seenUrls.add(href);
      const fullUrl = href.startsWith("http") ? href : `https://in.bookmyshow.com${href}`;

      const cardText = await link.innerText();
      if (!cardText || !cardText.trim()) {
        skipped++;
        continue;
      }

      const lines = cardText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l);

      if (!lines.length) {
        skipped++;
        continue;
      }

      const event = parseEventCard(lines, city);
      event.event_url = fullUrl;

      if (event.event_name) {
        events.push(event);
        extracted++;

        if (extracted <= 3 || extracted % 20 === 0) {
          console.log(`[${extracted}] ${event.event_name.slice(0, 45)}`);
          if (event.venue) console.log(`     📍 ${event.venue}`);
          if (event.category) console.log(`     🏷️  ${event.category}`);
          console.log();
        }
      } else {
        skipped++;
      }
    } catch (err) {
      skipped++;
      continue;
    }
  }

  console.log(`\n📊 Extraction Summary:`);
  console.log(`  ✅ Extracted: ${extracted} events`);
  console.log(`  ⏭️  Skipped: ${skipped} (non-events or duplicates)`);

  const withVenue = events.filter((e) => e.venue).length;
  const withCategory = events.filter((e) => e.category).length;
  console.log(`\n📈 Data Quality:`);
  console.log(`  • Venue: ${withVenue}/${extracted} (${Math.round((withVenue / extracted) * 100)}%)`);
  console.log(`  • Category: ${withCategory}/${extracted} (${Math.round((withCategory / extracted) * 100)}%)`);

  return events;
};

/**
 * Main scraping function using Firefox with smooth scrolling
 */
const scrapeBookMyShow = async (city, timeoutMs = 60000) => {
  const url = buildUrl(city);

  console.log("=".repeat(70));
  console.log(`  🎯 BOOKMYSHOW ${city.toUpperCase()} EVENTS SCRAPER`);
  console.log("=".repeat(70));
  console.log();
  console.log(`🌐 Target: ${url}\n`);

  let browser;
  const startTime = Date.now();

  try {
    // Launch Chromium (lighter and more compatible)
    console.log("🚀 Launching Chromium browser...");
    browser = await chromium.launch({
      headless: false,
      timeout: timeoutMs
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Navigate to page
    console.log("📄 Loading page...");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    console.log("⏳ Waiting for initial content...");
    await sleep(CONFIG.INITIAL_WAIT_MS);

    // Perform smooth scrolling
    await smoothScrollToLoadEvents(page);

    // Extract event data
    const events = await extractEvents(page, city);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Successfully extracted ${events.length} events in ${totalTime}s!`);
    console.log("=".repeat(70) + "\n");

    return events;
  } catch (error) {
    console.error(`❌ Error during scraping: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = { scrapeBookMyShow };
