/* FQuest · modules/traffic.js
 * Очередь сетевых запросов через ctx.Http */

module.exports = {
    createErrorHandler(ctx) {
        return {
            RETRYABLE: new Set([429, 500, 502, 503, 504, 408]),
            CLIENT_ERRORS: new Set([400, 403, 404, 409, 410]),
            classify(error) {
                const status = error?.status ?? error?.statusCode;
                return {
                    isRetryable: this.RETRYABLE.has(status),
                    isClientError: this.CLIENT_ERRORS.has(status),
                    status,
                    message: error?.message ?? error?.body?.message ?? `HTTP ${status ?? 'НЕИЗВЕСТНО'}`,
                };
            },
            isSkippableQuest(error) {
                const s = error?.status;
                return s === 404 || s === 403 || s === 410;
            },
        };
    },

    createTraffic(ctx) {
        return {
            queue: [],
            processing: false,

            get RUNTIME()      { return ctx.RUNTIME; },
            get SYS()          { return ctx.SYS; },
            get Logger()       { return ctx.Logger; },
            get ErrorHandler() { return ctx.ErrorHandler; },
            get Http()         { return ctx.Http; },
            sleep: ctx.sleep,
            rnd:   ctx.rnd,

            async enqueue(url, body) {
                if (!ctx.RUNTIME.running) return Promise.reject(new Error("Остановлено"));
                return new Promise((resolve, reject) => {
                    this.queue.push({ url, body, resolve, reject, attempts: 0 });
                    this.process();
                });
            },

            async process() {
                if (this.processing || this.queue.length === 0) return;
                this.processing = true;

                while (this.queue.length > 0) {
                    if (!ctx.RUNTIME.running) {
                        this.queue.forEach(req => req.reject(new Error("Завершение работы")));
                        this.queue = [];
                        this.processing = false;
                        return;
                    }

                    const req = this.queue.shift();
                    try {
                        const res = await ctx.Http.post({ url: req.url, body: req.body });
                        req.resolve(res);
                    } catch (e) {
                        const err = ctx.ErrorHandler.classify(e);

                        if (err.isRetryable && req.attempts < ctx.SYS.MAX_RETRIES) {
                            req.attempts++;
                            const delay = (e.body?.retry_after ?? Math.pow(2, req.attempts)) * 1000;
                            const isGlobal = e.body?.global === true;

                            ctx.Logger.log(`[Сеть] Повтор ${req.attempts}/${ctx.SYS.MAX_RETRIES} через ${(delay / 1000).toFixed(1)}с (HTTP ${err.status})`, 'warn');

                            const jitter = ctx.rnd(200, 800);

                            if (isGlobal) {
                                this.queue.unshift(req);
                                await ctx.sleep(delay + jitter);
                            } else {
                                setTimeout(() => {
                                    if (ctx.RUNTIME.running) {
                                        this.queue.push(req);
                                        this.process();
                                    } else {
                                        req.reject(new Error('Завершение работы'));
                                    }
                                }, delay + jitter);
                            }
                        } else if (err.isClientError) {
                            ctx.Logger.log(`[Сеть] HTTP ${err.status}: ${req.url}`, 'debug');
                            req.reject(e);
                        } else {
                            ctx.Logger.log(`[Сеть] Запрос к ${req.url} не удался: ${err.message}`, 'err');
                            req.reject(e);
                        }
                    }

                    await ctx.sleep(ctx.rnd(1200, 1800));
                }
                this.processing = false;
            },
        };
    },
};