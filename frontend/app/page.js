'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sun, Moon, Zap, MapPin, Globe } from 'lucide-react';
import StatsCards from './components/StatsCards';
import CityBarChart from './components/CityBarChart';
import CategoryPieChart from './components/CategoryPieChart';
import EventsTable from './components/EventsTable';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const CITIES = ['jaipur', 'mumbai', 'delhi', 'chandigarh', 'lucknow'];

/* ── Live status computation ─────────────── */
// Computes status in real-time using client's current date
// instead of relying on backend's stale DB status.
function computeLiveStatus(events) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return events.map(e => {
    if (!e.event_date) return { ...e, status: 'upcoming' }; // No date → assume upcoming
    const d = e.event_date.split('T')[0]; // handle ISO datetime
    if (d === todayStr) return { ...e, status: 'today' };
    if (d < todayStr) return { ...e, status: 'expired' };
    return { ...e, status: 'upcoming' };
  });
}


/* ── Loading skeleton ────────────────────────── */
function Skeleton() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="sk-grid">
        {[...Array(5)].map((_, i) => <div key={i} className="sk sk-stat stagger" />)}
      </div>
      <div className="charts" style={{ marginBottom: 28 }}>
        <div className="sk sk-chart" />
        <div className="sk sk-chart" />
      </div>
      <div className="sk sk-table" />
    </motion.div>
  );
}

export default function Dashboard() {
  const [theme, setTheme] = useState('dark');
  const [city, setCity] = useState('jaipur');
  const [analytics, setAnalytics] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [syncTime, setSyncTime] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const flash = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4200);
  };

  const fetchAll = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [aRes, eRes] = await Promise.all([
        fetch(`${API}/analytics`),
        fetch(`${API}/events${city !== 'all' ? `?city=${city}` : ''}`),
      ]);
      if (!aRes.ok || !eRes.ok) throw new Error();
      const [a, e] = await Promise.all([aRes.json(), eRes.json()]);
      setAnalytics(a);
      setEvents(computeLiveStatus(e.events || []));
      setSyncTime(new Date());
    } catch {
      flash('Backend unreachable — is the server running?', 'error');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    // Only show skeleton on first load. Subsequent updates happen in-place for smooth animation.
    fetchAll(loading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const handleRefresh = async () => {
    if (city === 'all') { flash('Pick a city first', 'error'); return; }
    setRefreshing(true);
    try {
      const r = await fetch(`${API}/refresh-events?city=${city}`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Refresh failed');
      flash(`Scraped ${d.refreshed} events for ${city} ✨`);
      await fetchAll();
    } catch (err) { flash(err.message, 'error'); }
    finally { setRefreshing(false); }
  };

  // ── Derived Stats ───────────────────────────
  // We calculate these on the frontend so they match the current "city" filter exactly.
  const stats = {
    total: events.length,
    upcoming: events.filter(e => e.status === 'upcoming').length,
    today: events.filter(e => e.status === 'today').length,
    expired: events.filter(e => e.status === 'expired').length,
    cities: analytics?.cities || 0, // Keep global
  };

  const eventsByCategory = Object.entries(events.reduce((acc, e) => {
    const c = e.category || 'Other';
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {})).map(([category, count]) => ({ category, count }));

  return (
    <>
      {/* ── Ambient background ─────────────────── */}
      <div className="aurora">
        <div className="aurora-orb aurora-orb--1" />
        <div className="aurora-orb aurora-orb--2" />
        <div className="aurora-orb aurora-orb--3" />
      </div>
      <div className="noise" />
      <div className="dot-grid" />

      <div className="shell">
        {/* ── Header ─────────────────────────────── */}
        <header className="hdr">
          <div className="hdr-left">
            <motion.div className="logo" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Zap size={28} color="white" fill="white" />
            </motion.div>
            <div>
              <div className="hdr-title">Pixie Event Tracker</div>
              <div className="hdr-sub">
                Real-time BookMyShow analytics
                {syncTime && (
                  <span className="hdr-sub-time">
                    · updated {syncTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="hdr-right">
            <span className="live"><span className="live-dot" />Live</span>
            <button className="theme-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </header>

        {/* ── City selector ──────────────────────── */}
        <LayoutGroup>
          <div className="cities">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <CityTab
                label="All Cities"
                id="all"
                isSelected={city === 'all'}
                onClick={() => setCity('all')}
              />
              {CITIES.map(c => (
                <CityTab
                  key={c}
                  label={c.charAt(0).toUpperCase() + c.slice(1)}
                  id={c}
                  isSelected={city === c}
                  onClick={() => setCity(c)}
                />
              ))}
            </div>

            <motion.button
              className="refresh"
              onClick={handleRefresh}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              disabled={refreshing || city === 'all'}
            >
              <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
              {refreshing ? 'Scraping...' : 'Refresh'}
            </motion.button>
          </div>
        </LayoutGroup>

        {/* ── Main content ───────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? <Skeleton key="skeleton" /> : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="section-tag">Overview</div>
              <StatsCards
                analytics={stats}
                selectedCity={city}
              />

              <div className="section-tag">Analytics</div>
              <div className="charts">
                <CityBarChart data={analytics?.byCity || []} theme={theme} />
                <CategoryPieChart
                  data={eventsByCategory}
                  theme={theme}
                />
              </div>

              <div className="section-tag">Event Feed</div>
              <EventsTable events={events} selectedCity={city} />

              <footer className="footer">
                Built with Next.js · Framer Motion · Supabase · Lucide ·{' '}
                <a href="https://github.com" target="_blank" rel="noreferrer">View Source ↗</a>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            className={`toast ${toast.type}`}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── City Tab Component with Layout Animation ── */
function CityTab({ label, id, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`city ${isSelected ? 'on' : ''}`}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      {isSelected && (
        <motion.div
          layoutId="city-pill"
          style={{
            position: 'absolute', inset: 0, borderRadius: 30,
            background: 'var(--g-brand)',
            boxShadow: '0 4px 24px rgba(124, 107, 255, 0.5)',
            zIndex: 0
          }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {id === 'all' ? <Globe size={13} /> : <MapPin size={13} />}
        {label}
      </span>
    </button>
  );
}
