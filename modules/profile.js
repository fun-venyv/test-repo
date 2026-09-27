/* ============================================================
 *  FQuest · modules/profile.js
 *  Управление профилем пользователя (userId + ключ + Discord-данные)
 * ============================================================ */

module.exports = {
    createProfile(ctx) {
        const { Storage, platform } = ctx;

        const PROFILE_KEY = 'fq_user_profile';

        return {
            /**
             * Загружает профиль из Storage.
             * @returns {{ userId: string, key: string, username?: string, avatar?: string, createdAt?: number } | null}
             */
            load() {
                try {
                    const raw = localStorage.getItem(PROFILE_KEY);
                    if (!raw) return null;
                    const p = JSON.parse(raw);
                    if (!p?.userId || !p?.key) return null;
                    return p;
                } catch { return null; }
            },

            save(profile) {
                try {
                    localStorage.setItem(PROFILE_KEY, JSON.stringify({
                        ...profile,
                        createdAt: profile.createdAt || Date.now(),
                    }));
                    return true;
                } catch { return false; }
            },

            clear() {
                try { localStorage.removeItem(PROFILE_KEY); } catch {}
            },

            /**
             * Получает текущего пользователя Discord.
             * @returns {{ id: string, username: string, globalName?: string, avatar?: string } | null}
             */
            getDiscordUser() {
                try {
                    const userStore = platform.Webpack.getStore('UserStore');
                    const u = userStore?.getCurrentUser?.();
                    if (!u) return null;
                    return {
                        id: u.id,
                        username: u.username,
                        globalName: u.globalName,
                        avatar: u.avatar,
                        avatarUrl: this.getAvatarUrl(u),
                    };
                } catch (e) {
                    platform.Logger.warn('[Profile] getDiscordUser failed:', e);
                    return null;
                }
            },

            getAvatarUrl(user) {
                if (!user) return null;
                try {
                    if (user.avatar) {
                        const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
                        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
                    }
                    const idx = user.discriminator && user.discriminator !== '0'
                        ? parseInt(user.discriminator) % 5
                        : (BigInt(user.id) >> 22n) % 6n;
                    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
                } catch { return null; }
            },

            /**
             * Синхронизирует данные Discord в профиль.
             */
            syncDiscord() {
                const p = this.load();
                if (!p) return null;
                const u = this.getDiscordUser();
                if (!u) return p;
                const updated = {
                    ...p,
                    userId: u.id,
                    username: u.globalName || u.username,
                    avatar: u.avatarUrl,
                };
                this.save(updated);
                return updated;
            },

            maskKey(key) {
                if (!key) return '••••-••••-••••-••••';
                const parts = String(key).split('-');
                if (parts.length !== 4) return key;
                return `${parts[0]}-••••-••••-${parts[3]}`;
            },
        };
    },
};