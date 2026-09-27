/* ============================================================
 *  FQuest · modules/platform.js
 *  Универсальный адаптер для BetterDiscord и Vencord
 * ============================================================ */

module.exports = {
    createPlatform(meta) {
        const isVencord = typeof Vencord !== 'undefined' && typeof definePlugin !== 'undefined';
        const isBD = typeof BdApi !== 'undefined';

        // ============ DATA ============
        const Data = (() => {
            if (isVencord) {
                return {
                    load(key) {
                        try {
                            const raw = Vencord.Data.load(key);
                            if (raw === undefined || raw === null) return null;
                            if (typeof raw === 'string') {
                                try { return JSON.parse(raw); } catch { return raw; }
                            }
                            return raw;
                        } catch (_) { return null; }
                    },
                    save(key, value) {
                        try { Vencord.Data.save(key, value); return true; }
                        catch (_) { return false; }
                    },
                    delete(key) {
                        try { Vencord.Data.delete(key); return true; }
                        catch (_) { return false; }
                    },
                };
            }
            if (isBD) {
                return {
                    load(key) {
                        try {
                            const raw = BdApi.Data.load(meta.name, key);
                            if (raw === undefined || raw === null) return null;
                            if (typeof raw === 'string') {
                                try { return JSON.parse(raw); } catch { return raw; }
                            }
                            return raw;
                        } catch (_) { return null; }
                    },
                    save(key, value) {
                        try { BdApi.Data.save(meta.name, key, value); return true; }
                        catch (_) { return false; }
                    },
                    delete(key) {
                        try { BdApi.Data.delete(meta.name, key); return true; }
                        catch (_) { return false; }
                    },
                };
            }
            // Fallback — localStorage
            const PREFIX = 'fquest_';
            return {
                load(key) {
                    try {
                        const raw = localStorage.getItem(PREFIX + key);
                        if (!raw) return null;
                        try { return JSON.parse(raw); } catch { return raw; }
                    } catch (_) { return null; }
                },
                save(key, value) {
                    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
                    catch (_) { return false; }
                },
                delete(key) {
                    try { localStorage.removeItem(PREFIX + key); return true; }
                    catch (_) { return false; }
                },
            };
        })();

        // ============ WEBPACK ============
        const Webpack = {
            getStore(name) {
                try {
                    if (isVencord) {
                        const { findStore, findByProps } = Vencord.Webpack;
                        if (findStore) return findStore(name);
                    }
                    if (isBD) {
                        return BdApi.Webpack.getStore(name);
                    }
                } catch (_) {}
                // Fallback через webpackChunkdiscord_app
                try {
                    let wpRequire;
                    webpackChunkdiscord_app.push([[Symbol()], {}, r => { wpRequire = r; }]);
                    webpackChunkdiscord_app.pop();
                    const stores = Object.values(wpRequire.c);
                    return stores.find(x => x?.exports?.A?.__proto__?.getStoreName === name)?.exports?.A;
                } catch (_) { return null; }
            },

            getByKeys(...keys) {
                try {
                    if (isVencord && Vencord.Webpack.findByProps) {
                        return Vencord.Webpack.findByProps(...keys);
                    }
                    if (isBD) return BdApi.Webpack.getByKeys(...keys);
                } catch (_) {}
                try {
                    let wpRequire;
                    webpackChunkdiscord_app.push([[Symbol()], {}, r => { wpRequire = r; }]);
                    webpackChunkdiscord_app.pop();
                    return Object.values(wpRequire.c).find(m => {
                        const ex = m?.exports;
                        return ex && keys.every(k => ex[k] !== undefined);
                    })?.exports;
                } catch (_) { return null; }
            },

            getModule(filter) {
                try {
                    if (isVencord && Vencord.Webpack.findByProps) {
                        // Vencord имеет findExportedComponent, findStore и т.д.
                    }
                    if (isBD) return BdApi.Webpack.getModule(filter);
                } catch (_) {}
                try {
                    let wpRequire;
                    webpackChunkdiscord_app.push([[Symbol()], {}, r => { wpRequire = r; }]);
                    webpackChunkdiscord_app.pop();
                    return Object.values(wpRequire.c).map(m => m?.exports).find(filter);
                } catch (_) { return null; }
            },
        };

        // ============ UI ============
        const UI = {
            showToast(message, opts = {}) {
                try {
                    if (isBD) {
                        BdApi.UI.showToast(message, { type: opts.type || 'info', timeout: opts.timeout || 3000 });
                        return;
                    }
                    if (isVencord && Vencord.Api?.showToast) {
                        Vencord.Api.showToast({ message, type: opts.type, duration: opts.timeout });
                        return;
                    }
                } catch (_) {}
                // Fallback — свой тост
                try {
                    const t = document.createElement('div');
                    t.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);
                        background:#0A0A0F;color:#E8EAF0;padding:10px 18px;border-radius:8px;
                        border:1px solid ${opts.type === 'error' ? '#F87171' : opts.type === 'success' ? '#34D399' : '#8B5CF6'};
                        z-index:99999;font-family:Inter,system-ui,sans-serif;font-size:13px;
                        box-shadow:0 10px 30px rgba(0,0,0,.6);animation:fq-window-in .25s ease;`;
                    t.textContent = message;
                    document.body.appendChild(t);
                    setTimeout(() => t.remove(), opts.timeout || 3000);
                } catch (_) {}
            },

            showNotice(message, opts = {}) {
                try {
                    if (isBD) {
                        BdApi.UI.showNotice(message, { type: opts.type || 'info' });
                        return;
                    }
                    if (isVencord && Vencord.Api?.showNotice) {
                        Vencord.Api.showNotice({ message, type: opts.type });
                        return;
                    }
                } catch (_) {}
                this.showToast(message, opts);
            },
        };

        // ============ LOGGER ============
        const Logger = {
            info:  (...a) => { try { isBD ? BdApi.Logger.info(meta.name, ...a) : isVencord ? Vencord.Logger.info(...a) : console.log('[FQuest]', ...a); } catch { console.log('[FQuest]', ...a); } },
            warn:  (...a) => { try { isBD ? BdApi.Logger.warn(meta.name, ...a) : isVencord ? Vencord.Logger.warn(...a) : console.warn('[FQuest]', ...a); } catch { console.warn('[FQuest]', ...a); } },
            error: (...a) => { try { isBD ? BdApi.Logger.error(meta.name, ...a) : isVencord ? Vencord.Logger.error(...a) : console.error('[FQuest]', ...a); } catch { console.error('[FQuest]', ...a); } },
        };

        // ============ REACT ============
        const getReact = () => {
            try {
                if (isVencord && Vencord.Webpack.Common?.React) return Vencord.Webpack.Common.React;
                if (isBD) {
                    const React = BdApi.Webpack.getModule(m => m?.createElement && m?.Component, { searchExports: true });
                    if (React) return React;
                }
                // Fallback через webpack
                let wpRequire;
                webpackChunkdiscord_app.push([[Symbol()], {}, r => { wpRequire = r; }]);
                webpackChunkdiscord_app.pop();
                const mod = Object.values(wpRequire.c).map(m => m?.exports).find(e => e?.createElement && e?.Component);
                return mod || null;
            } catch (_) { return null; }
        };

        // ============ NATIVE ============
        const Native = {
            openExternal(url) {
                try {
                    if (window.DiscordNative?.shell?.openExternal) return window.DiscordNative.shell.openExternal(url);
                    if (isVencord && Vencord.Util?.openExternal) return Vencord.Util.openExternal(url);
                    if (isBD && BdApi.Native?.openExternal) return BdApi.Native.openExternal(url);
                } catch (_) {}
                window.open(url, '_blank', 'noopener,noreferrer');
            },
        };

        return {
            isVencord,
            isBD,
            isFallback: !isVencord && !isBD,
            Data,
            Webpack,
            UI,
            Logger,
            getReact,
            Native,
        };
    },
};