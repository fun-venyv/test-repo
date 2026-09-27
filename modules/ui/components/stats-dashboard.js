/* ============================================================
 *  FQuest · modules/ui/components/stats-dashboard.js
 *  React-дашборд статистики Orbs
 * ============================================================ */

module.exports = {
    /**
     * @param {object} ctx
     * @param {object} rt   — react-runtime
     * @returns {function}  — React-компонент
     */
    createStatsDashboard(ctx, rt) {
        const { esc } = ctx;
        const React = rt.getReact();
        const { useState, useEffect, useRef, useMemo } = rt.hooks;

        const REWARD_COLORS = {
            ORB:       '#8B5CF6',
            ORBS:      '#8B5CF6',
            ORB_PACK:  '#A78BFA',
            DECORATION: '#EC4899',
            IN_GAME:   '#F59E0B',
            UNKNOWN:   '#6B7A94',
        };

        const TYPE_LABELS = {
            VIDEO: 'Видео', GAME: 'Игры', STREAM: 'Стримы',
            ACHIEVEMENT: 'Достижения', ACTIVITY: 'Активность',
        };

        // === Анимированный счётчик ===
        function AnimatedNumber({ value, duration = 800 }) {
            const [display, setDisplay] = useState(value);
            const prevRef = useRef(value);

            useEffect(() => {
                const start = prevRef.current;
                const end = value;
                if (start === end) return;
                const t0 = performance.now();
                let raf;

                const tick = (t) => {
                    const p = Math.min(1, (t - t0) / duration);
                    const ease = 1 - Math.pow(1 - p, 3); // easeOutCubic
                    setDisplay(Math.round(start + (end - start) * ease));
                    if (p < 1) raf = requestAnimationFrame(tick);
                    else prevRef.current = end;
                };
                raf = requestAnimationFrame(tick);
                return () => cancelAnimationFrame(raf);
            }, [value, duration]);

            return React.createElement('span', null, display);
        }

        // === KPI-карточка ===
        function KpiCard({ icon, value, label, accent }) {
            const h = rt.h;
            return h('div', {
                className: `fq-kpi-card ${accent ? 'fq-kpi-orbs' : ''}`,
            },
                h('div', { className: 'fq-kpi-icon' }, icon),
                h('div', { className: 'fq-kpi-value' },
                    React.createElement(AnimatedNumber, { value })
                ),
                h('div', { className: 'fq-kpi-label' }, label)
            );
        }

        // === Линейный график Orbs ===
        function OrbsChart({ daily }) {
            const h = rt.h;
            const [hover, setHover] = useState(null);

            const w = 640, hh = 120;
            const max = Math.max(1, ...daily.map(d => d.orbs));
            const stepX = daily.length > 1 ? w / (daily.length - 1) : w;

            const points = daily.map((d, i) => ({
                x: i * stepX,
                y: hh - (d.orbs / max) * (hh - 15) - 5,
                v: d.orbs,
                date: d.date,
                i,
            }));

            const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            const area = `${line} L${w},${hh} L0,${hh} Z`;

            return h('div', { className: 'fq-chart-card' },
                h('div', { className: 'fq-chart-title' }, 'Orbs за последние 30 дней'),
                h('svg', {
                    viewBox: `0 0 ${w} ${hh + 20}`,
                    className: 'fq-line-chart',
                    preserveAspectRatio: 'none',
                    style: { overflow: 'visible' },
                },
                    h('defs', null,
                        h('linearGradient', { id: 'fq-orbs-grad', x1: 0, y1: 0, x2: 0, y2: 1 },
                            h('stop', { offset: '0%', stopColor: '#8B5CF6', stopOpacity: 0.4 }),
                            h('stop', { offset: '100%', stopColor: '#8B5CF6', stopOpacity: 0 })
                        )
                    ),
                    h('path', { d: area, fill: 'url(#fq-orbs-grad)' }),
                    h('path', {
                        d: line,
                        fill: 'none',
                        stroke: '#A78BFA',
                        strokeWidth: 2,
                        strokeLinejoin: 'round',
                        strokeLinecap: 'round',
                    }),
                    // Точки
                    ...points.map((p, i) => p.v > 0
                        ? h('circle', {
                            key: i,
                            cx: p.x, cy: p.y, r: hover?.i === i ? 5 : 2.5,
                            fill: '#A78BFA', stroke: '#0F0F16', strokeWidth: 1,
                            style: { cursor: 'pointer', transition: 'r .15s' },
                            onMouseEnter: () => setHover(p),
                            onMouseLeave: () => setHover(null),
                        })
                        : null
                    ),
                    // X-метки (каждые 5 дней)
                    ...daily.map((d, i) => i % 5 === 0 || i === daily.length - 1
                        ? h('text', {
                            key: `x${i}`,
                            x: i * stepX, y: hh + 15,
                            fill: 'var(--fq-muted)', fontSize: 9,
                            textAnchor: 'middle',
                        }, d.date)
                        : null
                    )
                ),
                hover
                    ? h('div', { className: 'fq-chart-hover' },
                        `${hover.date}: ${hover.v} Orbs`)
                    : h('div', { className: 'fq-chart-meta' },
                        'Максимум за день: ', h('b', null, max), ' Orbs')
            );
        }

        // === Круговая диаграмма ===
        function PieChart({ rewardPie }) {
            const h = rt.h;
            const total = rewardPie.reduce((s, r) => s + r.count, 0) || 1;
            const cx = 60, cy = 60, r = 50;

            let acc = 0;
            const sectors = rewardPie.map((item) => {
                const angle = (item.count / total) * 360;
                const start = acc;
                const end = acc + angle;
                acc = end;

                const startRad = (start - 90) * Math.PI / 180;
                const endRad = (end - 90) * Math.PI / 180;
                const x1 = cx + r * Math.cos(startRad);
                const y1 = cy + r * Math.sin(startRad);
                const x2 = cx + r * Math.cos(endRad);
                const y2 = cy + r * Math.sin(endRad);
                const largeArc = angle > 180 ? 1 : 0;
                const color = REWARD_COLORS[item.key] || REWARD_COLORS.UNKNOWN;

                return h('path', {
                    key: item.key,
                    d: `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`,
                    fill: color,
                    stroke: 'var(--fq-bg)',
                    strokeWidth: 2,
                });
            });

            const legend = rewardPie.map((item) =>
                h('div', { key: item.key, className: 'fq-pie-legend-row' },
                    h('span', {
                        className: 'fq-pie-dot',
                        style: { background: REWARD_COLORS[item.key] || REWARD_COLORS.UNKNOWN },
                    }),
                    h('span', { className: 'fq-pie-label' }, `${item.icon} ${item.label}`),
                    h('span', { className: 'fq-pie-value' },
                        String(item.count),
                        item.orbs > 0
                            ? h('span', { className: 'fq-pie-orbs' }, ` (+${item.orbs} 🟣)`)
                            : null
                    )
                )
            );

            return h('div', { className: 'fq-chart-card' },
                h('div', { className: 'fq-chart-title' }, 'Награды по типам'),
                h('div', { className: 'fq-pie-wrap' },
                    h('svg', { viewBox: '0 0 120 120', className: 'fq-pie-chart' },
                        sectors.length
                            ? sectors
                            : h('circle', { cx, cy, r, fill: 'var(--fq-bg-3)' })
                    ),
                    h('div', { className: 'fq-pie-legend' },
                        legend.length ? legend : h('div', { className: 'fq-empty' }, 'Пока пусто')
                    )
                )
            );
        }

        // === Прогресс-бары по типам ===
        function TypeBars({ byType, total }) {
            const h = rt.h;
            const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
            return h('div', { className: 'fq-chart-card' },
                h('div', { className: 'fq-chart-title' }, 'Квесты по типам'),
                h('div', { className: 'fq-type-list' },
                    entries.length
                        ? entries.map(([type, count]) =>
                            h('div', { key: type, className: 'fq-type-row' },
                                h('span', { className: 'fq-type-label' }, TYPE_LABELS[type] || type),
                                h('div', { className: 'fq-type-bar' },
                                    h('div', {
                                        className: 'fq-type-fill',
                                        style: {
                                            width: `${(count / total) * 100}%`,
                                            transition: 'width .6s cubic-bezier(.16,1,.3,1)',
                                        },
                                    })
                                ),
                                h('span', { className: 'fq-type-count' }, String(count))
                            )
                        )
                        : h('div', { className: 'fq-empty' }, 'Пока пусто')
                )
            );
        }

        // === Последние выполненные ===
        function RecentList({ recent }) {
            const h = rt.h;
            return h('div', { className: 'fq-chart-card' },
                h('div', { className: 'fq-chart-title' }, 'Последние выполненные'),
                h('div', { className: 'fq-recent-list' },
                    recent.length
                        ? recent.map((r) => {
                            const dt = new Date(r.completedAt);
                            const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                            const date = `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}`;
                            return h('div', { key: r.id, className: 'fq-recent-row' },
                                h('span', { className: 'fq-recent-icon' }, r.rewardIcon || '❓'),
                                h('span', { className: 'fq-recent-name', title: r.name }, r.name),
                                h('span', { className: 'fq-recent-orbs' }, r.orbs > 0 ? `+${r.orbs} 🟣` : ''),
                                h('span', { className: 'fq-recent-date' }, `${date} ${time}`)
                            );
                        })
                        : h('div', { className: 'fq-empty' }, 'Пока ничего не выполнено')
                )
            );
        }

        // === Топ дней ===
        function TopDays({ topDays }) {
            const h = rt.h;
            return h('div', { className: 'fq-chart-card' },
                h('div', { className: 'fq-chart-title' }, 'Топ дней по Orbs'),
                h('div', { className: 'fq-topday-list' },
                    topDays.length
                        ? topDays.map((d, i) =>
                            h('div', { key: d.date, className: 'fq-topday-row' },
                                h('span', { className: 'fq-topday-rank' }, `#${i + 1}`),
                                h('span', { className: 'fq-topday-date' }, d.date),
                                h('span', { className: 'fq-topday-orbs' }, `${d.orbs} 🟣`),
                                h('span', { className: 'fq-topday-count' }, `${d.count} кв.`)
                            )
                        )
                        : h('div', { className: 'fq-empty' }, 'Нет данных')
                )
            );
        }

        // === ГЛАВНЫЙ КОМПОНЕНТ ===
        return function StatsDashboard({ onClearHistory }) {
            const h = rt.h;
            const [snap, setSnap] = useState(() => ctx.Stats.snapshot());
            const [tick, setTick] = useState(0);

            // Auto-refresh раз в 5 сек (тихо)
            useEffect(() => {
                const id = setInterval(() => {
                    try {
                        setSnap(ctx.Stats.snapshot());
                    } catch (_) {}
                }, 5000);
                return () => clearInterval(id);
            }, []);

            const daily = snap.daily;
            const kpis = h('div', { className: 'fq-stats-kpi' },
                h(KpiCard, { icon: '🟣', value: snap.totalOrbs, label: 'Всего Orbs', accent: true }),
                h(KpiCard, { icon: '✅', value: snap.total, label: 'Квестов' }),
                h(KpiCard, { icon: '🎁', value: snap.claimed, label: 'Забрано' }),
                h(KpiCard, { icon: '🔥', value: snap.streak, label: 'Дней подряд' })
            );

            const handleClear = async () => {
                const ok = await ctx.UI.confirm('Очистить всю историю квестов?');
                if (!ok) return;
                ctx.History.clear();
                setSnap(ctx.Stats.snapshot());
                if (typeof onClearHistory === 'function') onClearHistory();
            };

            return h('div', { className: 'fq-stats-dashboard' },
                h('div', { className: 'fq-section' }, kpis),
                h('div', { className: 'fq-section' }, h(OrbsChart, { daily })),
                h('div', { className: 'fq-grid-2' },
                    h(PieChart, { rewardPie: snap.rewardPie }),
                    h(TypeBars, { byType: snap.byType, total: snap.total })
                ),
                h('div', { className: 'fq-grid-2' },
                    h(TopDays, { topDays: snap.topDays }),
                    h(RecentList, { recent: snap.recent })
                ),
                h('div', { className: 'fq-section' },
                    h('button', {
                        className: 'quest-pick-btn deselect',
                        onClick: handleClear,
                    }, 'Очистить историю')
                )
            );
        };
    },
};