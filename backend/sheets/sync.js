const { google } = require("googleapis");
const path = require("path");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const getAuth = () => {
    // Production: credentials stored as JSON string in env var
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
        return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
    }
    // Local dev: credentials stored as a file
    const credPath = path.resolve(process.env.GOOGLE_CREDENTIALS_PATH);
    return new google.auth.GoogleAuth({ keyFile: credPath, scopes: SCOPES });
};

/**
 * Sync all events to Google Sheets.
 * Clears the sheet and rewrites all rows.
 */
const syncToSheets = async (events) => {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;

        const headers = [
            "Event Name", "Event Date", "Venue", "City",
            "Category", "Event URL", "Status", "Last Updated"
        ];

        // Row 1 = sync timestamp, Row 2 = headers, data starts at Row 3
        const rows = events.map((e, i) => {
            const rowNum = i + 3; // data row number in the sheet
            // Status formula: computes live using TODAY() — always accurate
            const statusFormula = e.event_date
                ? `=IF(B${rowNum}<TODAY(),"expired",IF(B${rowNum}=TODAY(),"today","upcoming"))`
                : "upcoming";

            return [
                e.event_name || "",
                e.event_date || "",
                e.venue || "",
                e.city || "",
                e.category || "",
                e.event_url || "",
                statusFormula,
                e.last_updated ? new Date(e.last_updated).toLocaleString("en-IN") : "",
            ];
        });

        // Clear existing content
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: "Sheet1",
        });

        // Write header + sync timestamp in A1
        // Use USER_ENTERED so the status formulas are interpreted by Sheets
        const syncTime = `Last synced: ${new Date().toLocaleString("en-IN")} | Total: ${events.length} events`;
        const values = [[syncTime], headers, ...rows];

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: "Sheet1!A1",
            valueInputOption: "USER_ENTERED",
            requestBody: { values },
        });

        console.log(`✅ Google Sheets synced: ${events.length} events`);
        return true;
    } catch (err) {
        console.error("❌ Google Sheets sync failed:", err.message);
        return false;
    }
};

module.exports = { syncToSheets };
