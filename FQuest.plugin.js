/**
 * @name FQuest
 * @author venyv
 * @description Автоматическое выполнение квестов Discord.
 * @version 6.0.0
 * @source https://github.com/venyv/fquest
 * @updateUrl https://raw.githubusercontent.com/venyv/fquest/main/FQuest.plugin.js
 */

module.exports = (() => {
    // ==== Определяем среду ====
    const isVencord = typeof Vencord !== 'undefined' && typeof definePlugin !== 'undefined';
    const isBD = !isVencord && typeof BdApi !== 'undefined';

    const REPO_RAW = 'https://raw.githubusercontent.com/fun-venyv/fquest/main/';
    const MANIFEST_URL = REPO_RAW + 'manifest.json';
    const LOADER_VERSION = '6.0.0';
    const CACHE_KEY = 'fquest_module_cache_v1';

    const meta = { name: 'FQuest', version: LOADER_VERSION };

    // ==== Универсальный логгер ====
    const log = (level, ...args) => {
        try {
            if (isVencord) Vencord.Logger[level](...args);
            else if (isBD) BdApi.Logger[level](meta.name, ...args);
            else console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log']('[FQuest]', ...args);
        } catch { console.log('[FQuest]', ...args); }
    };

    // ==== Универсальный Data ====
    const Data = {
        load(key) {
            try {
                if (isVencord) return Vencord.Data.load(key) ?? null;
                if (isBD) return BdApi.Data.load(meta.name, key) ?? null;
                const raw = localStorage.getItem('fquest_' + key);
                return raw ? JSON.parse(raw) : null;
            } catch { return null; }
        },
        save(key, value) {
            try {
                if (isVencord) return Vencord.Data.save(key, value);
                if (isBD) return BdApi.Data.save(meta.name, key, value);
                localStorage.setItem('fquest_' + key, JSON.stringify(value));
                return true;
            } catch { return false; }
        },
        delete(key) {
            try {
                if (isVencord) return Vencord.Data.delete(key);
                if (isBD) return BdApi.Data.delete(meta.name, key);
                localStorage.removeItem('fquest_' + key);
                return true;
            } catch { return false; }
        },
    };

    const UI = {
        toast(message, opts = {}) {
            try {
                if (isBD) return BdApi.UI.showToast(message, { type: opts.type || 'info', timeout: opts.timeout || 3000 });
                if (isVencord && Vencord.Api?.showToast) return Vencord.Api.showToast({ message, ...opts });
            } catch {}
        },
    };

    // ==== Класс-загрузчик (BD-совместимый) ====
    class FQuestLoader {
        constructor() { this._instance = null; }

        async start() {
            log('info', 'Загрузчик запущен');
            UI.toast('Загружаю FQuest...', { type: 'info', timeout: 2000 });
            try {
                const manifest = await this.fetchManifest();
                const cached = Data.load(CACHE_KEY);

                if (cached && cached.version === manifest.version && this.verifyCache(cached, manifest)) {
                    log('info', `Использую кэш v${manifest.version}`);
                    await this.bootstrap(manifest, cached.modules, cached.css);
                    return;
                }

                log('info', `Скачиваю модули v${manifest.version}...`);
                const modules = await this.downloadModules(manifest);
                const css = await this.downloadCSS(manifest);
                Data.save(CACHE_KEY, { version: manifest.version, modules, css, manifest });
                await this.bootstrap(manifest, modules, css);
                UI.toast(`FQuest v${manifest.version} загружен`, { type: 'success', timeout: 3000 });
            } catch (e) {
                log('error', 'Ошибка загрузки:', e);
                const cached = Data.load(CACHE_KEY);
                if (cached) {
                    log('warn', 'Сеть недоступна, использую кэш v' + cached.version);
                    await this.bootstrap(cached.manifest, cached.modules, cached.css);
                } else {
                    UI.toast('FQuest: не удалось загрузить модули', { type: 'error', timeout: 5000 });
                }
            }
        }

        stop() {
            if (this._instance) {
                try { this._instance.stop(); } catch (e) { log('error', e); }
                this._instance = null;
            }
        }

        async fetchManifest() {
            const res = await this.rawFetch(MANIFEST_URL + '?t=' + Date.now());
            if (!res.ok) throw new Error('manifest.json недоступен (HTTP ' + res.status + ')');
            const data = JSON.parse(await res.text());
            if (!data.version || !data.files) throw new Error('manifest.json повреждён');
            if (data.minLoader && this.compareVersions(LOADER_VERSION, data.minLoader) < 0) {
                throw new Error(`Требуется загрузчик ${data.minLoader}+ (у вас ${LOADER_VERSION}).`);
            }
            return data;
        }

        async downloadModules(manifest) {
            const modules = {};
            const entries = Object.entries(manifest.files).filter(([p]) => p.startsWith('modules/'));
            for (const [path, m] of entries) {
                modules[path] = await this.fetchAndVerify(REPO_RAW + path, m.hash);
            }
            return modules;
        }

        async downloadCSS(manifest) {
            const m = manifest.files['FQuest.css'];
            if (!m) return '';
            return await this.fetchAndVerify(REPO_RAW + 'FQuest.css', m.hash);
        }

        async fetchAndVerify(url, expectedHash) {
            const res = await this.rawFetch(url + '?t=' + Date.now());
            if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
            const text = await res.text();
            const actual = await this.sha256(text);
            if (actual !== expectedHash) {
                throw new Error(`Хэш не совпал для ${url}`);
            }
            return text;
        }

        async sha256(text) {
            const buf = new TextEncoder().encode(text);
            const hash = await crypto.subtle.digest('SHA-256', buf);
            const b64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
            return 'sha256-' + b64;
        }

        async rawFetch(url) {
            try {
                const res = await fetch(url, { cache: 'no-store' });
                if (res.ok || res.status !== 0) return res;
            } catch {}
            const dn = window.DiscordNative;
            if (dn?.fileManager?.fetchURL) {
                const r = await dn.fileManager.fetchURL(url);
                const body = await r.text();
                return new Response(body, { status: r.status });
            }
            throw new Error('Не удалось выполнить запрос к ' + url);
        }

        verifyCache(cached, manifest) {
            if (!cached.manifest?.files) return false;
            for (const [path, m] of Object.entries(manifest.files)) {
                if (cached.manifest.files[path]?.hash !== m.hash) return false;
            }
            return true;
        }

        async bootstrap(manifest, moduleSources, css) {
            const moduleExports = {};
            const requireModule = (name) => {
                if (moduleExports[name]) return moduleExports[name];
                const key = 'modules/' + name.replace(/^\.\//, '');
                const src = moduleSources[key];
                if (!src) throw new Error(`Модуль не найден: ${name}`);
                const fn = new Function('module', 'exports', 'require', src + '\n//# sourceURL=fquest/' + key);
                const mod = { exports: {} };
                fn(mod, mod.exports, requireModule);
                moduleExports[name] = mod.exports;
                return mod.exports;
            };

            const coreSrc = moduleSources['modules/core.js'];
            if (!coreSrc) throw new Error('modules/core.js отсутствует');

            const coreFn = new Function('module', 'exports', 'require',
                coreSrc + '\n//# sourceURL=fquest/modules/core.js');
            const coreMod = { exports: {} };
            coreFn(coreMod, coreMod.exports, requireModule);

            const factory = coreMod.exports.default || coreMod.exports;
            if (typeof factory !== 'function') throw new Error('core.js не экспортирует фабрику');

            const FQuestClass = factory({
                meta,
                api: this._makeApiShim(),
                modules: requireModule,
                css,
                manifest,
            });

            this._instance = new FQuestClass();
            await this._instance.start();
        }

        /** Мини-шим BdApi для совместимости со старым core.js */
        _makeApiShim() {
            const self = this;
            return {
                Logger: {
                    info:  (...a) => log('info', ...a),
                    warn:  (...a) => log('warn', ...a),
                    error: (...a) => log('error', ...a),
                },
                Data: {
                    load:   (key) => Data.load(key),
                    save:   (key, v) => Data.save(key, v),
                    delete: (key) => Data.delete(key),
                },
                UI: {
                    showToast:  (m, o) => UI.toast(m, o),
                    showNotice: (m, o) => UI.toast(m, o),
                },
                Webpack: {
                    getStore: (name) => {
                        try {
                            if (isVencord && Vencord.Webpack.findStore) return Vencord.Webpack.findStore(name);
                            if (isBD) return BdApi.Webpack.getStore(name);
                        } catch {}
                        return null;
                    },
                    getByKeys: (...k) => {
                        try {
                            if (isVencord && Vencord.Webpack.findByProps) return Vencord.Webpack.findByProps(...k);
                            if (isBD) return BdApi.Webpack.getByKeys(...k);
                        } catch {}
                        return null;
                    },
                    getModule: (filter) => {
                        try {
                            if (isBD) return BdApi.Webpack.getModule(filter);
                        } catch {}
                        return null;
                    },
                },
                Native: {
                    openExternal: (url) => {
                        try {
                            if (window.DiscordNative?.shell?.openExternal) return window.DiscordNative.shell.openExternal(url);
                            if (isVencord && Vencord.Util?.openExternal) return Vencord.Util.openExternal(url);
                        } catch {}
                        window.open(url, '_blank', 'noopener,noreferrer');
                    },
                },
            };
        }

        compareVersions(a, b) {
            const pa = a.split('.').map(Number);
            const pb = b.split('.').map(Number);
            for (let i = 0; i < 3; i++) {
                if ((pa[i] || 0) > (pb[i] || 0)) return 1;
                if ((pa[i] || 0) < (pb[i] || 0)) return -1;
            }
            return 0;
        }
    }

    // ==== Экспорт: BD или Vencord ====
    if (isVencord) {
        const loader = new FQuestLoader();
        return definePlugin({
            name: 'FQuest',
            description: 'Автоматическое выполнение квестов Discord.',
            authors: [{ name: 'venyv', id: 0n }],
            start() { loader.start(); },
            stop()  { loader.stop(); },
        });
    }

    // BD (или fallback)
    return FQuestLoader;
})();