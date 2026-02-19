'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, LayoutGrid, List, Filter, ExternalLink, Calendar, MapPin, Tag } from 'lucide-react';

const PAGE_SIZE = 12;
const E = { jaipur: '🏰', mumbai: '🌊', delhi: '🏛️', chandigarh: '🌳', lucknow: '🕌' };

export default function EventsTable({ events, selectedCity }) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [view, setView] = useState('card'); // Default to card for "wow" factor

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return events.filter(e => {
            const ms = !q
                || e.event_name?.toLowerCase().includes(q)
                || e.venue?.toLowerCase().includes(q)
                || e.category?.toLowerCase().includes(q)
                || e.city?.toLowerCase().includes(q);
            const mf = filter === 'all' || e.status === filter;
            return ms && mf;
        });
    }, [events, search, filter]);

    const pages = Math.ceil(filtered.length / PAGE_SIZE);
    const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const up = events.filter(e => e.status === 'upcoming').length;
    const td = events.filter(e => e.status === 'today').length;
    const ex = events.filter(e => e.status === 'expired').length;

    const set = (fn, val) => { fn(val); setPage(1); };

    const pills = [
        { k: 'all', l: `All (${events.length})` },
        { k: 'upcoming', l: `Upcoming (${up})` },
        { k: 'today', l: `Today (${td})` },
        { k: 'expired', l: `Expired (${ex})` },
    ];

    // Pagination logic
    const pageButtons = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(pages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pageButtons.push(i);

    return (
        <motion.div
            className="t-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
        >
            {/* Header */}
            <div className="t-head">
                <div>
                    <div className="t-title">
                        {selectedCity !== 'all'
                            ? `${E[selectedCity] ?? '📍'} ${selectedCity.charAt(0).toUpperCase() + selectedCity.slice(1)} Events`
                            : 'Global Events Feed'}
                    </div>
                    <div className="t-count">
                        {filtered.length !== events.length
                            ? `${filtered.length} of ${events.length} results`
                            : `${events.length} events found`}
                    </div>
                </div>

                <div className="t-controls">
                    {/* View toggle */}
                    <div className="view-toggle">
                        <button className={`view-btn ${view === 'table' ? 'on' : ''}`} onClick={() => setView('table')} title="Table view">
                            <List size={16} />
                        </button>
                        <button className={`view-btn ${view === 'card' ? 'on' : ''}`} onClick={() => setView('card')} title="Card view">
                            <LayoutGrid size={16} />
                        </button>
                    </div>

                    {/* Filter pills */}
                    <div className="pills">
                        {pills.map(p => (
                            <button key={p.k}
                                className={`pill ${filter === p.k ? 'on' : ''}`}
                                onClick={() => set(setFilter, p.k)}
                            >{p.l}</button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="search-wrap">
                        <Search className="search-ico" size={14} />
                        <input className="search" placeholder="Search events…"
                            value={search} onChange={e => set(setSearch, e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Content */}
            {slice.length === 0 ? (
                <div className="empty">
                    <Filter size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <div className="empty-msg">No events match your filters</div>
                    <div className="empty-hint">Try adjusting the search or filter</div>
                </div>
            ) : view === 'table' ? (
                /* ── Table view ─────────────────────────── */
                <div className="t-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Event Name</th>
                                <th>Venue</th>
                                <th>City</th>
                                <th>Category</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Link</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode='wait'>
                                {slice.map((e, i) => (
                                    <motion.tr
                                        key={e.id || e.event_url || i}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <td className="td-num">{(page - 1) * PAGE_SIZE + i + 1}</td>
                                        <td><div className="td-name" title={e.event_name}>{e.event_name}</div></td>
                                        <td><div className="td-venue" title={e.venue}>{e.venue || '—'}</div></td>
                                        <td><span className="c-pill">{E[e.city] ?? '📍'} {e.city}</span></td>
                                        <td>{e.category ? <span className="cat" title={e.category}>{e.category}</span> : <span style={{ color: 'var(--t3)' }}>—</span>}</td>
                                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.76rem', color: 'var(--t2)', whiteSpace: 'nowrap' }}>{e.event_date || '—'}</td>
                                        <td><span className={`badge badge-${e.status}`}>{e.status}</span></td>
                                        <td>
                                            {e.event_url
                                                ? <a className="ev-link" href={e.event_url} target="_blank" rel="noreferrer">
                                                    View <ExternalLink size={10} />
                                                </a>
                                                : <span style={{ color: 'var(--t3)' }}>—</span>}
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            ) : (
                /* ── Card view ──────────────────────────── */
                <motion.div className="card-grid" layout>
                    <AnimatePresence mode='popLayout'>
                        {slice.map((e, i) => (
                            <motion.div
                                key={e.id || e.event_url || i}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }}
                                className="ev-card"
                            >
                                <div className="ev-card-name">{e.event_name}</div>
                                <div className="ev-card-meta">
                                    {e.category && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Tag size={10} /> {e.category}
                                        </div>
                                    )}
                                    <span className={`badge badge-${e.status}`}>{e.status}</span>
                                </div>
                                <div style={{ margin: '12px 0', borderTop: '1px solid var(--border)' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {e.venue && (
                                        <div className="ev-card-venue" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <MapPin size={12} style={{ flexShrink: 0 }} /> {e.venue}
                                        </div>
                                    )}
                                    <div className="ev-card-venue" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Calendar size={12} style={{ flexShrink: 0 }} />
                                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{e.event_date || 'Date TBA'}</span>
                                    </div>
                                </div>
                                <div className="ev-card-foot">
                                    <span className="c-pill">{E[e.city] ?? '📍'} {e.city}</span>
                                    {e.event_url && (
                                        <a className="ev-link" href={e.event_url} target="_blank" rel="noreferrer">
                                            Ticket <ExternalLink size={10} />
                                        </a>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* Pagination */}
            {pages > 1 && (
                <div className="pg">
                    <button className="pg-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
                    <button className="pg-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
                    {pageButtons.map(n => (
                        <button key={n} className={`pg-btn ${n === page ? 'current' : ''}`} onClick={() => setPage(n)}>{n}</button>
                    ))}
                    <button className="pg-btn" onClick={() => setPage(p => p + 1)} disabled={page === pages}>›</button>
                    <button className="pg-btn" onClick={() => setPage(pages)} disabled={page === pages}>»</button>
                </div>
            )}
        </motion.div>
    );
}
