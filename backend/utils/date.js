const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

const toISODate = (value) => {
  if (!value) return "";
  if (value instanceof Date && !isNaN(value)) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (!text) return "";

  const direct = new Date(text);
  if (!isNaN(direct)) {
    return direct.toISOString().slice(0, 10);
  }

  const compact = text
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const parts = compact.split(" ");
  if (parts.length >= 2) {
    const day = parseInt(parts[0], 10);
    const month = MONTHS[parts[1].slice(0, 3)];
    const year = parts[2] ? parseInt(parts[2], 10) : new Date().getFullYear();
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    }
  }

  return "";
};

const isExpired = (isoDate, now = new Date()) => {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  if (isNaN(d)) return false;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const check = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return check < today;
};

module.exports = { toISODate, isExpired };
