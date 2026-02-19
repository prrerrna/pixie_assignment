'use client';

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { motion } from 'framer-motion';
import { BarChart2 } from 'lucide-react';

const FILLS = [
    ['#7c6bff', '#b49aff'],
    ['#ff5ca8', '#ff8ed0'],
    ['#00f5c4', '#6efce0'],
    ['#fbbf24', '#fdd96a'],
    ['#38bdf8', '#7dd3fc'],
    ['#ff8c4c', '#ffb088'],
];

const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
                background: 'var(--bg-card-s)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '10px 16px', backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
        >
            <div style={{ fontWeight: 700, textTransform: 'capitalize', color: 'var(--t1)', marginBottom: 3 }}>{label}</div>
            <div style={{ color: 'var(--purple)', fontWeight: 800, fontSize: '1.2rem' }}>{payload[0].value}</div>
            <div style={{ color: 'var(--t3)', fontSize: '0.7rem' }}>events scraped</div>
        </motion.div>
    );
};

export default function CityBarChart({ data, theme }) {
    const ax = theme === 'dark' ? '#4a5580' : '#8892b8';

    if (!data?.length) {
        return (
            <motion.div
                className="c-card"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            >
                <div className="c-head">
                    <div className="c-title">Events by City</div>
                    <div className="c-sub">Distribution across cities</div>
                </div>
                <div className="empty">
                    <BarChart2 size={48} strokeWidth={1} style={{ opacity: 0.5, marginBottom: 16 }} />
                    <div className="empty-msg">No city data yet</div>
                    <div className="empty-hint">Scrape a city to see data</div>
                </div>
            </motion.div>
        );
    }

    const sorted = [...data].sort((a, b) => b.count - a.count);

    return (
        <motion.div
            className="c-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
        >
            <div className="c-head">
                <div className="c-title">Events by City</div>
                <div className="c-sub">{sorted.length} cities · {sorted.reduce((s, d) => s + d.count, 0)} total events</div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sorted} margin={{ top: 20, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                        {sorted.map((_, i) => (
                            <linearGradient key={i} id={`bar-g-${i}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={FILLS[i % FILLS.length][0]} />
                                <stop offset="100%" stopColor={FILLS[i % FILLS.length][1]} stopOpacity={0.6} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                        dataKey="city"
                        tick={{ fill: ax, fontSize: 11, fontWeight: 500 }}
                        tickLine={false} axisLine={false}
                        tickFormatter={v => v.charAt(0).toUpperCase() + v.slice(1)}
                    />
                    <YAxis tick={{ fill: ax, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(124,107,255,0.05)' }} content={<Tip />} />
                    <Bar
                        dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={56}
                        animationDuration={1500} animationEasing="ease-out"
                    >
                        {sorted.map((_, i) => (
                            <Cell key={i} fill={`url(#bar-g-${i})`} />
                        ))}
                        <LabelList dataKey="count" position="top" style={{ fill: ax, fontSize: 11, fontWeight: 700 }} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </motion.div>
    );
}
