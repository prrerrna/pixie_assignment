const cron = require("node-cron");
const { cities } = require("../config/cities");
const { refreshCityEvents } = require("../routes/events");

const scheduleRefresh = () => {
  const schedule = process.env.CRON_SCHEDULE || "0 */6 * * *";
  cron.schedule(schedule, async () => {
    for (const city of cities) {
      try {
        await refreshCityEvents(city);
      } catch (err) {
        console.error(`Cron refresh failed for ${city}:`, err.message);
      }
    }
  });
  console.log(`Cron scheduled: ${schedule}`);
};

module.exports = { scheduleRefresh };
