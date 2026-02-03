import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:4000";

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
};

const StatusBadge = ({ status }) => {
  const normalized = status || "upcoming";
  return (
    <span className={`badge ${normalized === "expired" ? "badge-expired" : "badge-upcoming"}`}>
      {normalized}
    </span>
  );
};

const App = () => {
  const [cities, setCities] = useState([]);
  const [city, setCity] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("dateAsc");
  const [refreshSource, setRefreshSource] = useState("-");

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesStatus = statusFilter === "all" ? true : event.status === statusFilter;
      const haystack = `${event.event_name} ${event.venue} ${event.category}`.toLowerCase();
      const matchesQuery = query ? haystack.includes(query) : true;
      return matchesStatus && matchesQuery;
    });
  }, [events, search, statusFilter]);

  const sortedEvents = useMemo(() => {
    const list = [...filteredEvents];
    if (sortBy === "dateDesc") {
      return list.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
    }
    if (sortBy === "updatedDesc") {
      return list.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
    }
    return list.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  }, [filteredEvents, sortBy]);

  const fetchCities = async () => {
    const res = await fetch(`${API_BASE}/cities`);
    const data = await res.json();
    setCities(data.cities || []);
    setCity((data.cities || [""])[0] || "");
  };

  const fetchEvents = async (selectedCity) => {
    if (!selectedCity) return;
    const res = await fetch(`${API_BASE}/events?city=${selectedCity}`);
    const data = await res.json();
    setEvents(data.events || []);
  };

  const refreshEvents = async () => {
    if (!city) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/refresh-events?city=${city}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Refresh failed");
      }
      const data = await res.json();
      setEvents(data.events || []);
      setLastRefreshed(new Date(data.refreshedAt || Date.now()).toLocaleString());
      setRefreshSource(data.source || "-");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCities();
  }, []);

  useEffect(() => {
    if (city) {
      fetchEvents(city);
    }
  }, [city]);

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Pixie Event Tracker</h1>
          <p>Track upcoming events for photobooth outreach.</p>
        </div>
        <div className="controls">
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Event, venue, category"
            />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="upcoming">Upcoming</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <label>
            Sort
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="dateAsc">Date (asc)</option>
              <option value="dateDesc">Date (desc)</option>
              <option value="updatedDesc">Last updated</option>
            </select>
          </label>
          <label>
            City
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              {cities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button onClick={refreshEvents} disabled={loading || !city}>
            {loading ? "Refreshing..." : "Refresh Events"}
          </button>
        </div>
      </header>

      <section className="meta">
        <div className="meta-left">
          <span>Last refreshed: {lastRefreshed || "Not yet"}</span>
          <span className="meta-divider">•</span>
          <span>Source: {refreshSource}</span>
          <span className="meta-divider">•</span>
          <span>
            Showing {sortedEvents.length} of {events.length}
          </span>
        </div>
        {error && <span className="error">{error}</span>}
      </section>

      <section className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Date</th>
              <th>Venue</th>
              <th>Category</th>
              <th>Status</th>
              <th>Link</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {sortedEvents.map((event) => (
              <tr key={event.event_url}>
                <td>{event.event_name}</td>
                <td>{formatDate(event.event_date)}</td>
                <td>{event.venue}</td>
                <td>{event.category}</td>
                <td>
                  <StatusBadge status={event.status} />
                </td>
                <td>
                  <a href={event.event_url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </td>
                <td>{new Date(event.last_updated).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedEvents.length === 0 && <div className="empty">No events yet.</div>}
      </section>
    </div>
  );
};

export default App;
