require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { router } = require("./routes/events");
const { scheduleRefresh } = require("./cron/scheduler");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
}));
app.use(express.json());

// ── Health check ────────────────────────────────────────────────────────
const startedAt = new Date();
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "pixie-events-backend",
    uptime: Math.floor((Date.now() - startedAt.getTime()) / 1000) + "s",
    startedAt: startedAt.toISOString(),
  });
});

app.use("/", router);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`\n🚀 Backend running on http://localhost:${port}\n`);
  scheduleRefresh();
});
