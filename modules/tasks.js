/* FQuest · modules/tasks.js
 * VIDEO — из v4.9.5
 * GAME / STREAM / ACTIVITY — из Aprel Team
 * ACHIEVEMENT — из v4.9.5 */

module.exports = {
    createTasks(ctx) {
        return {
            skipped: new Set(),

            get RUNTIME()      { return ctx.RUNTIME; },
            get SYS()          { return ctx.SYS; },
            get CONST()        { return ctx.CONST; },
            get Mods()         { return ctx.Mods; },
            get Traffic()      { return ctx.Traffic; },
            get Logger()       { return ctx.Logger; },
            get Sound()        { return ctx.Sound; },
            get ErrorHandler() { return ctx.ErrorHandler; },
            get Consent()      { return ctx.Consent; },
            get Http()         { return ctx.Http; },

            sleep: ctx.sleep,
            rnd:   ctx.rnd,
            esc:   ctx.esc,

            sanitize(name) {
                return String(name).replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, " ");
            },

            detectType(cfg, applicationId) {
                if (!cfg?.tasks || typeof cfg.tasks !== 'object') return null;
                const taskKeys = Object.keys(cfg.tasks);
                if (!taskKeys.length) return null;

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

                if (applicationId) {
                    return { type: "GAME", keyName: "PLAY_ON_DESKTOP", target: cfg.tasks[taskKeys[0]]?.target ?? 0 };
                }

                return null;
            },

            async fetchGameData(appId, appName) {
                try {
                    const res = await this.Http.get({ url: `/applications/public?application_ids=${appId}` });
                    const appData = res?.body?.[0];
                    const exeEntry = appData?.executables?.find(x => x.os === "win32");
                    const rawExe = exeEntry ? exeEntry.name.replace(/>/g, "") : `${this.sanitize(appName)}.exe`;
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
                    this.Logger.log(`[Получение игры] Запасной вариант для ${appName}: ${e?.message ?? e}`, 'debug');
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
                return await this.Http.post({
                    url: `/quests/${questId}/claim-reward`,
                    body: {
                        platform: 0,
                        location: 11,
                        is_targeted: false,
                        metadata_raw: null,
                        metadata_sealed: null,
                        traffic_metadata_raw: null,
                        traffic_metadata_sealed: null,
                    },
                });
            },

            failTask(q, t, reason) {
                const currentProgress = this.Logger?.tasks?.get(q.id)?.cur ?? 0;
                this.Logger.updateTask(q.id, {
                    name: t.name, type: t.type, cur: currentProgress, max: t.target, status: "FAILED",
                });
                this.Logger.log(`[Задача] Прервано "${t.name}": ${reason}`, 'err');
                this.skipped.add(q.id);
                setTimeout(() => this.Logger.removeTask(q.id), 2000);
            },

            // ==================== VIDEO ====================
            async VIDEO(q, t, s) {
                let cur = s?.progress?.[t.keyName]?.value;
                if (cur === undefined || cur === null) cur = s?.progress?.[t.type]?.value;
                if (cur === undefined || cur === null) cur = 0;
                let failCount = 0;

                this.Logger.updateTask(q.id, { name: t.name, type: "VIDEO", cur, max: t.target, status: "RUNNING" });

                const startTime = Date.now();
                let calls = 0;

                if (cur === 0) {
                    await this.sleep(this.rnd(200, 350));
                    if (!this.RUNTIME.running) return;
                    cur = 0.2 + (Math.random() * 0.05);
                    try {
                        await this.Traffic.enqueue(`/quests/${q.id}/video-progress`, { timestamp: Number(cur.toFixed(6)) });
                        calls++;
                    } catch (e) {
                        this.Logger.log(`[Видео] Ошибка начального пинга: ${e.message}`, 'debug');
                    }
                }

                while (cur < t.target && this.RUNTIME.running) {
                    const delayMs = this.rnd(3500, 4750);
                    await this.sleep(delayMs);
                    if (!this.RUNTIME.running) return;

                    const elapsedSec = (delayMs / 1000) + (Math.random() * 0.02 - 0.01);
                    cur += elapsedSec;

                    const payloadTs = Number(Math.min(t.target, cur).toFixed(6));

                    try {
                        const r = await this.Traffic.enqueue(`/quests/${q.id}/video-progress`, { timestamp: payloadTs });
                        calls++;
                        const serverVal = r?.body?.progress?.[t.keyName]?.value ?? r?.body?.progress?.WATCH_VIDEO?.value;
                        if (typeof serverVal === 'number' && serverVal > cur) cur = Math.min(t.target, serverVal);
                        if (r?.body?.completed_at) break;
                        failCount = 0;
                    } catch (e) {
                        failCount++;
                        const err = this.ErrorHandler.classify(e);
                        if (err.isClientError) {
                            this.Logger.log(`[Задача] Квест видео недоступен (HTTP ${err.status}). Пропускаем.`, 'warn');
                            return this.failTask(q, t, `Ошибка клиента ${err.status}`);
                        }
                        if (failCount >= this.SYS.MAX_TASK_FAILURES) {
                            return this.failTask(q, t, 'Слишком много сетевых ошибок');
                        }
                        this.Logger.log(`[Задача] Ошибка прогресса VIDEO (${failCount}/${this.SYS.MAX_TASK_FAILURES}): ${err.message}`, 'debug');
                    }

                    this.Logger.updateTask(q.id, { name: t.name, type: "VIDEO", cur, max: t.target, status: "RUNNING" });

                    if (Date.now() - startTime > this.SYS.MAX_TIME) {
                        return this.failTask(q, t, 'Превышен таймаут');
                    }
                }
                if (this.RUNTIME.running) {
                    this.Logger.log(`[Задача] VIDEO "${t.name}" выполнено за ${calls} вызовов API`, 'debug');
                    this.finish(q, t);
                }
            },

            // ==================== GAME ====================
            async GAME(q, t, s) {
                if (!this.RUNTIME.running) return;
                if (!this.SYS.IS_DESKTOP) {
                    return this.failTask(q, t, 'Только в десктоп-приложении');
                }

                const applicationId = t.appId;
                const RunStore = this.Mods.RunStore;
                const Dispatcher = this.Mods.Dispatcher;
                if (!RunStore || !Dispatcher) {
                    return this.failTask(q, t, 'RunStore/Dispatcher недоступны');
                }

                let appData;
                try {
                    const res = await this.Http.get({ url: `/applications/public?application_ids=${applicationId}` });
                    appData = res?.body?.[0];
                    if (!appData) throw new Error('Пустой ответ API');
                } catch (e) {
                    this.Logger.log(`[Игра] Не удалось получить данные ${applicationId}: ${e?.message}`, 'warn');
                    return this.failTask(q, t, 'Ошибка получения данных игры');
                }

                const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(/>/g, "")
                    ?? `${appData.name.replace(/[\/\\:*?"<>|]/g, "")}.exe`;
                const pid = Math.floor(Math.random() * 30000) + 1000;

                const fakeGame = {
                    cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
                    exeName,
                    exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
                    hidden: false,
                    isLauncher: false,
                    id: applicationId,
                    name: appData.name,
                    pid: pid,
                    pidPath: [pid],
                    processName: appData.name,
                    start: Date.now(),
                    icon: appData.icon,
                    executables: [{ os: 'win32', name: exeName, is_launcher: false }],
                    windowHandle: 0,
                    fullscreenType: 0,
                    overlay: true,
                    sandboxed: false,
                };

                const realGames = RunStore.getRunningGames();
                const realGetRunningGames = RunStore.getRunningGames;
                const realGetGameForPID = RunStore.getGameForPID;
                const fakeGames = [fakeGame];

                RunStore.getRunningGames = () => fakeGames;
                RunStore.getGameForPID = (pid) => fakeGames.find(x => x.pid === pid);
                Dispatcher.dispatch({
                    type: "RUNNING_GAMES_CHANGE",
                    removed: realGames,
                    added: [fakeGame],
                    games: fakeGames,
                });

                this.Logger.updateTask(q.id, { name: t.name, type: "GAME", cur: 0, max: t.target, status: "RUNNING" });
                this.Logger.log(`[Задача] Запущен GAME: ${appData.name} (${Math.ceil(t.target / 60)} мин.)`, 'info');

                const cleanup = () => {
                    try {
                        RunStore.getRunningGames = realGetRunningGames;
                        RunStore.getGameForPID = realGetGameForPID;
                        Dispatcher.dispatch({
                            type: "RUNNING_GAMES_CHANGE",
                            removed: [fakeGame],
                            added: [],
                            games: realGetRunningGames.call(RunStore),
                        });
                    } catch (e) {
                        this.Logger.log(`[Игра] Очистка: ${e?.message}`, 'debug');
                    }
                };

                return new Promise(resolve => {
                    let finished = false;
                    const finish = () => {
                        if (finished) return;
                        finished = true;
                        clearTimeout(safetyTimer);
                        cleanup();
                        try { Dispatcher.unsubscribe(this.CONST.EVT.HEARTBEAT, check); } catch (_) {}
                        this.RUNTIME.cleanups.delete(finish);
                        try { resolve(); } catch (_) {}
                    };

                    const safetyTimer = setTimeout(() => {
                        if (this.RUNTIME.running) this.failTask(q, t, 'Превышен таймаут (25м)');
                        finish();
                    }, this.SYS.MAX_TIME);

                    const check = (data) => {
                        if (!this.RUNTIME.running) { finish(); return; }
                        if (data?.questId !== q.id) return;

                        let progress;
                        if (q.config?.configVersion === 1) {
                            progress = data.userStatus?.streamProgressSeconds ?? 0;
                        } else {
                            progress = Math.floor(data.userStatus?.progress?.PLAY_ON_DESKTOP?.value ?? 0);
                        }

                        this.Logger.updateTask(q.id, { name: t.name, type: "GAME", cur: progress, max: t.target, status: "RUNNING" });

                        if (progress >= t.target) {
                            this.Logger.log(`[Задача] GAME "${t.name}" завершено!`, 'success');
                            finish();
                            this.finish(q, t);
                        }
                    };

                    Dispatcher.subscribe(this.CONST.EVT.HEARTBEAT, check);
                    this.RUNTIME.cleanups.add(finish);
                });
            },

            // ==================== STREAM ====================
            async STREAM(q, t, s) {
                if (!this.RUNTIME.running) return;
                if (!this.SYS.IS_DESKTOP) {
                    return this.failTask(q, t, 'Только в десктоп-приложении');
                }

                const StreamStore = this.Mods.StreamStore;
                const Dispatcher = this.Mods.Dispatcher;
                if (!StreamStore || !Dispatcher) {
                    return this.failTask(q, t, 'StreamStore/Dispatcher недоступны');
                }

                let appData = null;
                try {
                    const res = await this.Http.get({ url: `/applications/public?application_ids=${t.appId}` });
                    appData = res?.body?.[0];
                } catch (_) {}

                const appName = appData?.name || t.name;
                const applicationId = t.appId;
                const pid = Math.floor(Math.random() * 30000) + 1000;

                const realFunc = StreamStore.getStreamerActiveStreamMetadata;
                StreamStore.getStreamerActiveStreamMetadata = () => ({
                    id: applicationId,
                    pid,
                    sourceName: null,
                });

                this.Logger.updateTask(q.id, { name: t.name, type: "STREAM", cur: 0, max: t.target, status: "RUNNING" });
                this.Logger.log(`[Задача] Запущен STREAM: ${appName} (${Math.ceil(t.target / 60)} мин.)`, 'info');
                this.Logger.log(`[Важно] В голосовом канале должен быть хотя бы 1 другой человек!`, 'warn');

                const cleanup = () => {
                    try { StreamStore.getStreamerActiveStreamMetadata = realFunc; } catch (_) {}
                };

                return new Promise(resolve => {
                    let finished = false;
                    const finish = () => {
                        if (finished) return;
                        finished = true;
                        clearTimeout(safetyTimer);
                        cleanup();
                        try { Dispatcher.unsubscribe(this.CONST.EVT.HEARTBEAT, check); } catch (_) {}
                        this.RUNTIME.cleanups.delete(finish);
                        try { resolve(); } catch (_) {}
                    };

                    const safetyTimer = setTimeout(() => {
                        if (this.RUNTIME.running) this.failTask(q, t, 'Превышен таймаут (25м)');
                        finish();
                    }, this.SYS.MAX_TIME);

                    const check = (data) => {
                        if (!this.RUNTIME.running) { finish(); return; }
                        if (data?.questId !== q.id) return;

                        let progress;
                        if (q.config?.configVersion === 1) {
                            progress = data.userStatus?.streamProgressSeconds ?? 0;
                        } else {
                            progress = Math.floor(data.userStatus?.progress?.STREAM_ON_DESKTOP?.value ?? 0);
                        }

                        this.Logger.updateTask(q.id, { name: t.name, type: "STREAM", cur: progress, max: t.target, status: "RUNNING" });

                        if (progress >= t.target) {
                            this.Logger.log(`[Задача] STREAM "${t.name}" завершено!`, 'success');
                            finish();
                            this.finish(q, t);
                        }
                    };

                    Dispatcher.subscribe(this.CONST.EVT.HEARTBEAT, check);
                    this.RUNTIME.cleanups.add(finish);
                });
            },

            // ==================== ACTIVITY ====================
            async ACTIVITY(q, t) {
                if (!this.RUNTIME.running) return;

                const ChanStore = this.Mods.ChanStore;
                const GuildChanStore = this.Mods.GuildChanStore;
                let channelId = null;

                try {
                    channelId = ChanStore?.getSortedPrivateChannels()?.[0]?.id
                        ?? Object.values(GuildChanStore?.getAllGuilds() ?? {}).find(g => g?.VOCAL?.length > 0)?.VOCAL?.[0]?.channel?.id;
                } catch (_) {}

                if (!channelId) {
                    return this.failTask(q, t, 'Канал не найден');
                }

                const streamKey = `call:${channelId}:1`;
                this.Logger.updateTask(q.id, { name: t.name, type: "ACTIVITY", cur: 0, max: t.target, status: "RUNNING" });
                this.Logger.log(`[Задача] ACTIVITY "${t.name}" через канал ${channelId}`, 'info');

                const startTime = Date.now();
                let cur = 0;

                while (cur < t.target && this.RUNTIME.running) {
                    try {
                        const res = await this.Http.post({
                            url: `/quests/${q.id}/heartbeat`,
                            body: { stream_key: streamKey, terminal: false },
                        });
                        const serverProgress = res?.body?.progress?.PLAY_ACTIVITY?.value
                            ?? res?.body?.progress?.[t.keyName]?.value;
                        if (typeof serverProgress === 'number') cur = serverProgress;

                        this.Logger.updateTask(q.id, { name: t.name, type: "ACTIVITY", cur, max: t.target, status: "RUNNING" });

                        if (cur >= t.target) {
                            try {
                                await this.Http.post({
                                    url: `/quests/${q.id}/heartbeat`,
                                    body: { stream_key: streamKey, terminal: true },
                                });
                            } catch (_) {}
                            break;
                        }

                        await this.sleep(this.rnd(18000, 22000));
                    } catch (e) {
                        const err = this.ErrorHandler.classify(e);
                        if (err.isClientError) {
                            return this.failTask(q, t, `Ошибка клиента ${err.status}`);
                        }
                        this.Logger.log(`[Задача] Ошибка ACTIVITY: ${err.message}`, 'debug');
                        await this.sleep(5000);
                    }

                    if (Date.now() - startTime > this.SYS.MAX_TIME) {
                        return this.failTask(q, t, 'Превышен таймаут');
                    }
                }
                if (this.RUNTIME.running && cur >= t.target) this.finish(q, t);
            },

            // ==================== ACHIEVEMENT ====================
            async ACHIEVEMENT(q, t) {
                this.Logger.updateTask(q.id, { name: t.name, type: "ACHIEVEMENT", cur: 0, max: t.target, status: "RUNNING" });

                let chan = null;
                try {
                    chan = this.Mods.ChanStore?.getSortedPrivateChannels()?.[0]?.id
                        ?? Object.values(this.Mods.GuildChanStore?.getAllGuilds() ?? {}).find(g => g?.VOCAL?.length)?.VOCAL?.[0]?.channel?.id;
                } catch (e) {
                    this.Logger.log(`[Достижение] Ошибка поиска канала: ${e.message}`, 'debug');
                }

                if (chan) {
                    this.Logger.log(`[Задача] Спуфинг heartbeat для "${t.name}"...`, 'info');
                    const key = `call:${chan}:${this.rnd(1000, 9999)}`;
                    let cur = 0;
                    let failCount = 0;

                    while (cur < t.target && this.RUNTIME.running) {
                        try {
                            const r = await this.Http.post({
                                url: `/quests/${q.id}/heartbeat`,
                                body: { stream_key: key, terminal: false },
                            });
                            cur = r?.body?.progress?.[t.keyName]?.value ?? r?.body?.progress?.ACHIEVEMENT_IN_ACTIVITY?.value ?? cur;
                            this.Logger.updateTask(q.id, { name: t.name, type: "ACHIEVEMENT", cur, max: t.target, status: "RUNNING" });
                            failCount = 0;

                            if (cur >= t.target) {
                                try {
                                    await this.Http.post({
                                        url: `/quests/${q.id}/heartbeat`,
                                        body: { stream_key: key, terminal: true },
                                    });
                                } catch (_) {}
                                break;
                            }
                        } catch (e) {
                            failCount++;
                            const err = this.ErrorHandler.classify(e);
                            if (err.isClientError) break;
                            if (failCount >= this.SYS.MAX_TASK_FAILURES) break;
                        }
                        await this.sleep(this.rnd(19000, 22000));
                    }
                    if (cur >= t.target && this.RUNTIME.running) return this.finish(q, t);
                }

                if (!this.RUNTIME.running) return;
                return this.failTask(q, t, 'Невозможно автозавершить');
            },

            // ==================== FINISH ====================
            async finish(q, t) {
                this.Logger.updateTask(q.id, { name: t.name, type: t.type, cur: t.target, max: t.target, status: "COMPLETED" });
                this.Logger.log(`[Задача] Завершено "${t.name}"!`, 'success');
                this.Sound.play('tick');

                ctx.History?.add({
                    id: q.id,
                    name: t.name,
                    type: t.type,
                    target: t.target,
                    appId: t.appId,
                    completedAt: Date.now(),
                    claimed: false,
                });

                try {
                    if (typeof Notification !== 'undefined') {
                        if (Notification.permission === 'default' && !this.RUNTIME.notifyPermission) {
                            try {
                                const perm = await Notification.requestPermission();
                                this.RUNTIME.notifyPermission = perm;
                            } catch (_) {}
                        }
                        const perm = this.RUNTIME.notifyPermission || Notification.permission;
                        const focused = document.hasFocus();
                        if (perm === 'granted' && (!focused || this.RUNTIME.notifyInFocus)) {
                            new Notification("FQuest: Квест завершен", {
                                body: t.name,
                                icon: "https://cdn.discordapp.com/emojis/1120042457007792168.webp",
                                tag: `fquest-${q.id}`,
                            });
                        }
                    }
                } catch (e) { this.Logger.log(`[Уведомление] ${e.message}`, 'debug'); }

                if (this.RUNTIME.autoClaim) {
                    try {
                        await this.sleep(this.rnd(2500, 6000));
                        if (!this.RUNTIME.running) return;
                        const claimRes = await this.claimReward(q.id);

                        if (claimRes?.body?.claimed_at) {
                            this.Logger.log(`[Получение] Награда за "${t.name}" автоматически получена!`, 'success');
                            this.Logger.updateTask(q.id, { name: t.name, type: t.type, cur: t.target, max: t.target, status: "CLAIMED" });
                            ctx.History?.markClaimed(q.id);
                            setTimeout(() => this.Logger.removeTask(q.id), 2000);
                            return;
                        }
                    } catch (e) {
                        const needsCaptcha = e?.body?.captcha_key || e?.body?.captcha_sitekey;
                        if (needsCaptcha) {
                            this.Logger.log(`[Получение] Требуется капча для "${t.name}". Используйте кнопку в интерфейсе.`, 'warn');
                        } else {
                            this.Logger.log(`[Получение] Автополучение не удалось для "${t.name}": ${e?.body?.message ?? e?.message}`, 'err');
                        }
                    }
                }

                this.Logger.updateTask(q.id, {
                    name: t.name, type: t.type, cur: t.target, max: t.target,
                    status: "COMPLETED", claimable: true, questId: q.id,
                });
            },
        };
    },
};