/* FQuest · modules/patcher.js
 * Подмена RunningGameStore для спуфинга игр
 * Точная копия логики v4.9.5, адаптированная под модульный ctx */

module.exports = {
    createPatcher(ctx) {
        return {
            games: [],
            realGames: null,
            realPID: null,
            active: false,

            // ---------- Геттеры ----------
            get Mods()    { return ctx.Mods; },
            get CONST()   { return ctx.CONST; },
            get Logger()  { return ctx.Logger; },
            get CONFIG()  { return ctx.CONFIG; },

            init(Store) {
                if (!Store) return;
                this.realGames = Store.getRunningGames;
                this.realPID = Store.getGameForPID;
            },

            toggle(on) {
                const RunStore = this.Mods?.RunStore;
                if (!RunStore) return;
                if (!this.realGames || !this.realPID) return;

                if (on && !this.active) {
                    RunStore.getRunningGames = () => [...this.realGames.call(RunStore), ...this.games];
                    RunStore.getGameForPID = (pid) => this.games.find(g => g.pid === pid) || this.realPID.call(RunStore, pid);
                    this.active = true;
                } else if (!on && this.active) {
                    RunStore.getRunningGames = this.realGames;
                    RunStore.getGameForPID = this.realPID;
                    this.active = false;
                }
            },

            add(g) {
                if (this.games.some(x => x.pid === g.pid)) return;
                this.games.push(g);
                this.toggle(true);
                this.dispatch([g], []);
                this.rpc(g);
            },

            remove(g) {
                const before = this.games.length;
                this.games = this.games.filter(x => x.pid !== g.pid);
                if (this.games.length === before) return;

                this.dispatch([], [g]);
                if (!this.games.length) {
                    this.toggle(false);
                    this.rpc(null);
                } else {
                    this.rpc(this.games[0]);
                }
            },

            dispatch(added, removed) {
                this.Mods.Dispatcher?.dispatch({
                    type: this.CONST.EVT.GAME,
                    added,
                    removed,
                    games: this.Mods.RunStore.getRunningGames(),
                });
            },

            rpc(g) {
                if (this.CONFIG.HIDE_ACTIVITY && g) return;
                try {
                    this.Mods.Dispatcher?.dispatch({
                        type: this.CONST.EVT.RPC,
                        socketId: null,
                        pid: g ? g.pid : 9999,
                        activity: g ? {
                            application_id: g.id,
                            name: g.name,
                            type: 0,
                            details: null,
                            state: null,
                            timestamps: { start: g.start },
                            icon: g.icon,
                            assets: null,
                        } : null,
                    });
                } catch (e) {
                    this.Logger?.log(`[Очистка RPC] ${e.message}`, 'debug');
                }
            },

            clean() {
                this.games = [];
                this.toggle(false);
                this.rpc(null);
            },
        };
    },
};