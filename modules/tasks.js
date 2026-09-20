/* FQuest · modules/tasks.js
 * VIDEO / GAME / STREAM / ACHIEVEMENT / ACTIVITY */

module.exports = {
    createTasks(ctx) {
        return {
            skipped: new Set(),

            // ---------- геттеры (берут значения в момент вызова, а не создания) ----------
            get RUNTIME()      { return ctx.RUNTIME; },
            get SYS()          { return ctx.SYS; },
            get CONST()        { return ctx.CONST; },
            get Mods()         { return ctx.Mods; },
            get Traffic()      { return ctx.Traffic; },
            get Logger()       { return ctx.Logger; },
            get Patcher()      { return ctx.Patcher; },
            get Sound()        { return ctx.Sound; },
            get ErrorHandler() { return ctx.ErrorHandler; },

            // утилиты (не меняются)
            sleep: ctx.sleep,
            rnd:   ctx.rnd,
            esc:   ctx.esc,

            // ---------- утилиты ----------
            sanitize(name) {
                return String(name).replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, " ");
            },

            detectType(cfg, applicationId) {
                const taskKeys = Object.keys(cfg.tasks);
                const typeMap = [
                    { key: "PLAY", type: "GAME" },
                    { key: "STREAM", type: "STREAM" },
                    { key: "VIDEO", type: "WATCH_VIDEO" },
                    { key: "ACHIEVEMENT_IN_ACTIVITY", type: "ACHIEVEMENT" },
                    { key: "ACTIVITY", type: "ACTIVITY" },
                ];
                for (const { key, type } of typeMap) {
                    const keyName = taskKeys.find(k => k.includes(key));
                    if (keyName) return { type, keyName, target: cfg.tasks[keyName]?.target ?? 0 };
                }
                if (applicationId) return { type: "GAME", keyName: "PLAY_ON_DESKTOP", target: cfg.tasks[taskKeys[0]]?.target ?? 0 };
                return null;
            },

            async fetchGameData(appId, appName) {
                try {
                    const res = await this.Mods.API.get({ url: `/applications/public?application_ids=${appId}` });
                    const appData = res?.body?.[0];
                    const exeEntry = appData?.executables?.find(x => x.os === "win32");
                    const rawExe = exeEntry ? exeEntry.name.replace(">", "") : `${this.sanitize(appName)}.exe`;
                    const cleanName = this.sanitize(appData?.name || appName);
                    return {
                        name: appData?.name || appName,
                        icon: appData?.icon,
                        exeName: rawExe,
                        cmdLine: `C:\\Program Files\\${cleanName}\\${rawExe}`,
                        exePath: `c:/program files/${cleanName.toLowerCase()}/${rawExe}`,
                        id: appId,
                    };
                } catch (e) {
                    this.Logger.log(`[Игра] Фолбэк для ${appName}: ${e?.message ?? e}`, 'debug');
                    const cleanName = this.sanitize(appName);
                    const safeExe = `${cleanName.replace(/\s+/g, "")}.exe`;
                    return {
                        name: appName,
                        exeName: safeExe,
                        cmdLine: `C:\\Program Files\\${cleanName}\\${safeExe}`,
                        exePath: `c:/program files/${cleanName.toLowerCase()}/${safeExe}`,
                        id: appId,
                    };
                }
            },

            async claimReward(questId) {
                return await this.Mods.API.post({
                    url: `/quests/${questId}/claim-reward`,
                    body: { platform: 0, location: 11, is_targeted: false, metadata_raw: null, metadata_sealed: null, traffic_metadata_raw: null, traffic_metadata_sealed: null },
                });
            },

            failTask(q, t, reason) {
                const cur = this.Logger.tasks.get(q.id)?.cur ?? 0;
                this.Logger.updateTask(q.id, { name: t.name, type: t.type, cur, max: t.target, status: "FAILED" });
                this.Logger.log(`[Задача] Прервано "${t.name}": ${reason}`, 'err');
                this.skipped.add(q.id);
                setTimeout(() => this.Logger.removeTask(q.id), 2000);
            },

            async VIDEO(q, t, s) {
                let cur = s?.progress?.[t.keyName]?.value ?? s?.progress?.[t.type]?.value ?? 0;
                let failCount = 0;
                this.Logger.updateTask(q.id, { name: t.name, type: "VIDEO", cur, max: t.target, status: "RUNNING" });
                const startTime = Date.now();
                let calls = 0;

                if (cur === 0) {
                    await this.sleep(this.rnd(200, 350));
                    cur = 0.2 + (Math.random() * 0.05);
                    try {
                        await this.Traffic.enqueue(`/quests/${q.id}/video-progress`, { timestamp: Number(cur.toFixed(6)) });
                        calls++;
                    } catch (e) { this.Logger.log(`[Видео] Стартовый пинг: ${e.message}`, 'debug'); }
                }

                while (cur < t.target && this.RUNTIME.running) {
                    const delayMs = this.rnd(3500, 4750);
                    await this.sleep(delayMs);
                    const elapsedSec = (delayMs / 1000) + (Math.random() * 0.02 - 0.01);
                    cur += elapsedSec;
                    const payloadTs = Number(Math.min(t.target, cur).toFixed(6));
                    try {
                        const r = await this.Traffic.enqueue(`/quests/${q.id}/video-progress`, { timestamp: payloadTs });
                        calls++;
                        const serverVal = r?.body?.progress?.[t.keyName]?.value ?? r?.body?.progress?.WATCH_VIDEO?.value;
                        if (serverVal > cur) cur = Math.min(t.target, serverVal);
                        if (r?.body?.completed_at) break;
                        failCount = 0;
                    } catch (e) {
                        failCount++;
                        const err = this.ErrorHandler.classify(e);
                        if (err.isClientError) {
                            this.Logger.log(`[Задача] Видео недоступно (HTTP ${err.status}).`, 'warn');
                            return this.failTask(q, t, `Ошибка клиента ${err.status}`);
                        }
                        if (failCount >= this.SYS.MAX_TASK_FAILURES) return this.failTask(q, t, 'Слишком много сетевых ошибок');
                        this.Logger.log(`[Задача] VIDEO (${failCount}/${this.SYS.MAX_TASK_FAILURES}): ${err.message}`, 'debug');
                    }
                    this.Logger.updateTask(q.id, { name: t.name, type: "VIDEO", cur, max: t.target, status: "RUNNING" });
                    if (Date.now() - startTime > this.SYS.MAX_TIME) return this.failTask(q, t, 'Превышен таймаут');
                }
                if (this.RUNTIME.running) {
                    this.Logger.log(`[Задача] VIDEO "${t.name}" за ${calls} вызовов`, 'debug');
                    this.finish(q, t);
                }
            },

            GAME(q, t, s)   { return this.generic(q, t, "GAME",   "PLAY_ON_DESKTOP",   s); },
            STREAM(q, t, s) { return this.generic(q, t, "STREAM", "STREAM_ON_DESKTOP", s); },

            async generic(q, t, type, key, s) {
                if (!this.RUNTIME.running) return;
                const gameData = await this.fetchGameData(t.appId, t.name);

                return new Promise(resolve => {
                    const pid = this.rnd(2500, 12500) * 4;
                    const game = {
                        id: gameData.id, name: gameData.name, icon: gameData.icon,
                        pid, pidPath: [pid], processName: gameData.name, start: Date.now(),
                        exeName: gameData.exeName, exePath: gameData.exePath, cmdLine: gameData.cmdLine,
                        executables: [{ os: 'win32', name: gameData.exeName, is_launcher: false }],
                        windowHandle: 0, fullscreenType: 0, overlay: true, sandboxed: false,
                        hidden: false, isLauncher: false,
                    };

                    let cleanupHook;
                    let cleaned = false;
                    let safetyTimer;

                    if (type === "STREAM") {
                        const real = this.Mods.StreamStore?.getStreamerActiveStreamMetadata;
                        if (this.Mods.StreamStore) {
                            this.Mods.StreamStore.getStreamerActiveStreamMetadata = () => ({ id: gameData.id, pid, sourceName: gameData.name });
                        }
                        cleanupHook = () => { if (this.Mods.StreamStore) this.Mods.StreamStore.getStreamerActiveStreamMetadata = real; };
                    } else {
                        this.Patcher.add(game);
                        cleanupHook = () => this.Patcher.remove(game);
                    }

                    this.Logger.updateTask(q.id, { name: t.name, type, cur: 0, max: t.target, status: "RUNNING" });
                    this.Logger.log(`[Задача] Запущен ${type}: ${gameData.name}`, 'info');

                    const finish = () => {
                        if (cleaned) return;
                        cleaned = true;
                        clearTimeout(safetyTimer);
                        try { cleanupHook(); } catch (e) { this.Logger.log(`[Задача] Очистка: ${e.message}`, 'debug'); }
                        try { this.Mods.Dispatcher?.unsubscribe(this.CONST.EVT.HEARTBEAT, check); } catch (e) {
                            this.Logger.log(`[Диспетчер] Ошибка отписки: ${e.message}`, 'debug');
                        }
                        this.RUNTIME.cleanups.delete(finish);
                    };

                    safetyTimer = setTimeout(() => {
                        if (this.RUNTIME.running) this.failTask(q, t, 'Превышен таймаут (25м)');
                        finish();
                        resolve();
                    }, this.SYS.MAX_TIME);

                    const check = (d) => {
                        if (!this.RUNTIME.running) { finish(); resolve(); return; }
                        if (d?.questId !== q.id) return;
                        const prog = d.userStatus?.progress?.[key]?.value ?? d.userStatus?.streamProgressSeconds ?? 0;
                        this.Logger.updateTask(q.id, { name: t.name, type, cur: prog, max: t.target, status: "RUNNING" });
                        if (prog >= t.target) { finish(); this.finish(q, t); resolve(); }
                    };

                    try {
                        if (this.Mods.Dispatcher && typeof this.Mods.Dispatcher.subscribe === 'function') {
                            this.Mods.Dispatcher.subscribe(this.CONST.EVT.HEARTBEAT, check);
                        } else {
                            this.Logger.log(`[Задача] Dispatcher.subscribe недоступен — работаю через таймер`, 'warn');
                        }
                    } catch (e) {
                        this.Logger.log(`[Задача] subscribe failed: ${e?.message ?? e}`, 'warn');
                    }
                    this.RUNTIME.cleanups.add(finish);
                });
            },

            async ACHIEVEMENT(q, t) {
                this.Logger.updateTask(q.id, { name: t.name, type: "ACHIEVEMENT", cur: 0, max: t.target, status: "RUNNING" });
                let chan = null;
                try {
                    chan = this.Mods.ChanStore?.getSortedPrivateChannels()?.[0]?.id
                        ?? Object.values(this.Mods.GuildChanStore?.getAllGuilds() ?? {}).find(g => g?.VOCAL?.length)?.VOCAL?.[0]?.channel?.id;
                } catch (e) { this.Logger.log(`[Достижение] Канал: ${e.message}`, 'debug'); }

                if (chan) {
                    this.Logger.log(`[Задача] Спуфинг heartbeat для "${t.name}"...`, 'info');
                    const key = `call:${chan}:${this.rnd(1000, 9999)}`;
                    let cur = 0;
                    let failCount = 0;
                    while (cur < t.target && this.RUNTIME.running) {
                        try {
                            const r = await this.Traffic.enqueue(`/quests/${q.id}/heartbeat`, { stream_key: key, terminal: false });
                            cur = r?.body?.progress?.[t.keyName]?.value ?? r?.body?.progress?.ACHIEVEMENT_IN_ACTIVITY?.value ?? cur;
                            this.Logger.updateTask(q.id, { name: t.name, type: "ACHIEVEMENT", cur, max: t.target, status: "RUNNING" });
                            failCount = 0;
                            if (cur >= t.target) {
                                try { await this.Traffic.enqueue(`/quests/${q.id}/heartbeat`, { stream_key: key, terminal: true }); } catch (_) {}
                                break;
                            }
                        } catch (e) {
                            failCount++;
                            const err = this.ErrorHandler.classify(e);
                            if (err.isClientError) { this.Logger.log(`[Достижение] Отклонен (HTTP ${err.status}).`, 'warn'); break; }
                            if (failCount >= this.SYS.MAX_TASK_FAILURES) { this.Logger.log(`[Достижение] Много ошибок.`, 'warn'); break; }
                        }
                        await this.sleep(this.rnd(19000, 22000));
                    }
                    if (cur >= t.target && this.RUNTIME.running) return this.finish(q, t);
                }
                if (!this.RUNTIME.running) return;
                this.Logger.log(`[Задача] Пропуск "${t.name}" — нет рабочих путей.`, 'warn');
                return this.failTask(q, t, 'Невозможно автозавершить');
            },

            async ACTIVITY(q, t) {
                let chan = null;
                try {
                    chan = this.Mods.ChanStore?.getSortedPrivateChannels()?.[0]?.id
                        ?? Object.values(this.Mods.GuildChanStore?.getAllGuilds() ?? {}).find(g => g?.VOCAL?.length)?.VOCAL?.[0]?.channel?.id;
                } catch (e) { this.Logger.log(`[ACTIVITY] Канал: ${e.message}`, 'debug'); }
                if (!chan) return this.failTask(q, t, 'Голосовой канал не найден');

                const key = `call:${chan}:${this.rnd(1000, 9999)}`;
                let cur = 0;
                let failCount = 0;
                this.Logger.updateTask(q.id, { name: t.name, type: "ACTIVITY", cur, max: t.target, status: "RUNNING" });
                const startTime = Date.now();

                while (cur < t.target && this.RUNTIME.running) {
                    try {
                        const r = await this.Traffic.enqueue(`/quests/${q.id}/heartbeat`, { stream_key: key, terminal: false });
                        cur = r?.body?.progress?.[t.keyName]?.value ?? r?.body?.progress?.PLAY_ACTIVITY?.value ?? cur + 20;
                        this.Logger.updateTask(q.id, { name: t.name, type: "ACTIVITY", cur, max: t.target, status: "RUNNING" });
                        failCount = 0;
                        if (cur >= t.target) {
                            try { await this.Traffic.enqueue(`/quests/${q.id}/heartbeat`, { stream_key: key, terminal: true }); } catch (_) {}
                            break;
                        }
                    } catch (e) {
                        failCount++;
                        const err = this.ErrorHandler.classify(e);
                        if (err.isClientError) { this.Logger.log(`[ACTIVITY] Недоступно (HTTP ${err.status}).`, 'warn'); return this.failTask(q, t, `Ошибка ${err.status}`); }
                        if (failCount >= this.SYS.MAX_TASK_FAILURES) return this.failTask(q, t, 'Слишком много ошибок');
                        this.Logger.log(`[ACTIVITY] Ошибка (${failCount}/${this.SYS.MAX_TASK_FAILURES}): ${err.message}`, 'debug');
                    }
                    if (Date.now() - startTime > this.SYS.MAX_TIME) return this.failTask(q, t, 'Превышен таймаут');
                    await this.sleep(this.rnd(19000, 22000));
                }
                if (this.RUNTIME.running && cur >= t.target) this.finish(q, t);
            },

            async finish(q, t) {
                this.Logger.updateTask(q.id, { name: t.name, type: t.type, cur: t.target, max: t.target, status: "COMPLETED" });
                this.Logger.log(`[Задача] Завершено "${t.name}"!`, 'success');
                this.Sound.play('tick');

                // История
                ctx.History?.add({
                    id: q.id,
                    name: t.name,
                    type: t.type,
                    target: t.target,
                    appId: t.appId,
                    completedAt: Date.now(),
                    claimed: false,
                });

                // Уведомление
                if (this.RUNTIME.notifyOnFinish) {
                    try {
                        if (typeof Notification !== 'undefined') {
                            if (Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (_) {} }
                            const focused = document.hasFocus();
                            if (Notification.permission === 'granted' && (!focused || this.RUNTIME.notifyInFocus)) {
                                new Notification("FQuest: Квест завершен", { body: t.name, tag: `fquest-${q.id}` });
                            }
                        }
                    } catch (e) { this.Logger.log(`[Уведомление] ${e.message}`, 'debug'); }
                }

                // Авто-клейм
                if (this.RUNTIME.autoClaim) {
                    try {
                        await this.sleep(this.rnd(2500, 6000));
                        if (!this.RUNTIME.running) return;
                        const claimRes = await this.claimReward(q.id);
                        if (claimRes?.body?.claimed_at) {
                            this.Logger.log(`[Получение] Награда за "${t.name}" получена!`, 'success');
                            this.Logger.updateTask(q.id, { name: t.name, type: t.type, cur: t.target, max: t.target, status: "CLAIMED" });
                            ctx.History?.markClaimed(q.id);
                            setTimeout(() => this.Logger.removeTask(q.id), 2000);
                            return;
                        }
                    } catch (e) {
                        const needsCaptcha = e?.body?.captcha_key || e?.body?.captcha_sitekey;
                        if (needsCaptcha) this.Logger.log(`[Получение] Капча для "${t.name}".`, 'warn');
                        else this.Logger.log(`[Получение] Ошибка для "${t.name}": ${e?.body?.message ?? e?.message}`, 'err');
                    }
                }
                this.Logger.updateTask(q.id, { name: t.name, type: t.type, cur: t.target, max: t.target, status: "COMPLETED", claimable: true, questId: q.id });
            },
        };
    },
};