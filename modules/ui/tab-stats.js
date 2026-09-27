/* FQuest · modules/ui/tab-stats.js
 * Дашборд статистики: React-версия с fallback на vanilla SVG */

module.exports = {
    createTab(ctx) {
        const { esc } = ctx;

        const TYPE_LABELS = {
            VIDEO: 'Видео', GAME: 'Игры', STREAM: 'Стримы',
            ACHIEVEMENT: 'Достижения', ACTIVITY: 'Активность',
        };

        const REWARD_COLORS = {
            ORB:       '#8B5CF6',
            ORBS:      '#8B5CF6',
            ORB_PACK:  '#A78BFA',
            DECORATION: '#EC4899',
            IN_GAME:   '#F59E0B',
            UNKNOWN:   '#6B7A94',
        };

        return {
            _reactRoot: null,
            _fallbackTimer: null,

            render(container) {
                const rt = ctx.React;

                // === Если React доступен — рендерим через него ===
                if (rt && rt.isAvailable()) {
                    try {
                        const { createStatsDashboard } = ctx.modules('ui/components/stats-dashboard.js');
                        const StatsDashboard = createStatsDashboard(ctx, rt);

                        this._reactRoot = rt.render(
                            container,
                            StatsDashboard,
                            {
                                onClearHistory: () => this._refresh(),
                            },
                            () => this._renderVanilla(container)
                        );
                        return;
                    } catch (e) {
                        ctx.platform?.Logger?.warn?.('[TabStats] React render failed, fallback:', e);
                        this._renderVanilla(container);
                        return;
                    }
                }

                // === Fallback — vanilla ===
                this._renderVanilla(container);
            },

            _refresh() {
                // Форсированный ререндер через пересоздание (для vanilla)
                if (!this._reactRoot) return;
                // React сам обновится через setState при следующем тике — а мы просто ничего не делаем
                // (React-root уже отрисован, кнопка внутри вызывает setState)
            },

            unmount(container) {
                try {
                    if (ctx.React?.isAvailable()) {
                        ctx.React.unmount(container);
                    }
                } catch (_) {}
                if (this._fallbackTimer) {
                    clearInterval(this._fallbackTimer);
                    this._fallbackTimer = null;
                }
                this._reactRoot = null;
            },

            // ============================================================
            //  VANILLA FALLBACK — если React недоступен
            // ============================================================
            _renderVanilla(container) {
                const snap = ctx.Stats.snapshot();
                const fmt = (n) => String(n ?? 0);

                // === KPI ===
                const kpiCards = `
                    <div class="fq-stats-kpi">
                        <div class="fq-kpi-card fq-kpi-orbs">
                            <div class="fq-kpi-icon">🟣</div>
                            <div class="fq-kpi-value">${fmt(snap.totalOrbs)}</div>
                            <div class="fq-kpi-label">Всего Orbs</div>
                        </div>
                        <div class="fq-kpi-card">
                            <div class="fq-kpi-icon">✅</div>
                            <div class="fq-kpi-value">${fmt(snap.total)}</div>
                            <div class="fq-kpi-label">Квестов</div>
                        </div>
                        <div class="fq-kpi-card">
                            <div class="fq-kpi-icon">🎁</div>
                            <div class="fq-kpi-value">${fmt(snap.claimed)}</div>
                            <div class="fq-kpi-label">Забрано</div>
                        </div>
                        <div class="fq-kpi-card">
                            <div class="fq-kpi-icon">🔥</div>
                            <div class="fq-kpi-value">${fmt(snap.streak)}</div>
                            <div class="fq-kpi-label">Дней подряд</div>
                        </div>
                    </div>
                `;

                // === График Orbs ===
                const daily = snap.daily;
                const { line, area, max, points } = ctx.Stats.buildLinePath(daily, 640, 100);

                const xLabels = daily
                    .map((d, i) => i % 5 === 0 || i === daily.length - 1
                        ? `<text x="${(i * (640 / Math.max(1, daily.length - 1))).toFixed(0)}" y="118" 
                                fill="var(--fq-muted)" font-size="9" text-anchor="middle">${esc(d.date)}</text>`
                        : ''
                    ).join('');

                const dots = points.map((p, i) => p.v > 0
                    ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" 
                              fill="#A78BFA" stroke="#0F0F16" stroke-width="1">
                          <title>${esc(daily[i].date)}: ${p.v} Orbs</title>
                       </circle>`
                    : ''
                ).join('');

                const orbsChart = `
                    <div class="fq-chart-card">
                        <div class="fq-chart-title">Orbs за последние 30 дней</div>
                        <svg viewBox="0 0 640 120" class="fq-line-chart" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="fq-orbs-grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.4"/>
                                    <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0"/>
                                </linearGradient>
                            </defs>
                            ${area ? `<path d="${area}" fill="url(#fq-orbs-grad)"/>` : ''}
                            ${line ? `<path d="${line}" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
                            ${dots}
                            ${xLabels}
                        </svg>
                        <div class="fq-chart-meta">Максимум за день: <b>${max}</b> Orbs</div>
                    </div>
                `;

                // === Круговая диаграмма ===
                const totalCount = snap.rewardPie.reduce((s, r) => s + r.count, 0) || 1;
                let accAngle = 0;
                const pieRadius = 50;
                const cx = 60, cy = 60;

                const pieSectors = snap.rewardPie.map(r => {
                    const angle = (r.count / totalCount) * 360;
                    const start = accAngle;
                    const end = accAngle + angle;
                    accAngle = end;

                    const startRad = (start - 90) * Math.PI / 180;
                    const endRad = (end - 90) * Math.PI / 180;
                    const x1 = cx + pieRadius * Math.cos(startRad);
                    const y1 = cy + pieRadius * Math.sin(startRad);
                    const x2 = cx + pieRadius * Math.cos(endRad);
                    const y2 = cy + pieRadius * Math.sin(endRad);
                    const largeArc = angle > 180 ? 1 : 0;
                    const color = REWARD_COLORS[r.key] || REWARD_COLORS.UNKNOWN;

                    return `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${pieRadius},${pieRadius} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z"
                                  fill="${color}" stroke="var(--fq-bg)" stroke-width="2">
                                <title>${esc(r.label)}: ${r.count}</title>
                            </path>`;
                }).join('');

                const pieLegend = snap.rewardPie.map(r => `
                    <div class="fq-pie-legend-row">
                        <span class="fq-pie-dot" style="background:${REWARD_COLORS[r.key] || REWARD_COLORS.UNKNOWN}"></span>
                        <span class="fq-pie-label">${r.icon} ${esc(r.label)}</span>
                        <span class="fq-pie-value">${r.count} <span class="fq-pie-orbs">${r.orbs > 0 ? `(+${r.orbs} 🟣)` : ''}</span></span>
                    </div>
                `).join('') || '<div class="fq-empty" style="padding:10px;">Пока пусто</div>';

                const pieChart = `
                    <div class="fq-chart-card">
                        <div class="fq-chart-title">Награды по типам</div>
                        <div class="fq-pie-wrap">
                            <svg viewBox="0 0 120 120" class="fq-pie-chart">
                                ${pieSectors || `<circle cx="${cx}" cy="${cy}" r="${pieRadius}" fill="var(--fq-bg-3)"/>`}
                            </svg>
                            <div class="fq-pie-legend">${pieLegend}</div>
                        </div>
                    </div>
                `;

                // === Прогресс-бары ===
                const typeBars = Object.entries(snap.byType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => {
                        const pct = (count / snap.total) * 100;
                        return `
                            <div class="fq-type-row">
                                <span class="fq-type-label">${TYPE_LABELS[type] || type}</span>
                                <div class="fq-type-bar">
                                    <div class="fq-type-fill" style="width:${pct}%"></div>
                                </div>
                                <span class="fq-type-count">${count}</span>
                            </div>
                        `;
                    }).join('') || '<div class="fq-empty" style="padding:10px;">Пока пусто</div>';

                const typesCard = `
                    <div class="fq-chart-card">
                        <div class="fq-chart-title">Квесты по типам</div>
                        <div class="fq-type-list">${typeBars}</div>
                    </div>
                `;

                // === Последние выполненные ===
                const recentRows = snap.recent.map(r => {
                    const dt = new Date(r.completedAt);
                    const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                    const date = `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}`;
                    return `
                        <div class="fq-recent-row">
                            <span class="fq-recent-icon">${r.rewardIcon || '❓'}</span>
                            <span class="fq-recent-name" title="${esc(r.name)}">${esc(r.name)}</span>
                            <span class="fq-recent-orbs">${r.orbs > 0 ? `+${r.orbs} 🟣` : ''}</span>
                            <span class="fq-recent-date">${date} ${time}</span>
                        </div>
                    `;
                }).join('') || '<div class="fq-empty" style="padding:10px;">Пока ничего не выполнено</div>';

                const recentCard = `
                    <div class="fq-chart-card">
                        <div class="fq-chart-title">Последние выполненные</div>
                        <div class="fq-recent-list">${recentRows}</div>
                    </div>
                `;

                // === Топ-3 дня ===
                const topDaysHtml = snap.topDays.map((d, i) => `
                    <div class="fq-topday-row">
                        <span class="fq-topday-rank">#${i + 1}</span>
                        <span class="fq-topday-date">${esc(d.date)}</span>
                        <span class="fq-topday-orbs">${d.orbs} 🟣</span>
                        <span class="fq-topday-count">${d.count} кв.</span>
                    </div>
                `).join('') || '<div class="fq-empty" style="padding:10px;">Нет данных</div>';

                const topDaysCard = `
                    <div class="fq-chart-card">
                        <div class="fq-chart-title">Топ дней по Orbs</div>
                        <div class="fq-topday-list">${topDaysHtml}</div>
                    </div>
                `;

                // === Итоговая разметка ===
                container.innerHTML = `
                    <div class="fq-stats-dashboard">
                        <div class="fq-section">${kpiCards}</div>
                        <div class="fq-section">${orbsChart}</div>
                        <div class="fq-grid-2">
                            ${pieChart}
                            ${typesCard}
                        </div>
                        <div class="fq-grid-2">
                            ${topDaysCard}
                            ${recentCard}
                        </div>
                        <div class="fq-section">
                            <button class="quest-pick-btn deselect" id="fq-stats-clear">Очистить историю</button>
                        </div>
                    </div>
                `;

                container.querySelector('#fq-stats-clear')?.addEventListener('click', async () => {
                    const ok = await ctx.UI.confirm('Очистить всю историю квестов?');
                    if (!ok) return;
                    ctx.History.clear();
                    this._renderVanilla(container);
                });

                // === Авто-обновление vanilla-версии раз в 5 сек ===
                if (this._fallbackTimer) clearInterval(this._fallbackTimer);
                this._fallbackTimer = setInterval(() => {
                    // Обновляем только если контейнер всё ещё в DOM и вкладка активна
                    if (!document.body.contains(container)) {
                        clearInterval(this._fallbackTimer);
                        this._fallbackTimer = null;
                        return;
                    }
                    if (ctx.RUNTIME.activeTab !== 'stats') return;

                    // Проверяем — не открыт ли модал (не мешаем)
                    if (ctx.UI._authLocked) return;

                    // Проверяем, что пользователь не взаимодействует с чем-то важным
                    const active = document.activeElement;
                    if (active && container.contains(active) && active.tagName === 'INPUT') return;

                    // Тихо обновляем
                    try {
                        this._renderVanilla(container);
                    } catch (_) {}
                }, 5000);
            },
        };
    },
};