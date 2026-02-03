require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { router } = require("./routes/events");
const { ensureFile, seedSampleData } = require("./storage/excelStore");
const { scheduleRefresh } = require("./cron/scheduler");

const app = express();
app.use(cors());
app.use(express.json());

const dataFile = process.env.DATA_FILE || "./data/events.xlsx";
ensureFile(dataFile);
seedSampleData(dataFile);

app.use("/", router);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
  scheduleRefresh();
});
