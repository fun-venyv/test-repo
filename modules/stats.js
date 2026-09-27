/* ============================================================
 *  FQuest · modules/stats.js
 *  Агрегатор статистики для дашборда
 * ============================================================ */

module.exports = {
    createStats(ctx) {
        return {
            /**
             * Полный снапшот статистики для дашборда.
             */
            snapshot() {
                const s = ctx.History.stats();
                const all = ctx.History.getAll();

                // Последние 10 выполненных
                const recent = all.slice(0, 10);

                // Топ-3 дня по Orbs
                const topDays = [...s.daily]
                    .filter(d => d.orbs > 0)
                    .sort((a, b) => b.orbs - a.orbs)
                    .slice(0, 3);

                // Разбивка по типам наград для круговой диаграммы
                const rewardPie = Object.entries(s.byReward).map(([key, v]) => ({
                    key,
                    label: this._rewardLabel(key),
                    icon: v.icon,
                    count: v.count,
                    orbs: v.orbs,
                }));

                return {
                    total: s.total,
                    claimed: s.claimed,
                    totalOrbs: s.totalOrbs,
                    claimedOrbs: s.claimedOrbs,
                    avgMs: s.avgMs,
                    streak: s.streak,
                    byType: s.byType,
                    byReward: s.byReward,
                    daily: s.daily,
                    recent,
                    topDays,
                    rewardPie,
                };
            },

            _rewardLabel(key) {
                return {
                    ORB: 'Orbs',
                    ORBS: 'Orbs',
                    ORB_PACK: 'Orbs',
                    DECORATION: 'Украшения',
                    IN_GAME: 'В игре',
                    UNKNOWN: 'Прочее',
                }[key] || key;
            },

            /**
             * Генерирует SVG path для линейного графика Orbs по дням.
             * @param {Array<{orbs: number}>} daily
             * @param {number} w  ширина
             * @param {number} h  высота
             * @returns {{ line: string, area: string, max: number, points: Array<{x: number, y: number, v: number}> }}
             */
            buildLinePath(daily, w = 320, h = 80) {
                if (!daily.length) return { line: '', area: '', max: 0, points: [] };
                const max = Math.max(1, ...daily.map(d => d.orbs));
                const stepX = daily.length > 1 ? w / (daily.length - 1) : w;
                const pts = daily.map((d, i) => {
                    const x = i * stepX;
                    const y = h - (d.orbs / max) * (h - 10) - 5;
                    return { x, y, v: d.orbs };
                });

                const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
                const area = `${line} L${w},${h} L0,${h} Z`;

                return { line, area, max, points: pts };
            },
        };
    },
};