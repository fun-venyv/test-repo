/* ============================================================
 *  FQuest · modules/auth.js
 *  Авторизация по ключу продукта (заглушка — без сервера)
 *
 *  Позже замени API_URL и endpoints на реальные.
 *  Формат ключа: XXXX-XXXX-XXXX-XXXX (A-Z, 0-9)
 * ============================================================ */

module.exports = {
    createAuth(ctx) {
        const { Storage, api } = ctx;

        // ⚠️ ЗАГЛУШКА — заменить на реальный сервер
        const API_URL = 'https://your-fquest-server.example/api';
        const USE_MOCK = true; // true = работает без сервера (localStorage)

        // Хранилище "занятых" ключей (только для mock)
        const MOCK_USED_KEY = 'fq_mock_used_keys';

        const getMockUsed = () => {
            try {
                const raw = localStorage.getItem(MOCK_USED_KEY);
                return raw ? JSON.parse(raw) : {};
            } catch { return {}; }
        };
        const setMockUsed = (obj) => {
            try { localStorage.setItem(MOCK_USED_KEY, JSON.stringify(obj)); } catch {}
        };

        const KEY_REGEX = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

        return {
            KEY_REGEX,

            isValidFormat(key) {
                return KEY_REGEX.test(String(key || '').trim().toUpperCase());
            },

            normalize(key) {
                return String(key || '').trim().toUpperCase();
            },

            /**
             * Проверяет ключ на сервере (или mock).
             * @param {string} userId
             * @param {string} key
             * @returns {Promise<{ ok: boolean, reason?: string }>}
             */
            async verify(userId, key) {
                const k = this.normalize(key);
                if (!this.isValidFormat(k)) return { ok: false, reason: 'invalid-format' };

                if (USE_MOCK) return this._mockVerify(userId, k);

                try {
                    const res = await fetch(`${API_URL}/auth/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, key: k }),
                    });
                    const data = await res.json();
                    return data;
                } catch (e) {
                    return { ok: false, reason: 'network', error: e?.message };
                }
            },

            /**
             * Регистрирует ключ за пользователем.
             */
            async register(userId, key) {
                const k = this.normalize(key);
                if (!this.isValidFormat(k)) return { ok: false, reason: 'invalid-format' };

                if (USE_MOCK) return this._mockRegister(userId, k);

                try {
                    const res = await fetch(`${API_URL}/auth/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, key: k }),
                    });
                    const data = await res.json();
                    return data;
                } catch (e) {
                    return { ok: false, reason: 'network', error: e?.message };
                }
            },

            // ===== MOCK (без сервера) =====
            // Правило: любой ключ, начинающийся с "TEST" или "DEMO", всегда валиден.
            // Остальные — регистрируются за первым userId, который их использовал.
            _mockRegister(userId, key) {
                const used = getMockUsed();
                const owner = used[key];

                // Демо-ключи всегда свободны
                if (key.startsWith('TEST') || key.startsWith('DEMO')) {
                    return { ok: true, mock: true };
                }

                if (owner && owner !== userId) {
                    return { ok: false, reason: 'busy', mock: true };
                }
                used[key] = userId;
                setMockUsed(used);
                return { ok: true, mock: true };
            },

            _mockVerify(userId, key) {
                if (key.startsWith('TEST') || key.startsWith('DEMO')) {
                    return { ok: true, mock: true };
                }
                const used = getMockUsed();
                const owner = used[key];
                if (!owner) return { ok: false, reason: 'not-registered', mock: true };
                if (owner !== userId) return { ok: false, reason: 'busy', mock: true };
                return { ok: true, mock: true };
            },

            reasonText(reason) {
                return {
                    'invalid-format': 'Неверный формат ключа. Ожидается XXXX-XXXX-XXXX-XXXX',
                    'busy': 'Этот ключ уже привязан к другому аккаунту',
                    'invalid': 'Ключ не существует',
                    'not-registered': 'Ключ не зарегистрирован',
                    'network': 'Сервер недоступен. Попробуйте позже',
                }[reason] || 'Ошибка авторизации';
            },
        };
    },
};