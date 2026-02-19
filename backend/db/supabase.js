const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

/**
 * Upsert events into Supabase.
 * Deduplication by UNIQUE constraint on event_url.
 * Dates are expected to be ISO YYYY-MM-DD (or "" for unknown).
 */
const upsertEvents = async (events) => {
    const rows = events.map((e) => ({
        event_name: e.event_name || "",
        event_date: e.event_date || null,  // ISO or null
        venue: e.venue || "",
        city: e.city || "",
        category: e.category || "",
        event_url: e.event_url || "",
        status: e.status || "upcoming",
        last_updated: new Date().toISOString(),
    }));

    // Upsert in batches of 200 to avoid payload limits
    const BATCH_SIZE = 200;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from("events")
            .upsert(batch, { onConflict: "event_url", ignoreDuplicates: false });
        if (error) throw error;
    }

    return rows.length;
};

/**
 * Read all events, optionally filtered by city.
 */
const readEvents = async (city = null) => {
    let query = supabase
        .from("events")
        .select("*")
        .order("last_updated", { ascending: false });

    if (city) {
        query = query.eq("city", city.toLowerCase());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

/**
 * Mark events as expired if their date is in the past.
 *
 * This works correctly because dates are stored as ISO YYYY-MM-DD strings.
 * PostgreSQL text comparison of ISO dates preserves chronological order.
 */
const refreshExpiry = async () => {
    const today = new Date().toISOString().split("T")[0];

    // Mark past events as expired
    const { error: expireErr } = await supabase
        .from("events")
        .update({ status: "expired" })
        .lt("event_date", today)
        .neq("event_date", "")     // Don't expire events with no date
        .eq("status", "upcoming");

    if (expireErr) {
        console.error("refreshExpiry (expire) failed:", expireErr.message);
    }

    // Also: re-mark future events as upcoming (in case dates were corrected)
    const { error: reviveErr } = await supabase
        .from("events")
        .update({ status: "upcoming" })
        .gte("event_date", today)
        .eq("status", "expired");

    if (reviveErr) {
        console.error("refreshExpiry (revive) failed:", reviveErr.message);
    }
};

/**
 * Get analytics data for the dashboard.
 */
const getAnalytics = async () => {
    const { data: all, error } = await supabase.from("events").select("*");
    if (error) throw error;

    const events = all || [];
    const total = events.length;
    const upcoming = events.filter((e) => e.status === "upcoming").length;
    const expired = events.filter((e) => e.status === "expired").length;
    const withDate = events.filter((e) => e.event_date).length;

    // Events per city
    const byCity = {};
    events.forEach((e) => {
        if (e.city) byCity[e.city] = (byCity[e.city] || 0) + 1;
    });

    // Events per category
    const byCategory = {};
    events.forEach((e) => {
        const cat = e.category || "Other";
        byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    return {
        total,
        upcoming,
        expired,
        withDate,
        cities: Object.keys(byCity).length,
        byCity: Object.entries(byCity)
            .map(([city, count]) => ({ city, count }))
            .sort((a, b) => b.count - a.count),
        byCategory: Object.entries(byCategory)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8),
    };
};

module.exports = { supabase, upsertEvents, readEvents, refreshExpiry, getAnalytics };
