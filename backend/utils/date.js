/**
 * Date Utilities for BookMyShow Event Tracker
 *
 * Handles every date format observed on BMS event cards:
 *   "Thu, 20 Feb"              → 2026-02-20
 *   "20 Feb onwards"           → 2026-02-20
 *   "Feb 20, 2026"             → 2026-02-20
 *   "20 Feb - 22 Feb"          → 2026-02-20  (first date wins)
 *   "Sat, 22 Feb 2026 onwards" → 2026-02-22
 *   "22 Feb, 2026"             → 2026-02-22
 *   "22 February 2026"         → 2026-02-22
 *   "Today"                    → today's ISO date
 *   "Tomorrow"                 → tomorrow's ISO date
 *   "Multiple Dates"           → ""
 *   ""                         → ""
 */

const MONTHS = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Resolve a month string (e.g. "feb", "February") to a 0-indexed month number.
 * Returns undefined if unrecognised.
 */
const resolveMonth = (str) => {
  if (!str) return undefined;
  return MONTHS[str.toLowerCase().trim()];
};

/**
 * Build an ISO date string (YYYY-MM-DD) from components.
 * If year is missing, assumes current year. If the resulting date is more
 * than 60 days in the past, bumps to next year (handles Dec→Jan rollover).
 */
const buildISO = (day, monthIdx, year) => {
  const now = new Date();
  const y = year || now.getFullYear();
  const d = new Date(Date.UTC(y, monthIdx, day));
  if (isNaN(d)) return "";

  // If no year was provided and the date is >60 days in the past, assume next year
  if (!year) {
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    if (diff > 60) {
      d.setUTCFullYear(d.getUTCFullYear() + 1);
    }
  }

  return d.toISOString().slice(0, 10);
};

/**
 * Convert any date-like string to ISO YYYY-MM-DD format.
 *
 * Strategy (tried in order):
 *  1. Already ISO? Return as-is.
 *  2. Relative words (Today / Tomorrow).
 *  3. Strip noise (day-of-week prefix, "onwards", "onward").
 *  4. Handle date ranges → take first date.
 *  5. Try "DD Month" or "DD Month YYYY".
 *  6. Try "Month DD" or "Month DD, YYYY".
 *  7. Fallback: Date.parse().
 *  8. Give up → "".
 */
const toISODate = (value) => {
  if (!value) return "";

  // Already a Date object
  if (value instanceof Date && !isNaN(value)) {
    return value.toISOString().slice(0, 10);
  }

  let text = String(value).trim();
  if (!text) return "";

  // ── 1. Already ISO (2026-02-20) ─────────────────────────────────────────
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  // ── 2. Relative dates ───────────────────────────────────────────────────
  const lower = text.toLowerCase();
  if (lower === "today") {
    return new Date().toISOString().slice(0, 10);
  }
  if (lower === "tomorrow") {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return t.toISOString().slice(0, 10);
  }
  // Unparseable known strings
  if (/^multiple\s+dates?$/i.test(text) || /^date\s+tba$/i.test(text)) {
    return "";
  }

  // ── 3. Strip noise ──────────────────────────────────────────────────────
  // Remove day-of-week prefix: "Thu, ", "Saturday, "
  text = text.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s*/i, "");
  // Remove "onwards", "onward"
  text = text.replace(/\s+onwards?$/i, "").trim();

  // ── 4. Date ranges → take first date ────────────────────────────────────
  // "20 Feb - 22 Feb" or "20 Feb to 22 Feb" or "20 Feb – 22 Feb"
  const rangeParts = text.split(/\s*[-–—]\s*|\s+to\s+/i);
  if (rangeParts.length > 1) {
    text = rangeParts[0].trim();
  }

  // Normalise punctuation
  text = text.replace(/,/g, "").replace(/\s+/g, " ").trim();

  // ── 5. "DD Month" or "DD Month YYYY" ───────────────────────────────────
  //    e.g. "20 Feb", "20 February 2026"
  const dmMatch = text.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/i);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const monthIdx = resolveMonth(dmMatch[2]);
    const year = dmMatch[3] ? parseInt(dmMatch[3], 10) : null;
    if (monthIdx !== undefined && day >= 1 && day <= 31) {
      return buildISO(day, monthIdx, year);
    }
  }

  // ── 6. "Month DD" or "Month DD YYYY" ───────────────────────────────────
  //    e.g. "Feb 20", "February 20 2026"
  const mdMatch = text.match(/^([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/i);
  if (mdMatch) {
    const monthIdx = resolveMonth(mdMatch[1]);
    const day = parseInt(mdMatch[2], 10);
    const year = mdMatch[3] ? parseInt(mdMatch[3], 10) : null;
    if (monthIdx !== undefined && day >= 1 && day <= 31) {
      return buildISO(day, monthIdx, year);
    }
  }

  // ── 7. Fallback: native Date.parse ──────────────────────────────────────
  const native = new Date(text);
  if (!isNaN(native) && native.getFullYear() > 2000) {
    return native.toISOString().slice(0, 10);
  }

  // ── 8. Give up ──────────────────────────────────────────────────────────
  return "";
};

/**
 * Check if an ISO date string is in the past.
 */
const isExpired = (isoDate, now = new Date()) => {
  if (!isoDate) return false;
  const d = new Date(isoDate + "T23:59:59Z"); // Generous: event expires at end of day
  if (isNaN(d)) return false;
  return d < now;
};

module.exports = { toISODate, isExpired };
