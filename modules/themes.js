/* ============================================================
 *  FQuest · modules/themes.js
 *  Живые темы:
 *    - sakura     → дерево сакуры с покачивающимися ветками
 *    - starfield  → звёзды, туманности, кометы
 *    - midnight   → дрейфующие туманные пятна
 *    - cyberpunk  → глитч-пульсация
 *    - stormveil  → грозовой лес в тумане (молнии, ели, снег)
 * ============================================================ */

module.exports = {
    createThemes(ctx) {
        const { RUNTIME, platform } = ctx;

        let _active = null;
        let _rafId = null;
        let _intervalId = null;
        let _canvas = null;
        let _resizeObserver = null;
        let _lastFrame = 0;
        let _themes = null;

        const visListener = () => {
            if (document.visibilityState !== 'visible') return;
            setTimeout(() => {
                try { _themes?.resume?.(); } catch (_) {}
            }, 200);
        };
        document.addEventListener('visibilitychange', visListener);

        const getRoot = () => document.getElementById('fquest-ui');

        _themes = {
            // ============================================================
            //  APPLY / CLEAR / PAUSE / RESUME
            // ============================================================
            apply(theme) {
                this.clear();
                _active = theme;

                switch (theme) {
                    case 'cyberpunk':  this._startCyberpunk(); break;
                    case 'midnight':   this._startMidnight(); break;
                    case 'sakura':     this._startSakura(); break;
                    case 'starfield':  this._startStarfield(); break;
                    case 'stormveil':  this._startStormveil(); break;
                    default: break;
                }
            },

            clear() {
                if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
                if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
                if (_canvas && _canvas.parentElement) _canvas.parentElement.removeChild(_canvas);
                _canvas = null;
                if (_resizeObserver) {
                    try { _resizeObserver.disconnect(); } catch (_) {}
                    _resizeObserver = null;
                }

                const root = getRoot();
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

                if (typeof this._starfieldCleanup === 'function') {
                    try { this._starfieldCleanup(); } catch (_) {}
                    this._starfieldCleanup = null;
                }
            },

            getActive() { return _active; },

            pause() {
                if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
                if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
            },

            resume() {
                const t = _active;
                if (!t) return;
                const root = getRoot();
                if (!root || root.style.display === 'none') return;
                platform?.Logger?.info?.(`[Theme] resume for "${t}"`);
                this.apply(t);
            },

            _makeCanvas(id, opacity = 1, blend = 'normal') {
                const root = getRoot();
                if (!root) return null;
                _canvas = document.createElement('canvas');
                _canvas.id = id;
                _canvas.style.cssText = `
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    z-index: 0;
                    opacity: ${opacity};
                    mix-blend-mode: ${blend};
                `;
                root.insertBefore(_canvas, root.firstChild);

                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const resize = () => {
                    if (!_canvas || !root) return;
                    const w = root.clientWidth;
                    const h = root.clientHeight;
                    if (w === 0 || h === 0) return;
                    _canvas.width = w * dpr;
                    _canvas.height = h * dpr;
                    _canvas.style.width = w + 'px';
                    _canvas.style.height = h + 'px';
                    const c = _canvas.getContext('2d');
                    c.setTransform(dpr, 0, 0, dpr, 0, 0);
                    if (typeof this._onResize === 'function') this._onResize(w, h);
                };
                resize();
                _resizeObserver = new ResizeObserver(resize);
                _resizeObserver.observe(root);
                return _canvas;
            },

            // ============================================================
            //  CYBERPUNK
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
            //  MIDNIGHT BLOSSOM
            // ============================================================
            _startMidnight() {
                const root = getRoot();
                if (!root) return;

                const canvas = this._makeCanvas('fq-midnight-canvas', 0.9);
                if (!canvas) return;
                const c2d = canvas.getContext('2d');

                let W = root.clientWidth, H = root.clientHeight;
                this._onResize = (w, h) => { W = w; H = h; };

                const blobs = [
                    { hue: 320, sat: 70, lit: 65, r: 0.55, ox: 0.25, oy: 0.30, vx: 0.00018, vy: 0.00011, phase: 0 },
                    { hue: 270, sat: 75, lit: 60, r: 0.50, ox: 0.70, oy: 0.65, vx: -0.00015, vy: 0.00013, phase: Math.PI * 0.6 },
                    { hue: 195, sat: 70, lit: 55, r: 0.45, ox: 0.55, oy: 0.85, vx: 0.00012, vy: -0.00014, phase: Math.PI * 1.3 },
                ];

                const t0 = performance.now();
                const draw = (ts) => {
                    if (_active !== 'midnight') return;
                    if (ts - _lastFrame < 40) { _rafId = requestAnimationFrame(draw); return; }
                    _lastFrame = ts;

                    const elapsed = ts - t0;
                    c2d.clearRect(0, 0, W, H);
                    c2d.globalCompositeOperation = 'lighter';

                    for (const b of blobs) {
                        const cx = W * (b.ox + Math.sin(elapsed * b.vx + b.phase) * 0.18);
                        const cy = H * (b.oy + Math.cos(elapsed * b.vy + b.phase) * 0.18);
                        const radius = Math.max(W, H) * b.r;
                        const grad = c2d.createRadialGradient(cx, cy, 0, cx, cy, radius);
                        grad.addColorStop(0, `hsla(${b.hue}, ${b.sat}%, ${b.lit}%, 0.35)`);
                        grad.addColorStop(0.5, `hsla(${b.hue}, ${b.sat}%, ${b.lit}%, 0.12)`);
                        grad.addColorStop(1, `hsla(${b.hue}, ${b.sat}%, ${b.lit}%, 0)`);
                        c2d.fillStyle = grad;
                        c2d.beginPath();
                        c2d.arc(cx, cy, radius, 0, Math.PI * 2);
                        c2d.fill();
                    }
                    c2d.globalCompositeOperation = 'source-over';
                    _rafId = requestAnimationFrame(draw);
                };
                _rafId = requestAnimationFrame(draw);
            },

            // ============================================================
            //  SAKURA — дерево с покачивающимися ветками
            // ============================================================
            _startSakura() {
                const root = getRoot();
                if (!root) return;

                const canvas = this._makeCanvas('fq-sakura', 1.0);
                if (!canvas) return;
                const c2d = canvas.getContext('2d');

                let W = root.clientWidth, H = root.clientHeight;
                this._onResize = (w, h) => { W = w; H = h; };

                const tree = generateSakuraTree();

                const MAX_PETALS = 16;
                const petals = [];

                const spawnPetal = () => {
                    const branch = tree.branches[Math.floor(Math.random() * tree.branches.length)];
                    const blossom = branch.blossoms[Math.floor(Math.random() * branch.blossoms.length)];

                    const pos = getBlossomWorldPos(tree, branch, blossom);

                    const startX = pos.x + (Math.random() * 20 - 10);
                    const startY = pos.y + (Math.random() * 16 - 8);
                    const maxFallY = H * (0.40 + Math.random() * 0.50);

                    return {
                        x: startX, y: startY, startX, startY, maxFallY,
                        size: 4 + Math.random() * 3,
                        fallSpeed: 0.30 + Math.random() * 0.25,
                        wobbleAmp: 0.8 + Math.random() * 1.4,
                        wobbleFreq: 0.0006 + Math.random() * 0.0012,
                        wobblePhase: Math.random() * Math.PI * 2,
                        rot: Math.random() * Math.PI * 2,
                        rotSpeed: (Math.random() - 0.5) * 0.02,
                        driftX: (Math.random() * 2 - 1) * 0.10,
                        hue: 335 + Math.random() * 15,
                        sat: 68 + Math.random() * 15,
                        lit: 82 + Math.random() * 8,
                        baseAlpha: 0.7 + Math.random() * 0.3,
                    };
                };

                const FRAME_MS = 40;

                const draw = (ts) => {
                    if (_active !== 'sakura') return;
                    if (ts - _lastFrame < FRAME_MS) { _rafId = requestAnimationFrame(draw); return; }
                    _lastFrame = ts;
                    const t = ts * 0.001;

                    c2d.clearRect(0, 0, W, H);

                    drawSakuraTree(c2d, W, H, tree, t);

                    while (petals.length < MAX_PETALS && Math.random() > 0.5) {
                        petals.push(spawnPetal());
                    }

                    for (let i = petals.length - 1; i >= 0; i--) {
                        const p = petals[i];
                        p.y += p.fallSpeed;
                        p.x += Math.sin(ts * p.wobbleFreq + p.wobblePhase) * p.wobbleAmp * 0.15 + p.driftX;
                        p.rot += p.rotSpeed;

                        const totalFall = p.maxFallY - p.startY;
                        const progress = totalFall > 0 ? (p.y - p.startY) / totalFall : 1;

                        let alpha = p.baseAlpha;
                        if (progress > 0.6) {
                            const fade = 1 - (progress - 0.6) / 0.4;
                            alpha = p.baseAlpha * Math.max(0, fade);
                        }
                        if (progress < 0.08) alpha *= progress / 0.08;

                        if (alpha <= 0.01 || p.y > p.maxFallY || p.y > H * 0.9) {
                            petals.splice(i, 1);
                            continue;
                        }

                        c2d.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, ${alpha})`;
                        c2d.beginPath();
                        c2d.ellipse(p.x, p.y, p.size, p.size * 0.55, p.rot, 0, Math.PI * 2);
                        c2d.fill();
                    }

                    _rafId = requestAnimationFrame(draw);
                };
                _rafId = requestAnimationFrame(draw);
            },

            // ============================================================
            //  STARFIELD
            // ============================================================
            _startStarfield() {
                const root = getRoot();
                if (!root) return;

                const canvas = this._makeCanvas('fq-starfield', 1.0);
                if (!canvas) return;
                const c2d = canvas.getContext('2d');

                let W = root.clientWidth, H = root.clientHeight;
                this._onResize = (w, h) => { W = w; H = h; };

                const layers = [
                    { count: 70, depth: 0.4, sizeMin: 0.3, sizeMax: 0.8, alpha: 0.55 },
                    { count: 40, depth: 0.7, sizeMin: 0.6, sizeMax: 1.3, alpha: 0.8 },
                    { count: 18, depth: 1.0, sizeMin: 0.9, sizeMax: 2.0, alpha: 1.0 },
                ];
                const stars = [];
                for (const L of layers) {
                    for (let i = 0; i < L.count; i++) {
                        stars.push({
                            x: Math.random() * W,
                            y: Math.random() * H,
                            size: L.sizeMin + Math.random() * (L.sizeMax - L.sizeMin),
                            depth: L.depth,
                            baseAlpha: L.alpha,
                            twinkleSpeed: 0.0004 + Math.random() * 0.0012,
                            twinklePhase: Math.random() * Math.PI * 2,
                            hue: 200 + Math.random() * 60,
                            vx: (0.08 + Math.random() * 0.08) * L.depth,
                            vy: (0.03 + Math.random() * 0.04) * L.depth,
                            driftPhase: Math.random() * Math.PI * 2,
                            driftFreq: 0.00015 + Math.random() * 0.00025,
                        });
                    }
                }

                const nebulas = [
                    { ox: 0.25, oy: 0.35, r: 0.7, hue: 250, alpha: 0.10 },
                    { ox: 0.75, oy: 0.55, r: 0.6, hue: 210, alpha: 0.08 },
                    { ox: 0.5,  oy: 0.85, r: 0.65, hue: 300, alpha: 0.07 },
                ];

                const COMET_INTERVAL_MS = 10000;
                const COMET_TRAVEL_MS = 2200;
                let activeComet = null;
                let nextCometAt = performance.now() + 2000 + Math.random() * 3000;

                const spawnComet = () => {
                    const fromTop = Math.random() > 0.5;
                    const hue = 190 + Math.random() * 80;
                    const speed = 0.8 + Math.random() * 0.4;

                    let x0, y0, x1, y1;
                    if (fromTop) {
                        x0 = -100;
                        y0 = Math.random() * H * 0.4;
                        x1 = W + 100;
                        y1 = y0 + H * (0.4 + Math.random() * 0.4);
                    } else {
                        x0 = Math.random() * W * 0.3;
                        y0 = -100;
                        x1 = x0 + W * (0.5 + Math.random() * 0.4);
                        y1 = H + 100;
                    }

                    activeComet = {
                        x: x0, y: y0, startX: x0, startY: y0, endX: x1, endY: y1,
                        startTime: performance.now(),
                        duration: COMET_TRAVEL_MS / speed,
                        hue,
                        size: 1.6 + Math.random() * 1.4,
                        tailLength: 80 + Math.random() * 70,
                    };
                };

                let mouseX = 0.5, mouseY = 0.5;
                const onMove = (e) => {
                    if (_active !== 'starfield') return;
                    mouseX = e.clientX / innerWidth;
                    mouseY = e.clientY / innerHeight;
                };
                document.addEventListener('mousemove', onMove);
                this._starfieldCleanup = () => document.removeEventListener('mousemove', onMove);

                const t0 = performance.now();
                const draw = (ts) => {
                    if (_active !== 'starfield') return;
                    if (ts - _lastFrame < 40) { _rafId = requestAnimationFrame(draw); return; }
                    _lastFrame = ts;
                    const elapsed = ts - t0;

                    c2d.clearRect(0, 0, W, H);

                    const px = (mouseX - 0.5) * -25;
                    const py = (mouseY - 0.5) * -25;

                    c2d.globalCompositeOperation = 'lighter';
                    for (const n of nebulas) {
                        const cx = W * n.ox + px * 0.3;
                        const cy = H * n.oy + py * 0.3;
                        const r = Math.max(W, H) * n.r;
                        const grad = c2d.createRadialGradient(cx, cy, 0, cx, cy, r);
                        grad.addColorStop(0, `hsla(${n.hue}, 70%, 55%, ${n.alpha})`);
                        grad.addColorStop(0.5, `hsla(${n.hue}, 70%, 45%, ${n.alpha * 0.4})`);
                        grad.addColorStop(1, `hsla(${n.hue}, 70%, 40%, 0)`);
                        c2d.fillStyle = grad;
                        c2d.beginPath();
                        c2d.arc(cx, cy, r, 0, Math.PI * 2);
                        c2d.fill();
                    }

                    for (const s of stars) {
                        const breath = 0.85 + Math.sin(elapsed * s.driftFreq + s.driftPhase) * 0.15;
                        s.x += s.vx * breath;
                        s.y += s.vy * breath;

                        if (s.x > W + 4) { s.x = -4; s.y = Math.random() * H; }
                        if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
                        if (s.x < -4) s.x = W + 4;
                        if (s.y < -4) s.y = H + 4;

                        const twinkle = 0.7 + Math.sin(elapsed * s.twinkleSpeed + s.twinklePhase) * 0.3;
                        const a = s.baseAlpha * twinkle;
                        const dx = s.x + px * s.depth;
                        const dy = s.y + py * s.depth;

                        if (s.size > 1.2) {
                            c2d.shadowColor = `hsla(${s.hue}, 90%, 80%, ${a * 0.9})`;
                            c2d.shadowBlur = s.size * 5;
                        } else {
                            c2d.shadowBlur = 0;
                        }

                        c2d.fillStyle = `hsla(${s.hue}, 90%, 95%, ${a})`;
                        c2d.beginPath();
                        c2d.arc(dx, dy, s.size, 0, Math.PI * 2);
                        c2d.fill();
                    }
                    c2d.shadowBlur = 0;

                    if (!activeComet && ts >= nextCometAt) {
                        spawnComet();
                    }

                    if (activeComet) {
                        const c = activeComet;
                        const p = (ts - c.startTime) / c.duration;

                        if (p >= 1) {
                            activeComet = null;
                            nextCometAt = ts + COMET_INTERVAL_MS + (Math.random() * 4000 - 2000);
                        } else {
                            const ease = p;
                            c.x = c.startX + (c.endX - c.startX) * ease;
                            c.y = c.startY + (c.endY - c.startY) * ease;

                            const dx = c.endX - c.startX;
                            const dy = c.endY - c.startY;
                            const len = Math.hypot(dx, dy) || 1;
                            const ux = dx / len;
                            const uy = dy / len;

                            let fade = 1;
                            if (p < 0.15) fade = p / 0.15;
                            else if (p > 0.85) fade = (1 - p) / 0.15;

                            const tailX = c.x - ux * c.tailLength;
                            const tailY = c.y - uy * c.tailLength;

                            const tailGrad = c2d.createLinearGradient(c.x, c.y, tailX, tailY);
                            tailGrad.addColorStop(0,    `hsla(${c.hue}, 100%, 85%, ${0.95 * fade})`);
                            tailGrad.addColorStop(0.15, `hsla(${c.hue}, 100%, 75%, ${0.7 * fade})`);
                            tailGrad.addColorStop(0.4,  `hsla(${c.hue + 15}, 90%, 65%, ${0.4 * fade})`);
                            tailGrad.addColorStop(0.7,  `hsla(${c.hue + 25}, 80%, 55%, ${0.15 * fade})`);
                            tailGrad.addColorStop(1,    `hsla(${c.hue + 40}, 70%, 50%, 0)`);

                            c2d.strokeStyle = tailGrad;
                            c2d.lineWidth = c.size * 1.2;
                            c2d.lineCap = 'round';
                            c2d.shadowColor = `hsla(${c.hue}, 100%, 70%, ${fade})`;
                            c2d.shadowBlur = 18;

                            c2d.beginPath();
                            c2d.moveTo(c.x, c.y);
                            c2d.lineTo(tailX, tailY);
                            c2d.stroke();

                            c2d.strokeStyle = `hsla(${c.hue}, 100%, 95%, ${0.5 * fade})`;
                            c2d.lineWidth = c.size * 0.5;
                            c2d.shadowBlur = 10;
                            c2d.beginPath();
                            c2d.moveTo(c.x, c.y);
                            c2d.lineTo(c.x - ux * c.tailLength * 0.5, c.y - uy * c.tailLength * 0.5);
                            c2d.stroke();

                            c2d.shadowColor = `hsla(${c.hue}, 100%, 80%, ${fade})`;
                            c2d.shadowBlur = 25;
                            c2d.fillStyle = `hsla(0, 0%, 100%, ${fade})`;
                            c2d.beginPath();
                            c2d.arc(c.x, c.y, c.size * 0.8, 0, Math.PI * 2);
                            c2d.fill();

                            const coreGrad = c2d.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.size * 6);
                            coreGrad.addColorStop(0, `hsla(${c.hue}, 100%, 90%, ${0.6 * fade})`);
                            coreGrad.addColorStop(0.5, `hsla(${c.hue}, 100%, 70%, ${0.2 * fade})`);
                            coreGrad.addColorStop(1, `hsla(${c.hue}, 100%, 60%, 0)`);
                            c2d.fillStyle = coreGrad;
                            c2d.beginPath();
                            c2d.arc(c.x, c.y, c.size * 6, 0, Math.PI * 2);
                            c2d.fill();

                            c2d.shadowBlur = 0;
                        }
                    }

                    c2d.globalCompositeOperation = 'source-over';
                    _rafId = requestAnimationFrame(draw);
                };
                _rafId = requestAnimationFrame(draw);
            },

            // ============================================================
            //  STORMVEIL — грозовой лес в тумане
            // ============================================================
            _startStormveil() {
                const root = getRoot();
                if (!root) return;

                const canvas = this._makeCanvas('fq-stormveil', 1.0);
                if (!canvas) return;
                const c2d = canvas.getContext('2d');

                let W = root.clientWidth, H = root.clientHeight;
                this._onResize = (w, h) => {
                    W = w; H = h;
                    initSnow();
                };

                // === Состояние молний ===
                const lightning = {
                    active: false,
                    branches: [],
                    startTime: 0,
                    duration: 180,
                    nextAt: performance.now() + 3000 + Math.random() * 5000,
                    flashGlobal: 0,
                };

                // === Генерация ели ===
                const generateFir = (x, baseY, height, width, density) => {
                    const layers = [];
                    const N = Math.floor(height / 8);
                    for (let i = 0; i < N; i++) {
                        const t = i / N;
                        const layerY = baseY - height + t * height;
                        const layerW = width * (0.15 + t * 0.85);
                        const needles = [];
                        const count = 6 + Math.floor(density * t * 14);
                        for (let k = 0; k < count; k++) {
                            const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.9;
                            const len = layerW * (0.5 + Math.random() * 0.7) * (0.7 + t * 0.4);
                            needles.push({
                                dx: Math.cos(angle) * len,
                                dy: Math.sin(angle) * len * 0.35,
                                wobblePhase: Math.random() * Math.PI * 2,
                            });
                        }
                        layers.push({ y: layerY, w: layerW, needles });
                    }
                    return layers;
                };

                const firsFar = [];
                const firsMid = [];
                const firsNear = [];

                for (let i = 0; i < 9; i++) {
                    const x = 0.05 + Math.random() * 0.9;
                    firsFar.push({
                        x,
                        baseY: H * (0.65 + Math.random() * 0.05),
                        height: H * (0.30 + Math.random() * 0.10),
                        width: W * (0.05 + Math.random() * 0.02),
                        hue: 220, sat: 8, lit: 18,
                        blur: 2, alpha: 0.55,
                        layers: [],
                    });
                }
                for (let i = 0; i < 7; i++) {
                    const x = 0.05 + Math.random() * 0.9;
                    firsMid.push({
                        x,
                        baseY: H * (0.85 + Math.random() * 0.05),
                        height: H * (0.45 + Math.random() * 0.12),
                        width: W * (0.07 + Math.random() * 0.03),
                        hue: 220, sat: 6, lit: 10,
                        blur: 1, alpha: 0.85,
                        layers: [],
                    });
                }
                for (let i = 0; i < 3; i++) {
                    const side = i === 0 ? 0.02 : i === 1 ? 0.98 : 0.5;
                    firsNear.push({
                        x: side,
                        baseY: H * 1.05,
                        height: H * (0.9 + Math.random() * 0.25),
                        width: W * (0.15 + Math.random() * 0.05),
                        hue: 220, sat: 5, lit: 5,
                        blur: 0, alpha: 1.0,
                        layers: [],
                    });
                }

                for (const f of firsFar) f.layers = generateFir(f.x, f.baseY, f.height, f.width, 0.5);
                for (const f of firsMid) f.layers = generateFir(f.x, f.baseY, f.height, f.width, 0.8);
                for (const f of firsNear) f.layers = generateFir(f.x, f.baseY, f.height, f.width, 1.2);

                // === Снежинки ===
                const snowflakes = [];
                const MAX_SNOW = 90;
                const initSnow = () => {
                    snowflakes.length = 0;
                    for (let i = 0; i < MAX_SNOW; i++) {
                        snowflakes.push({
                            x: Math.random() * W,
                            y: Math.random() * H,
                            size: 0.4 + Math.random() * 1.2,
                            vx: 0.15 + Math.random() * 0.4,
                            vy: 0.3 + Math.random() * 0.7,
                            alpha: 0.3 + Math.random() * 0.55,
                            wobble: Math.random() * Math.PI * 2,
                        });
                    }
                };
                initSnow();

                // === Спавн молнии ===
                const spawnLightning = () => {
                    const startX = W * (0.15 + Math.random() * 0.7);
                    const startY = 0;

                    const mainBranch = [];
                    let x = startX;
                    let y = startY;
                    const segments = 8 + Math.floor(Math.random() * 6);
                    const segmentHeight = H * (0.45 + Math.random() * 0.35) / segments;

                    mainBranch.push({ x, y });
                    for (let i = 0; i < segments; i++) {
                        x += (Math.random() - 0.5) * W * 0.10;
                        y += segmentHeight * (0.7 + Math.random() * 0.6);
                        mainBranch.push({ x, y });
                    }

                    const branches = [{ points: mainBranch, width: 1.4 + Math.random() * 1.2, alpha: 1 }];

                    const forkCount = 2 + Math.floor(Math.random() * 3);
                    for (let i = 0; i < forkCount; i++) {
                        const forkIdx = 2 + Math.floor(Math.random() * (mainBranch.length - 3));
                        const origin = mainBranch[forkIdx];

                        const forkBranch = [{ x: origin.x, y: origin.y }];
                        let fx = origin.x;
                        let fy = origin.y;
                        const forkSegs = 3 + Math.floor(Math.random() * 4);
                        const dir = Math.random() > 0.5 ? 1 : -1;
                        for (let s = 0; s < forkSegs; s++) {
                            fx += (Math.random() * 0.5 + 0.2) * dir * W * 0.05;
                            fy += (Math.random() * 0.5 + 0.2) * H * 0.04;
                            forkBranch.push({ x: fx, y: fy });
                        }

                        branches.push({
                            points: forkBranch,
                            width: 0.8 + Math.random() * 0.7,
                            alpha: 0.85,
                        });
                    }

                    lightning.active = true;
                    lightning.branches = branches;
                    lightning.startTime = performance.now();
                    lightning.duration = 160 + Math.random() * 200;
                    lightning.flashGlobal = 1;
                };

                const FRAME_MS = 33;

                const draw = (ts) => {
                    if (_active !== 'stormveil') return;
                    if (ts - _lastFrame < FRAME_MS) { _rafId = requestAnimationFrame(draw); return; }
                    _lastFrame = ts;
                    const t = ts * 0.001;

                    // Фон
                    const bgGrad = c2d.createLinearGradient(0, 0, 0, H);
                    const flashAdd = lightning.flashGlobal * 0.35;
                    bgGrad.addColorStop(0, `hsl(220, 12%, ${4 + flashAdd * 30}%)`);
                    bgGrad.addColorStop(0.55, `hsl(220, 8%, ${8 + flashAdd * 35}%)`);
                    bgGrad.addColorStop(0.75, `hsl(220, 6%, ${18 + flashAdd * 40}%)`);
                    bgGrad.addColorStop(1, `hsl(220, 5%, ${12 + flashAdd * 25}%)`);
                    c2d.fillStyle = bgGrad;
                    c2d.fillRect(0, 0, W, H);

                    // Туманные пятна
                    c2d.globalCompositeOperation = 'lighter';
                    for (let i = 0; i < 5; i++) {
                        const phase = i * 1.7;
                        const cx = W * (0.2 + 0.15 * i + Math.sin(t * 0.05 + phase) * 0.08);
                        const cy = H * (0.35 + Math.sin(t * 0.04 + phase * 0.7) * 0.06);
                        const r = Math.max(W, H) * (0.5 + Math.sin(t * 0.03 + phase) * 0.08);
                        const alpha = 0.04 + lightning.flashGlobal * 0.10;
                        const grad = c2d.createRadialGradient(cx, cy, 0, cx, cy, r);
                        grad.addColorStop(0, `hsla(220, 15%, 60%, ${alpha})`);
                        grad.addColorStop(0.5, `hsla(220, 12%, 40%, ${alpha * 0.4})`);
                        grad.addColorStop(1, `hsla(220, 10%, 20%, 0)`);
                        c2d.fillStyle = grad;
                        c2d.beginPath();
                        c2d.arc(cx, cy, r, 0, Math.PI * 2);
                        c2d.fill();
                    }
                    c2d.globalCompositeOperation = 'source-over';

                    // Молния
                    if (!lightning.active && ts >= lightning.nextAt) {
                        spawnLightning();
                    }

                    if (lightning.active) {
                        const elapsed = ts - lightning.startTime;
                        const lt = elapsed / lightning.duration;

                        if (lt >= 1) {
                            lightning.active = false;
                            lightning.nextAt = ts + 5000 + Math.random() * 9000;
                        } else {
                            let alpha = 1;
                            if (lt < 0.15) alpha = lt / 0.15;
                            else if (lt > 0.4) {
                                const flicker = Math.sin(elapsed * 0.08) * 0.5 + 0.5;
                                alpha = flicker * (1 - (lt - 0.4) / 0.6);
                            }

                            lightning.flashGlobal = Math.max(0, 1 - lt * 1.6);

                            c2d.save();
                            c2d.globalCompositeOperation = 'lighter';
                            c2d.shadowColor = 'rgba(200, 230, 255, .9)';
                            c2d.shadowBlur = 24;
                            c2d.lineCap = 'round';
                            c2d.lineJoin = 'round';

                            for (const branch of lightning.branches) {
                                c2d.strokeStyle = `rgba(180, 220, 255, ${0.35 * alpha * branch.alpha})`;
                                c2d.lineWidth = branch.width * 4;
                                c2d.beginPath();
                                branch.points.forEach((p, i) => {
                                    if (i === 0) c2d.moveTo(p.x, p.y);
                                    else c2d.lineTo(p.x, p.y);
                                });
                                c2d.stroke();

                                c2d.strokeStyle = `rgba(220, 240, 255, ${0.7 * alpha * branch.alpha})`;
                                c2d.lineWidth = branch.width * 2;
                                c2d.beginPath();
                                branch.points.forEach((p, i) => {
                                    if (i === 0) c2d.moveTo(p.x, p.y);
                                    else c2d.lineTo(p.x, p.y);
                                });
                                c2d.stroke();

                                c2d.strokeStyle = `rgba(255, 255, 255, ${alpha * branch.alpha})`;
                                c2d.lineWidth = branch.width * 0.9;
                                c2d.shadowBlur = 12;
                                c2d.beginPath();
                                branch.points.forEach((p, i) => {
                                    if (i === 0) c2d.moveTo(p.x, p.y);
                                    else c2d.lineTo(p.x, p.y);
                                });
                                c2d.stroke();
                                c2d.shadowBlur = 24;
                            }

                            c2d.restore();
                        }
                    } else {
                        lightning.flashGlobal *= 0.9;
                    }

                    // Ели
                    drawFirs(c2d, firsFar, t, lightning.flashGlobal, W);
                    drawFirs(c2d, firsMid, t, lightning.flashGlobal, W);
                    drawFirs(c2d, firsNear, t, lightning.flashGlobal, W);

                    // Снежинки
                    c2d.globalCompositeOperation = 'lighter';
                    for (const flake of snowflakes) {
                        flake.x += flake.vx;
                        flake.y += flake.vy;
                        flake.x += Math.sin(t * 0.5 + flake.wobble) * 0.15;

                        if (flake.x > W + 5) flake.x = -5;
                        if (flake.x < -5) flake.x = W + 5;
                        if (flake.y > H + 5) {
                            flake.y = -5;
                            flake.x = Math.random() * W;
                        }

                        const a = flake.alpha * (0.7 + lightning.flashGlobal * 0.4);
                        c2d.fillStyle = `rgba(230, 240, 255, ${a})`;
                        c2d.beginPath();
                        c2d.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
                        c2d.fill();
                    }
                    c2d.globalCompositeOperation = 'source-over';

                    // Глобальная вспышка
                    if (lightning.flashGlobal > 0.02) {
                        c2d.fillStyle = `rgba(200, 220, 255, ${lightning.flashGlobal * 0.15})`;
                        c2d.fillRect(0, 0, W, H);
                    }

                    _rafId = requestAnimationFrame(draw);
                };
                _rafId = requestAnimationFrame(draw);
            },
        };

        return _themes;
    },
};

// ============================================================
//  SAKURA — генерация дерева
// ============================================================
function generateSakuraTree() {
    const trunk = {
        start: { x: 1.05, y: 1.05 },
        cp1:   { x: 0.95, y: 0.85 },
        cp2:   { x: 0.90, y: 0.55 },
        end:   { x: 0.88, y: 0.30 },
        thickness: 9,
    };

    const forkPoint = { x: 0.88, y: 0.30 };
    const branches = [];

    const branchSpecs = [
        { end: { x: 0.55, y: 0.10 }, cp1: { x: 0.80, y: 0.15 }, cp2: { x: 0.68, y: 0.08 }, thickness: 3.5, phase: 0.0 },
        { end: { x: 0.40, y: 0.15 }, cp1: { x: 0.75, y: 0.20 }, cp2: { x: 0.55, y: 0.10 }, thickness: 3.0, phase: 0.8 },
        { end: { x: 0.28, y: 0.25 }, cp1: { x: 0.70, y: 0.28 }, cp2: { x: 0.45, y: 0.20 }, thickness: 2.8, phase: 1.6 },
        { end: { x: 0.45, y: 0.40 }, cp1: { x: 0.72, y: 0.32 }, cp2: { x: 0.55, y: 0.36 }, thickness: 2.5, phase: 2.4 },
        { end: { x: 0.60, y: 0.22 }, cp1: { x: 0.78, y: 0.24 }, cp2: { x: 0.68, y: 0.18 }, thickness: 2.2, phase: 3.2 },
    ];

    for (const spec of branchSpecs) {
        const branch = {
            start: forkPoint,
            cp1: spec.cp1,
            cp2: spec.cp2,
            end: spec.end,
            thickness: spec.thickness,
            phase: spec.phase,
            swayAmp: 0.015 + Math.random() * 0.012,
            swayFreq: 0.25 + Math.random() * 0.20,
            blossoms: [],
        };

        const blossomCount = 14 + Math.floor(Math.random() * 8);
        for (let i = 0; i < blossomCount; i++) {
            const t = 0.35 + Math.random() * 0.65;
            const pt = sampleBezier(branch, t);
            const tangent = sampleBezierTangent(branch, t);
            const perpX = -tangent.y;
            const perpY = tangent.x;
            const spread = (Math.random() - 0.5) * 0.05;

            branch.blossoms.push({
                t,
                offsetX: perpX * spread,
                offsetY: perpY * spread,
                size: 0.010 + Math.random() * 0.008,
                rotation: Math.random() * Math.PI * 2,
                hue: 335 + Math.random() * 15,
                sat: 72 + Math.random() * 15,
                lit: 88 + Math.random() * 6,
                scale: 0.9 + Math.random() * 0.25,
            });
        }

        branches.push(branch);
    }

    return { trunk, branches, forkPoint };
}

function sampleBezier(c, t) {
    const mt = 1 - t;
    return {
        x: mt * mt * mt * c.start.x + 3 * mt * mt * t * c.cp1.x + 3 * mt * t * t * c.cp2.x + t * t * t * c.end.x,
        y: mt * mt * mt * c.start.y + 3 * mt * mt * t * c.cp1.y + 3 * mt * t * t * c.cp2.y + t * t * t * c.end.y,
    };
}

function sampleBezierTangent(c, t) {
    const mt = 1 - t;
    return {
        x: 3 * mt * mt * (c.cp1.x - c.start.x) + 6 * mt * t * (c.cp2.x - c.cp1.x) + 3 * t * t * (c.end.x - c.cp2.x),
        y: 3 * mt * mt * (c.cp1.y - c.start.y) + 6 * mt * t * (c.cp2.y - c.cp1.y) + 3 * t * t * (c.end.y - c.cp2.y),
    };
}

function getBlossomWorldPos(tree, branch, blossom, t = 0) {
    const pt = sampleBezier(branch, blossom.t);
    const angle = getBranchAngle(branch, t);

    const dx = pt.x - tree.forkPoint.x;
    const dy = pt.y - tree.forkPoint.y;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;

    return {
        x: tree.forkPoint.x + rotatedX + blossom.offsetX,
        y: tree.forkPoint.y + rotatedY + blossom.offsetY,
    };
}

function getBranchAngle(branch, t) {
    return Math.sin(t * Math.PI * 2 * branch.swayFreq + branch.phase) * branch.swayAmp;
}

function drawSakuraTree(c2d, W, H, tree, t) {
    c2d.lineCap = 'round';
    c2d.lineJoin = 'round';

    // Ствол
    c2d.strokeStyle = '#2B1A20';
    c2d.lineWidth = Math.max(6, W * (tree.trunk.thickness / 700));
    c2d.beginPath();
    c2d.moveTo(tree.trunk.start.x * W, tree.trunk.start.y * H);
    c2d.bezierCurveTo(
        tree.trunk.cp1.x * W, tree.trunk.cp1.y * H,
        tree.trunk.cp2.x * W, tree.trunk.cp2.y * H,
        tree.trunk.end.x * W, tree.trunk.end.y * H
    );
    c2d.stroke();

    // Ветки
    for (const branch of tree.branches) {
        const angle = getBranchAngle(branch, t);
        const fx = tree.forkPoint.x * W;
        const fy = tree.forkPoint.y * H;

        c2d.save();
        c2d.translate(fx, fy);
        c2d.rotate(angle);
        c2d.translate(-fx, -fy);

        c2d.strokeStyle = '#33202A';
        c2d.lineWidth = Math.max(1.5, W * (branch.thickness / 700));
        c2d.beginPath();
        c2d.moveTo(branch.start.x * W, branch.start.y * H);
        c2d.bezierCurveTo(
            branch.cp1.x * W, branch.cp1.y * H,
            branch.cp2.x * W, branch.cp2.y * H,
            branch.end.x * W, branch.end.y * H
        );
        c2d.stroke();

        for (const blossom of branch.blossoms) {
            const pt = sampleBezier(branch, blossom.t);
            const x = (pt.x + blossom.offsetX) * W;
            const y = (pt.y + blossom.offsetY) * H;
            const size = blossom.size * W;

            drawBlossomAt(c2d, x, y, size, blossom);
        }

        c2d.restore();
    }
}

function drawBlossomAt(c2d, x, y, size, blossom) {
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
        c2d.ellipse(px, py, size * 0.5, size * 0.35, angle + Math.PI / 2, 0, Math.PI * 2);
        c2d.fill();
    }

    c2d.fillStyle = '#FFE090';
    c2d.beginPath();
    c2d.arc(0, 0, size * 0.22, 0, Math.PI * 2);
    c2d.fill();

    c2d.fillStyle = '#C08830';
    c2d.beginPath();
    c2d.arc(0, 0, size * 0.11, 0, Math.PI * 2);
    c2d.fill();

    c2d.restore();
}

// ============================================================
//  STORMVEIL — рисование елей
// ============================================================
function drawFirs(c2d, firs, t, flash, W) {
    for (const fir of firs) {
        const windX = Math.sin(t * 0.8 + fir.x * 10) * 1.2;
        const windY = Math.cos(t * 0.6 + fir.x * 7) * 0.4;

        c2d.save();
        c2d.translate(fir.x * W + windX, windY);

        if (fir.blur > 0) c2d.filter = `blur(${fir.blur}px)`;

        // Ствол
        c2d.strokeStyle = `hsla(${fir.hue}, ${fir.sat}%, ${fir.lit + flash * 25}%, ${fir.alpha})`;
        c2d.lineWidth = 1;
        c2d.beginPath();
        c2d.moveTo(0, fir.baseY);
        c2d.lineTo(0, fir.baseY - fir.height);
        c2d.stroke();

        // Ярусы с иголками
        for (const layer of fir.layers) {
            const layerLit = fir.lit + flash * 30;
            c2d.strokeStyle = `hsla(${fir.hue}, ${fir.sat}%, ${layerLit}%, ${fir.alpha * 0.85})`;
            c2d.lineWidth = 0.8 + (1 - layer.y / fir.baseY) * 0.5;

            for (const needle of layer.needles) {
                const wobble = Math.sin(t * 1.2 + needle.wobblePhase) * 0.5;

                c2d.beginPath();
                c2d.moveTo(0, layer.y);
                c2d.quadraticCurveTo(
                    needle.dx * 0.5,
                    layer.y + needle.dy * 0.5 + wobble,
                    needle.dx,
                    layer.y + needle.dy + wobble * 1.5
                );
                c2d.stroke();
            }
        }

        c2d.filter = 'none';
        c2d.restore();
    }
}