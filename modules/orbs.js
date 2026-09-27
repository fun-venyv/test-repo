/* ============================================================
 *  FQuest · modules/orbs.js
 *  Парсинг наград из quest.rewardsConfig и извлечение Orbs
 * ============================================================ */

module.exports = {
    createOrbs(ctx) {
        // Типы наград Discord (из rewardsConfig.rewards[].type)
        const REWARD_TYPES = {
            0: { key: 'UNKNOWN',     label: 'Неизвестно',  orbValue: 0,  icon: '❓' },
            1: { key: 'IN_GAME',     label: 'В игре',      orbValue: 0,  icon: '🎮' },
            2: { key: 'ORB',         label: 'Orbs',        orbValue: 1,  icon: '🟣' },
            3: { key: 'DECORATION',  label: 'Украшение',   orbValue: 0,  icon: '🎨' },
            4: { key: 'ORBS',        label: 'Orbs',        orbValue: 1,  icon: '🟣' },
            5: { key: 'ORB_PACK',    label: 'Набор Orbs',  orbValue: 1,  icon: '🟣' },
        };

        return {
            REWARD_TYPES,

            /**
             * Возвращает мета-инфу о награде из quest.
             * @param {object} quest
             * @returns {{ type: number, key: string, label: string, orbs: number, icon: string, raw: object|null }}
             */
            parseReward(quest) {
                try {
                    const rewardsCfg = quest?.config?.rewardsConfig ?? quest?.config?.rewardsConfigV2;
                    const reward = rewardsCfg?.rewards?.[0];
                    if (!reward) {
                        return { type: 0, key: 'UNKNOWN', label: 'Неизвестно', orbs: 0, icon: '❓', raw: null };
                    }

                    const typeNum = reward.type ?? 0;
                    const meta = REWARD_TYPES[typeNum] || REWARD_TYPES[0];

                    // Пытаемся достать точное количество Orbs
                    let orbs = 0;
                    if (meta.key === 'ORB' || meta.key === 'ORBS' || meta.key === 'ORB_PACK') {
                        orbs = this._extractOrbAmount(reward);
                    }

                    return {
                        type: typeNum,
                        key: meta.key,
                        label: reward.messages?.name || meta.label,
                        orbs,
                        icon: meta.icon,
                        raw: reward,
                    };
                } catch (e) {
                    ctx.platform?.Logger?.warn?.('[Orbs] parseReward failed:', e);
                    return { type: 0, key: 'UNKNOWN', label: 'Ошибка', orbs: 0, icon: '❓', raw: null };
                }
            },

            /**
             * Пытается извлечь количество Orbs из разных полей reward.
             * Discord не всегда кладёт точное число в одно место.
             */
            _extractOrbAmount(reward) {
                // 1) Прямые поля
                const direct = reward?.orbs
                    ?? reward?.amount
                    ?? reward?.quantity
                    ?? reward?.orb_amount
                    ?? reward?.value;
                if (typeof direct === 'number' && direct > 0) return direct;

                // 2) В messages
                const msgOrbs = reward?.messages?.orbs
                    ?? reward?.messages?.amount
                    ?? reward?.messages?.quantity;
                if (typeof msgOrbs === 'number' && msgOrbs > 0) return msgOrbs;

                // 3) Парсинг из названия: "5 Orbs", "10 Orbs", "Orbs x5", "+5 Orbs"
                const name = String(reward?.messages?.name || '');
                const match = name.match(/(\d+)\s*orb/i) || name.match(/orb[s]?\s*[x×]\s*(\d+)/i);
                if (match) {
                    const n = parseInt(match[1], 10);
                    if (!Number.isNaN(n) && n > 0) return n;
                }

                // 4) Если это ORB-награда, но число не нашли — возвращаем 1 как минимальный факт
                return 1;
            },

            /**
             * Возвращает true, если награда содержит Orbs.
             */
            isOrbReward(quest) {
                const r = this.parseReward(quest);
                return r.orbs > 0 || r.key === 'ORB' || r.key === 'ORBS' || r.key === 'ORB_PACK';
            },

            /**
             * Группирует список квестов по типу награды.
             * @param {Array} quests
             * @returns {Object<string, { count: number, orbs: number, label: string, icon: string }>}
             */
            groupByReward(quests) {
                const groups = {};
                for (const q of quests) {
                    const r = this.parseReward(q);
                    if (!groups[r.key]) {
                        groups[r.key] = { count: 0, orbs: 0, label: r.label, icon: r.icon };
                    }
                    groups[r.key].count++;
                    groups[r.key].orbs += r.orbs;
                }
                return groups;
            },
        };
    },
};