'use client';

import { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Ticket, CalendarCheck, Clock, MapPin, Star } from 'lucide-react';

const SPARKS = [
    [40, 55, 35, 70, 50, 80, 60, 75],
    [30, 60, 45, 65, 80, 55, 70, 90],
    [70, 80, 90, 85, 95, 88, 92, 98],
    [50, 35, 60, 40, 70, 45, 55, 30],
    [60, 80, 50, 70, 40, 90, 65, 75],
];

function Counter({ value }) {
    const spring = useSpring(0, { bounce: 0, duration: 2000 });
    const display = useTransform(spring, (current) => Math.round(current));

    useEffect(() => {
        spring.set(value);
    }, [value, spring]);

    return <motion.span>{display}</motion.span>;
}

export default function StatsCards({ analytics, eventsCount, selectedCity }) {
    if (!analytics) return null;
    const f = selectedCity && selectedCity !== 'all';

    const cards = [
        {
            icon: Ticket,
            value: analytics.total,
            label: f ? `Events · ${selectedCity}` : 'Total Events',
            tag: 'All time',
            color: 'var(--purple)',
            bg: 'rgba(124, 107, 255, 0.14)'
        },
        {
            icon: CalendarCheck,
            value: analytics.upcoming,
            label: 'Upcoming',
            tag: 'Active',
            color: 'var(--teal)',
            bg: 'rgba(0, 245, 196, 0.1)'
        },
        {
            icon: Star,
            value: analytics.today ?? 0,
            label: 'Happening Today',
            tag: 'Live',
            color: 'var(--amber)',
            bg: 'rgba(251, 191, 36, 0.1)'
        },
        {
            icon: Clock,
            value: analytics.expired,
            label: 'Expired',
            tag: 'Past',
            color: 'var(--pink)',
            bg: 'rgba(255, 92, 168, 0.1)'
        },
        {
            icon: MapPin,
            value: analytics.cities,
            label: 'Cities Tracked',
            tag: 'Live',
            color: 'var(--amber)',
            bg: 'rgba(251, 191, 36, 0.1)'
        },
    ];

    return (
        <div className="stats">
            {cards.map((c, i) => (
                <motion.div
                    key={i}
                    className="scard"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, type: 'spring', stiffness: 100, damping: 15 }}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                >
                    {/* Top accent bar */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                        background: c.color, borderRadius: '20px 20px 0 0', opacity: 0.8
                    }} />

                    <div className="scard-top">
                        <div className="scard-icon" style={{ background: c.bg, color: c.color }}>
                            <c.icon size={22} strokeWidth={2.5} />
                        </div>
                        <span className="scard-badge">{c.tag}</span>
                    </div>

                    <div className="scard-val" style={{ color: c.color }}>
                        {c.value != null ? <Counter value={c.value} /> : '—'}
                    </div>
                    <div className="scard-label">{c.label}</div>

                    {/* Sparkline */}
                    <div className="scard-spark">
                        {SPARKS[i].map((h, j) => (
                            <motion.div
                                key={j}
                                className="spark-bar"
                                style={{ height: `${h}%`, background: c.color }}
                                initial={{ scaleY: 0 }}
                                animate={{ scaleY: 1 }}
                                transition={{ delay: 0.5 + j * 0.05, duration: 0.5 }}
                            />
                        ))}
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
