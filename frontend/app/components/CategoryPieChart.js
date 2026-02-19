'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { PieChart as PieIcon } from 'lucide-react';

const FILLS = [
    '#7c6bff', '#ff5ca8', '#00f5c4', '#fbbf24',
    '#38bdf8', '#ff8c4c', '#a78bfa', '#34d399',
];

const Tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    const total = d.payload.total;
    const pct = total ? Math.round((d.value / total) * 100) : 0;
    return (
        <div style={{
            background: 'var(--bg-card-s)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '10px 16px', backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)', maxWidth: 200,
        }}>
            <div style={{ fontWeight: 700, color: 'var(--t1)', marginBottom: 4, wordBreak: 'break-word' }}>{d.name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ color: d.payload.fill, fontWeight: 800, fontSize: '1.2rem' }}>{d.value}</span>
                <span style={{ color: 'var(--t3)', fontSize: '0.72rem' }}>({pct}%)</span>
            </div>
        </div>
    );
};

export default function CategoryPieChart({ data }) {
    if (!data?.length) {
        return (
            <motion.div
                className="c-card"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            >
                <div className="c-head">
                    <div className="c-title">Events by Category</div>
                    <div className="c-sub">Top categories</div>
                </div>
                <div className="empty">
                    <PieIcon size={48} strokeWidth={1} style={{ opacity: 0.5, marginBottom: 16 }} />
                    <div className="empty-msg">No category data yet</div>
                </div>
            </motion.div>
        );
    }

    const top = [...data].sort((a, b) => b.count - a.count).slice(0, 8);
    const total = top.reduce((s, d) => s + d.count, 0);
    const cd = top.map((d, i) => ({
        name: d.category || 'Other',
        value: d.count,
        fill: FILLS[i % FILLS.length],
        total,
    }));

    return (
        <motion.div
            className="c-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
        >
            <div className="c-head">
                <div className="c-title">Events by Category</div>
                <div className="c-sub">{top.length} categories · {total} events</div>
            </div>

            <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                    <Pie
                        data={cd} cx="50%" cy="50%"
                        innerRadius={58} outerRadius={92}
                        paddingAngle={3} dataKey="value" strokeWidth={0}
                        animationBegin={300} animationDuration={1000} animationEasing="ease-out"
                    >
                        {cd.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip content={<Tip />} />
                    <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central"
                        style={{ fontSize: '1.4rem', fontWeight: 800, fill: 'var(--t1)' }}>
                        {total}
                    </text>
                    <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central"
                        style={{ fontSize: '0.65rem', fontWeight: 500, fill: 'var(--t3)' }}>
                        events
                    </text>
                </PieChart>
            </ResponsiveContainer>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', marginTop: 4 }}>
                {cd.map((d, i) => {
                    const pct = total ? Math.round((d.value / total) * 100) : 0;
                    return (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + i * 0.05 }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
                        >
                            <span style={{
                                width: 7, height: 7, borderRadius: '50%',
                                background: d.fill, flexShrink: 0,
                                boxShadow: `0 0 6px ${d.fill}66`,
                            }} />
                            <span style={{
                                fontSize: '0.7rem', color: 'var(--t2)', flex: 1,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{d.name}</span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--t3)', fontWeight: 600, flexShrink: 0 }}>
                                {pct}%
                            </span>
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
}
