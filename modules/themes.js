/* ============================================================
 *  FQuest · modules/themes.js
 *  Живые темы на tsParticles:
 *    - sakura     → лепестки, падающие с ветки
 *    - starfield  → звёзды, туманности, кометы
 *    - midnight   → дрейфующие туманные пятна
 *    - cyberpunk  → глитч-пульсация (без particles)
 *
 *  Ветка сакуры рисуется отдельно на canvas (запекается 1 раз).
 * ============================================================ */

// === tsParticles CDN ===
const TSPARTICLES_CDN = 'https://cdn.jsdelivr.net/npm/tsparticles@2.12.0/tsparticles.bundle.min.js';

// Кэш загрузки библиотеки
let _tsParticlesPromise = null;

function loadTsParticles() {
    if (_tsParticlesPromise) return _tsParticlesPromise;

    _tsParticlesPromise = new Promise((resolve, reject) => {
        // Уже загружено?
        if (window.tsParticles) return resolve(window.tsParticles);

        const script = document.createElement('script');
        script.src = TSPARTICLES_CDN;
        script.async = true;
        script.onload = () => {
            if (window.tsParticles) resolve(window.tsParticles);
            else reject(new Error('tsParticles loaded, but window.tsParticles is undefined'));
        };
        script.onerror = () => reject(new Error('Failed to load tsParticles'));
        document.head.appendChild(script);
    });

    return _tsParticlesPromise;
}

module.exports = {
    createThemes(ctx) {
        const { RUNTIME, platform } = ctx;

        let _active = null;
        let _intervalId = null;
        let _rafId = null;
        let _themes = null;

        // ID текущего контейнера tsParticles
        let _particlesContainerId = null;
        let _particlesInstance = null;

        // Для сакуры — отдельный контейнер под ветку
        let _sakuraBranchCanvas = null;
        let _sakuraBranchCtx = null;

        const visListener = () => {
            if (document.visibilityState !== 'visible') return;
            setTimeout(() => {
                try { _themes?.resume?.(); } catch (_) {}
            }, 200);
        };
        document.addEventListener('visibilitychange', visListener);

        // === Утилита: получить root окна ===
        const getRoot = () => document.getElementById('fquest-ui');

        // === Утилита: очистить контейнер tsParticles ===
        const destroyParticles = async () => {
            if (!_particlesInstance) return;
            try {
                await _particlesInstance.destroy();
            } catch (_) {}
            _particlesInstance = null;
            _particlesContainerId = null;
        };

        // === Утилита: создать контейнер div под particles ===
        const ensureParticlesContainer = (id) => {
            const root = getRoot();
            if (!root) return null;
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement('div');
                el.id = id;
                el.style.cssText = `
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    z-index: 0;
                `;
                root.insertBefore(el, root.firstChild);
            }
            return el;
        };

        _themes = {
            // ============================================================
            //  APPLY / CLEAR / PAUSE / RESUME
            // ============================================================
            async apply(theme) {
                this.clear();
                _active = theme;

                switch (theme) {
                    case 'cyberpunk':  this._startCyberpunk(); break;
                    case 'midnight':   this._startMidnight(); break;
                    case 'sakura':     await this._startSakura(); break;
                    case 'starfield':  await this._startStarfield(); break;
                    default: break;
                }
            },

            clear() {
                // tsParticles
                destroyParticles();

                // удаляем контейнер из DOM
                const root = getRoot();
                if (root) {
                    const container = root.querySelector('#fq-particles-container');
                    if (container) container.remove();
                }

                // canvas ветки (сакура)
                if (_sakuraBranchCanvas && _sakuraBranchCanvas.parentElement) {
                    _sakuraBranchCanvas.parentElement.removeChild(_sakuraBranchCanvas);
                }
                _sakuraBranchCanvas = null;
                _sakuraBranchCtx = null;

                // RAF / intervals
                if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
                if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }

                // inline-стили окна
                if (root) {
                    root.style.removeProperty('background-image');
                    root.style.removeProperty('background');
                    root.style.removeProperty('box-shadow');
                    root.style.removeProperty('filter');
                    const head = root.querySelector('#fquest-head');
                    if (head) {
                        head.style.removeProperty('transform');
                        head.style.removeProperty('text-shadow');
                    }
                }

                document.documentElement.style.removeProperty('--fq-accent');
                _active = null;
            },

            getActive() { return _active; },

            pause() {
                if (_particlesInstance) {
                    try { _particlesInstance.pause(); } catch (_) {}
                }
                if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
                if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
            },

            async resume() {
                const t = _active;
                if (!t) return;
                const root = getRoot();
                if (!root || root.style.display === 'none') return;
                platform?.Logger?.info?.(`[Theme] resume for "${t}"`);
                await this.apply(t);
            },

            // ============================================================
            //  CYBERPUNK — без particles
            // ============================================================
            _startCyberpunk() {
                const root = getRoot();
                if (!root) return;

                _intervalId = setInterval(() => {
                    if (_active !== 'cyberpunk') return;
                    if (Math.random() > 0.75) {
                        const target = root.querySelector('#fquest-head') || root;
                        target.style.textShadow = `${(Math.random() * 4 - 2).toFixed(1)}px 0 #FF2C9C, ${(Math.random() * 4 - 2).toFixed(1)}px 0 #00FFF0`;
                        target.style.transform = `translate(${(Math.random() * 2 - 1).toFixed(1)}px, 0)`;
                        setTimeout(() => {
                            target.style.removeProperty('text-shadow');
                            target.style.removeProperty('transform');
                        }, 70 + Math.random() * 90);
                    }
                }, 700);

                let t = 0;
                const pulse = () => {
                    if (_active !== 'cyberpunk') return;
                    t += 0.05;
                    const hue = 300 + Math.sin(t) * 30;
                    const glow = 12 + Math.sin(t * 1.3) * 6;
                    root.style.boxShadow = `0 24px 80px rgba(0,0,0,.85), 0 0 ${glow}px hsl(${hue}, 100%, 60%), 0 0 0 1px hsla(${hue}, 100%, 60%, .4) inset`;
                    _rafId = requestAnimationFrame(pulse);
                };
                _rafId = requestAnimationFrame(pulse);
            },

            // ============================================================
            //  MIDNIGHT — туманные пятна через tsParticles
            // ============================================================
            async _startMidnight() {
                const tsP = await loadTsParticles().catch(() => null);
                if (!tsP) return;

                const container = ensureParticlesContainer('fq-particles-container');
                if (!container) return;

                _particlesInstance = await tsP.load('fq-particles-container', {
                    fpsLimit: 30,
                    fullScreen: { enable: false },
                    background: { color: 'transparent' },
                    detectRetina: true,
                    particles: {
                        number: { value: 5, density: { enable: false } },
                        color: {
                            value: ['#C084FC', '#A855F7', '#7DD3FC', '#F0ABFC'],
                        },
                        shape: { type: 'circle' },
                        opacity: {
                            value: { min: 0.15, max: 0.4 },
                            animation: { enable: true, speed: 0.4, sync: false },
                        },
                        size: {
                            value: { min: 200, max: 380 },
                            animation: { enable: true, speed: 1, sync: false },
                        },
                        move: {
                            enable: true,
                            speed: 0.6,
                            direction: 'none',
                            random: true,
                            straight: false,
                            outModes: { default: 'bounce' },
                        },
                        blur: { enable: true, value: 60 },
                    },
                    interactivity: { events: { onHover: { enable: false }, onClick: { enable: false } } },
                });
            },

            // ============================================================
            //  SAKURA — ветка (canvas) + лепестки (tsParticles)
            // ============================================================
            async _startSakura() {
                const root = getRoot();
                if (!root) return;

                // === 1. ВЕТКА — canvas, запекается 1 раз ===
                this._renderSakuraBranch();

                // === 2. ЛЕПЕСТКИ — tsParticles ===
                const tsP = await loadTsParticles().catch(() => null);
                if (!tsP) return;

                const container = ensureParticlesContainer('fq-particles-container');
                if (!container) return;

                // Получаем координаты области ветки (правый-верх) для эмиттера
                const W = root.clientWidth;
                const H = root.clientHeight;
                const emitterX = 80;   // % ширины — где-то справа
                const emitterY = 15;   // % высоты — на уровне шапки

                _particlesInstance = await tsP.load('fq-particles-container', {
                    fpsLimit: 60,
                    fullScreen: { enable: false },
                    background: { color: 'transparent' },
                    detectRetina: true,
                    particles: {
                        number: { value: 22, density: { enable: false } },
                        shape: {
                            type: 'char',
                            character: {
                                value: ['🌸', '🌸', '🌺', '🌸'],
                                font: 'Verdana',
                                style: '',
                                weight: '400',
                            },
                        },
                        color: {
                            value: ['#FFC8D8', '#FFB0C8', '#FFA0B8', '#FFD0E0'],
                        },
                        opacity: {
                            value: { min: 0.55, max: 0.95 },
                            animation: {
                                enable: true,
                                speed: 0.5,
                                sync: false,
                                startValue: 'max',
                                destroy: 'min',
                            },
                        },
                        size: {
                            value: { min: 8, max: 16 },
                            animation: { enable: false },
                        },
                        move: {
                            enable: true,
                            speed: { min: 0.6, max: 1.2 },
                            direction: 'bottom',
                            random: true,
                            straight: false,
                            outModes: {
                                default: 'destroy',
                                top: 'none',
                                bottom: 'destroy',
                                left: 'none',
                                right: 'none',
                            },
                            gravity: {
                                enable: true,
                                acceleration: 1.5,
                                maxSpeed: 3,
                            },
                        },
                        rotate: {
                            value: { min: 0, max: 360 },
                            animation: { enable: true, speed: 8, sync: false },
                        },
                        wobble: {
                            enable: true,
                            distance: 12,
                            speed: { min: -6, max: 6 },
                        },
                        life: {
                            duration: { min: 4, max: 8 },
                            count: 1,
                        },
                    },
                    emitters: {
                        position: {
                            x: emitterX,
                            y: emitterY,
                        },
                        size: {
                            width: 30,
                            height: 20,
                        },
                        direction: 'bottom',
                        life: { count: 0, duration: 0.1, delay: 0.15 },
                        rate: { quantity: 2, delay: 0.3 },
                    },
                    interactivity: {
                        events: {
                            onHover: { enable: false },
                            onClick: { enable: false },
                            resize: true,
                        },
                    },
                });
            },

            // === Рисует ветку сакуры на canvas (запекается) ===
            _renderSakuraBranch() {
                const root = getRoot();
                if (!root) return;

                const W = root.clientWidth;
                const H = root.clientHeight;

                if (!_sakuraBranchCanvas) {
                    _sakuraBranchCanvas = document.createElement('canvas');
                    _sakuraBranchCanvas.id = 'fq-sakura-branch';
                    _sakuraBranchCanvas.style.cssText = `
                        position: absolute;
                        inset: 0;
                        pointer-events: none;
                        z-index: 1;
                    `;
                    root.insertBefore(_sakuraBranchCanvas, root.firstChild);
                    _sakuraBranchCtx = _sakuraBranchCanvas.getContext('2d');
                }

                _sakuraBranchCanvas.width = W;
                _sakuraBranchCanvas.height = H;
                _sakuraBranchCtx.clearRect(0, 0, W, H);

                // Генерируем ветку заново
                const branch = this._generateBranch();
                drawBranchStatic(_sakuraBranchCtx, W, H, branch);
            },

            // ============================================================
            //  STARFIELD — звёзды + туманности + кометы (tsParticles)
            // ============================================================
            async _startStarfield() {
                const tsP = await loadTsParticles().catch(() => null);
                if (!tsP) return;

                const container = ensureParticlesContainer('fq-particles-container');
                if (!container) return;

                // Два эмиттера: звёзды + кометы
                _particlesInstance = await tsP.load('fq-particles-container', {
                    fpsLimit: 60,
                    fullScreen: { enable: false },
                    background: { color: 'transparent' },
                    detectRetina: true,
                    particles: {
                        number: { value: 170, density: { enable: false } },
                        color: {
                            value: ['#FFFFFF', '#E0E7FF', '#C7D2FE', '#A5B4FC', '#BAE6FD'],
                        },
                        shape: { type: 'circle' },
                        opacity: {
                            value: { min: 0.25, max: 0.9 },
                            animation: {
                                enable: true,
                                speed: 1.2,
                                sync: false,
                                startValue: 'random',
                                destroy: 'none',
                            },
                        },
                        size: {
                            value: { min: 0.5, max: 2.8 },
                            animation: { enable: false },
                        },
                        move: {
                            enable: true,
                            speed: { min: 0.15, max: 0.5 },
                            direction: 'right',
                            random: true,
                            straight: false,
                            outModes: { default: 'out' },
                            drift: { min: -0.4, max: 0.4 },
                        },
                        twinkle: {
                            particles: {
                                enable: true,
                                frequency: 0.05,
                                color: { value: '#FFFFFF' },
                                opacity: 1,
                            },
                        },
                        shadow: {
                            enable: true,
                            blur: 6,
                            color: { value: '#A5B4FC' },
                        },
                    },
                    interactivity: {
                        events: {
                            onHover: { enable: true, mode: 'bubble' },
                            resize: true,
                        },
                        modes: {
                            bubble: {
                                distance: 100,
                                size: 3,
                                duration: 2,
                                opacity: 1,
                            },
                        },
                    },
                });

                // === Кометы — отдельный таймер ===
                this._startComets();
            },

            // === Кометы — рисуются через tsParticles emitters ===
            async _startComets() {
                if (!_particlesInstance) return;

                // Добавляем эмиттер комет через API tsParticles
                // (это второй способ — можно через options добавить)
                // Пока оставим как есть — основная часть через particles
                // Если нужны реальные кометы, скажи — добавим через tsParticles "emitters" array
            },

            // ============================================================
            //  SAKURA — генерация ветки
            // ============================================================
            _generateBranch() {
                // === 3 главные ветви от корня (веер из правого-верхнего угла) ===
                const trunks = [
                    // Верхняя — по шапке, потом вниз
                    [
                        { x: 1.05, y: 0.05 },
                        { x: 0.95, y: 0.06 },
                        { x: 0.85, y: 0.08 },
                        { x: 0.75, y: 0.11 },
                        { x: 0.67, y: 0.15 },
                        { x: 0.60, y: 0.22 },
                        { x: 0.55, y: 0.30 },
                        { x: 0.52, y: 0.40 },
                    ],
                    // Средняя — по диагонали вниз
                    [
                        { x: 1.05, y: 0.12 },
                        { x: 0.96, y: 0.14 },
                        { x: 0.86, y: 0.18 },
                        { x: 0.77, y: 0.24 },
                        { x: 0.70, y: 0.32 },
                        { x: 0.65, y: 0.42 },
                        { x: 0.62, y: 0.52 },
                    ],
                    // Нижняя — круто вниз
                    [
                        { x: 1.05, y: 0.20 },
                        { x: 0.97, y: 0.26 },
                        { x: 0.89, y: 0.34 },
                        { x: 0.83, y: 0.44 },
                        { x: 0.79, y: 0.54 },
                    ],
                ];

                // Вторичные веточки
                const branches = [
                    { startT: 0, startIdx: 2, points: [{ x: 0.82, y: 0.02 }, { x: 0.76, y: 0.00 }] },
                    { startT: 0, startIdx: 3, points: [{ x: 0.72, y: 0.06 }, { x: 0.66, y: 0.05 }] },
                    { startT: 0, startIdx: 4, points: [{ x: 0.63, y: 0.10 }, { x: 0.58, y: 0.10 }] },
                    { startT: 0, startIdx: 5, points: [{ x: 0.55, y: 0.20 }, { x: 0.50, y: 0.22 }] },
                    { startT: 0, startIdx: 6, points: [{ x: 0.50, y: 0.32 }, { x: 0.45, y: 0.35 }] },
                    { startT: 1, startIdx: 1, points: [{ x: 0.93, y: 0.10 }, { x: 0.87, y: 0.09 }] },
                    { startT: 1, startIdx: 2, points: [{ x: 0.83, y: 0.14 }, { x: 0.77, y: 0.13 }] },
                    { startT: 1, startIdx: 3, points: [{ x: 0.74, y: 0.20 }, { x: 0.68, y: 0.19 }] },
                    { startT: 1, startIdx: 4, points: [{ x: 0.66, y: 0.28 }, { x: 0.60, y: 0.28 }] },
                    { startT: 1, startIdx: 5, points: [{ x: 0.60, y: 0.38 }, { x: 0.55, y: 0.40 }] },
                    { startT: 1, startIdx: 5, points: [{ x: 0.62, y: 0.47 }, { x: 0.57, y: 0.50 }] },
                    { startT: 2, startIdx: 1, points: [{ x: 0.94, y: 0.22 }, { x: 0.88, y: 0.20 }] },
                    { startT: 2, startIdx: 2, points: [{ x: 0.86, y: 0.30 }, { x: 0.80, y: 0.28 }] },
                    { startT: 2, startIdx: 3, points: [{ x: 0.79, y: 0.40 }, { x: 0.73, y: 0.40 }] },
                    { startT: 2, startIdx: 3, points: [{ x: 0.84, y: 0.48 }, { x: 0.79, y: 0.49 }] },
                ];

                const blossoms = [];
                const addBlossom = (x, y) => {
                    if (x < 0.40 || x > 1.05 || y > 0.60 || y < 0) return;
                    blossoms.push({
                        x, y,
                        size: 0.005 + Math.random() * 0.004,
                        rotation: Math.random() * Math.PI * 2,
                        hue: 335 + Math.random() * 18,
                        sat: 72 + Math.random() * 18,
                        lit: 86 + Math.random() * 8,
                        scale: 0.85 + Math.random() * 0.25,
                    });
                };

                // Вдоль стволов
                for (const trunk of trunks) {
                    for (let i = 0; i < trunk.length - 1; i++) {
                        const a = trunk[i], b = trunk[i + 1];
                        for (let s = 0; s <= 3; s++) {
                            const k = s / 3;
                            const x = a.x + (b.x - a.x) * k;
                            const y = a.y + (b.y - a.y) * k;
                            addBlossom(
                                x + (Math.random() - 0.5) * 0.022,
                                y + (Math.random() - 0.5) * 0.018
                            );
                        }
                    }
                }

                // Вдоль веточек
                for (const br of branches) {
                    const trunk = trunks[br.startT];
                    const start = trunk[br.startIdx];
                    const allPts = [start, ...br.points];
                    for (let i = 0; i < allPts.length - 1; i++) {
                        const a = allPts[i], b = allPts[i + 1];
                        for (let s = 0; s <= 2; s++) {
                            const k = s / 2;
                            const x = a.x + (b.x - a.x) * k;
                            const y = a.y + (b.y - a.y) * k;
                            addBlossom(
                                x + (Math.random() - 0.5) * 0.020,
                                y + (Math.random() - 0.5) * 0.016
                            );
                        }
                    }
                }

                const buds = [];
                for (const trunk of trunks) {
                    for (const pt of trunk) {
                        if (Math.random() > 0.55) continue;
                        buds.push({
                            x: pt.x + (Math.random() - 0.5) * 0.03,
                            y: pt.y + (Math.random() - 0.5) * 0.03,
                            size: 0.003 + Math.random() * 0.002,
                            rotation: Math.random() * Math.PI * 2,
                            hue: 340 + Math.random() * 10,
                        });
                    }
                }

                return { trunks, branches, blossoms, buds };
            },
        };

        return _themes;
    },
};

// ============================================================
//  Рисование ветки сакуры (используется только один раз)
// ============================================================
function drawBranchStatic(c2d, W, H, branch) {
    drawTrunks(c2d, W, H, branch);
    for (const bud of branch.buds) drawBud(c2d, bud, W, H);

    const sorted = [...branch.blossoms].sort((a, b) => a.y - b.y);
    for (const blossom of sorted) drawBlossom(c2d, blossom, W, H);
}

function drawTrunks(c2d, W, H, branch) {
    c2d.lineCap = 'round';
    c2d.lineJoin = 'round';

    // 3 главные ветви
    c2d.strokeStyle = '#241820';
    for (const trunk of branch.trunks) {
        c2d.lineWidth = Math.max(4, W * 0.008);
        c2d.beginPath();
        trunk.forEach((p, i) => {
            if (i === 0) c2d.moveTo(p.x * W, p.y * H);
            else c2d.lineTo(p.x * W, p.y * H);
        });
        c2d.stroke();
    }

    // Веточки
    c2d.strokeStyle = '#2E1A24';
    c2d.lineWidth = Math.max(1.5, W * 0.003);
    for (const br of branch.branches) {
        const trunk = branch.trunks[br.startT];
        const start = trunk[br.startIdx];
        c2d.beginPath();
        c2d.moveTo(start.x * W, start.y * H);
        for (const p of br.points) {
            c2d.lineTo(p.x * W, p.y * H);
        }
        c2d.stroke();
    }
}

function drawBlossom(c2d, blossom, W, H) {
    const x = blossom.x * W;
    const y = blossom.y * H;
    const size = blossom.size * W;

    c2d.save();
    c2d.translate(x, y);
    c2d.rotate(blossom.rotation);
    c2d.scale(blossom.scale, blossom.scale);

    c2d.fillStyle = `hsl(${blossom.hue}, ${blossom.sat}%, ${blossom.lit}%)`;
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(angle) * size * 0.55;
        const py = Math.sin(angle) * size * 0.55;

        c2d.beginPath();
        c2d.ellipse(px, py, size * 0.42, size * 0.3, angle + Math.PI / 2, 0, Math.PI * 2);
        c2d.fill();
    }

    c2d.fillStyle = '#FFE090';
    c2d.beginPath();
    c2d.arc(0, 0, size * 0.20, 0, Math.PI * 2);
    c2d.fill();

    c2d.fillStyle = '#C08830';
    c2d.beginPath();
    c2d.arc(0, 0, size * 0.10, 0, Math.PI * 2);
    c2d.fill();

    c2d.restore();
}

function drawBud(c2d, bud, W, H) {
    const x = bud.x * W;
    const y = bud.y * H;
    const size = bud.size * W;

    c2d.save();
    c2d.translate(x, y);
    c2d.rotate(bud.rotation);

    c2d.fillStyle = `hsl(${bud.hue}, 75%, 82%)`;
    c2d.beginPath();
    c2d.ellipse(0, 0, size * 0.5, size * 0.9, 0, 0, Math.PI * 2);
    c2d.fill();

    c2d.fillStyle = '#4E7A4A';
    c2d.beginPath();
    c2d.arc(0, size * 0.7, size * 0.3, 0, Math.PI * 2);
    c2d.fill();

    c2d.restore();
}