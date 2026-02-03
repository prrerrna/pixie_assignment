const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { toISODate, isExpired } = require("../utils/date");

const DEFAULT_HEADERS = [
  "event_name",
  "event_date",
  "venue",
  "city",
  "category",
  "event_url",
  "status",
  "last_updated"
];

const ensureFile = (filePath) => {
  const fullPath = path.resolve(filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(fullPath)) {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([DEFAULT_HEADERS]);
    xlsx.utils.book_append_sheet(wb, ws, "events");
    xlsx.writeFile(wb, fullPath);
  }
  return fullPath;
};

const readEvents = (filePath) => {
  const fullPath = ensureFile(filePath);
  const wb = xlsx.readFile(fullPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });
  return rows;
};

const writeEvents = (filePath, rows) => {
  const fullPath = ensureFile(filePath);
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(rows, { header: DEFAULT_HEADERS });
  xlsx.utils.book_append_sheet(wb, ws, "events");

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      fs.writeFileSync(fullPath, buffer);
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const waitUntil = Date.now() + 200 * attempt;
      while (Date.now() < waitUntil) {
        // busy wait for a short backoff
      }
    }
  }
};

const upsertEvents = (filePath, incoming) => {
  const existing = readEvents(filePath);
  const map = new Map();

  existing.forEach((row) => {
    if (row.event_url) map.set(row.event_url, row);
  });

  const nowIso = new Date().toISOString();

  incoming.forEach((event) => {
    const current = map.get(event.event_url);
    const isoDate = toISODate(event.event_date);
    const status = isExpired(isoDate) ? "expired" : "upcoming";
    const payload = {
      event_name: event.event_name,
      event_date: isoDate || event.event_date || "",
      venue: event.venue || "",
      city: event.city || "",
      category: event.category || "",
      event_url: event.event_url,
      status,
      last_updated: nowIso
    };

    if (current) {
      map.set(event.event_url, { ...current, ...payload });
    } else {
      map.set(event.event_url, payload);
    }
  });

  const updated = Array.from(map.values());

  updated.forEach((row) => {
    const isoDate = toISODate(row.event_date);
    if (isExpired(isoDate)) {
      row.status = "expired";
    } else if (!row.status) {
      row.status = "upcoming";
    }
  });

  writeEvents(filePath, updated);
  return updated;
};

const refreshExpiry = (filePath) => {
  const rows = readEvents(filePath);
  const updated = rows.map((row) => {
    const isoDate = toISODate(row.event_date);
    if (isExpired(isoDate)) {
      return { ...row, status: "expired" };
    }
    return { ...row, status: row.status || "upcoming" };
  });
  writeEvents(filePath, updated);
  return updated;
};

const seedSampleData = (filePath) => {
  const existing = readEvents(filePath);
  if (existing.length > 0) return existing;
  const nowIso = new Date().toISOString();
  const sample = [
    {
      event_name: "Jaipur Culture Fest",
      event_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      venue: "Albert Hall Lawn",
      city: "jaipur",
      category: "festival",
      event_url: "https://in.bookmyshow.com/events/jaipur-culture-fest/ET10000001",
      status: "upcoming",
      last_updated: nowIso
    },
    {
      event_name: "Mumbai Night Run",
      event_date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      venue: "BKC Grounds",
      city: "mumbai",
      category: "sports",
      event_url: "https://in.bookmyshow.com/events/mumbai-night-run/ET10000002",
      status: "upcoming",
      last_updated: nowIso
    },
    {
      event_name: "Delhi Food Carnival",
      event_date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      venue: "NSIC Grounds",
      city: "delhi",
      category: "food",
      event_url: "https://in.bookmyshow.com/events/delhi-food-carnival/ET10000003",
      status: "upcoming",
      last_updated: nowIso
    },
    {
      event_name: "Chandigarh Art Walk",
      event_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      venue: "Sector 17 Plaza",
      city: "chandigarh",
      category: "art",
      event_url: "https://in.bookmyshow.com/events/chandigarh-art-walk/ET10000004",
      status: "expired",
      last_updated: nowIso
    },
    {
      event_name: "Lucknow Comedy Night",
      event_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      venue: "Gomti Nagar Studio",
      city: "lucknow",
      category: "comedy",
      event_url: "https://in.bookmyshow.com/events/lucknow-comedy-night/ET10000005",
      status: "upcoming",
      last_updated: nowIso
    }
  ];
  writeEvents(filePath, sample);
  return sample;
};

module.exports = {
  ensureFile,
  readEvents,
  writeEvents,
  upsertEvents,
  refreshExpiry,
  seedSampleData,
  DEFAULT_HEADERS
};
