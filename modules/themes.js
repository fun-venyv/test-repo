/* ============================================================
 *  FQuest · modules/themes.js
 *  JS-движок для живых тем:
 *    - cyberpunk     → глитч-пульсация
 *    - midnight      → дрейфующие туманные пятна
 *    - sakura        → запечённая ветка + падающие лепестки
 *    - starfield     → параллакс-звёзды + туманности + кометы
 *  + pause/resume для корректной работы при сворачивании окна
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

                const root = document.getElementById('fquest-ui');
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
                const root = document.getElementById('fquest-ui');
                if (!root) return;
                if (root.style.display === 'none') return;
                platform?.Logger?.info?.(`[Theme] resume for "${t}"`);
                this.apply(t);
            },

            _makeCanvas(id, opacity, blend = 'normal') {
                const root = document.getElementById('fquest-ui');
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
                const root = document.getElementById('fquest-ui');
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
                const root = document.getElementById('fquest-ui');
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
                    if (ts - _lastFrame < 33) { _rafId = requestAnimationFrame(draw); return; }
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
            //  SAKURA — генерация ветки
            // ============================================================
            _generateBranch() {
                const trunk = [
                    { x: 1.00, y: 0.05 }, { x: 0.94, y: 0.12 }, { x: 0.88, y: 0.20 },
                    { x: 0.82, y: 0.28 }, { x: 0.76, y: 0.36 }, { x: 0.70, y: 0.44 },
                    { x: 0.64, y: 0.52 },
                ];

                const branches = [
                    { startIdx: 1, points: [{ x: 0.88, y: 0.05 }, { x: 0.78, y: 0.02 }, { x: 0.68, y: 0.03 }] },
                    { startIdx: 2, points: [{ x: 0.82, y: 0.10 }, { x: 0.72, y: 0.08 }, { x: 0.62, y: 0.10 }] },
                    { startIdx: 3, points: [{ x: 0.76, y: 0.18 }, { x: 0.66, y: 0.16 }, { x: 0.56, y: 0.18 }] },
                    { startIdx: 3, points: [{ x: 0.80, y: 0.24 }, { x: 0.70, y: 0.24 }, { x: 0.60, y: 0.27 }] },
                    { startIdx: 4, points: [{ x: 0.72, y: 0.34 }, { x: 0.62, y: 0.33 }, { x: 0.52, y: 0.35 }] },
                    { startIdx: 5, points: [{ x: 0.66, y: 0.44 }, { x: 0.56, y: 0.43 }, { x: 0.46, y: 0.45 }] },
                    { startIdx: 5, points: [{ x: 0.62, y: 0.50 }, { x: 0.52, y: 0.52 }, { x: 0.42, y: 0.55 }] },
                    { startIdx: 2, points: [{ x: 0.78, y: 0.05 }, { x: 0.76, y: 0.01 }] },
                    { startIdx: 3, points: [{ x: 0.68, y: 0.16 }, { x: 0.64, y: 0.13 }] },
                    { startIdx: 4, points: [{ x: 0.62, y: 0.34 }, { x: 0.58, y: 0.30 }] },
                    { startIdx: 5, points: [{ x: 0.56, y: 0.44 }, { x: 0.52, y: 0.40 }] },
                ];

                const blossoms = [];
                const addBlossom = (x, y, size) => {
                    if (x < 0.3 || x > 1.02 || y > 0.62) return;
                    blossoms.push({
                        x, y,
                        size: size || 0.008 + Math.random() * 0.006,
                        rotation: Math.random() * Math.PI * 2,
                        hue: 335 + Math.random() * 18,
                        sat: 70 + Math.random() * 20,
                        lit: 85 + Math.random() * 8,
                        petalCount: 5,
                        scale: 0.85 + Math.random() * 0.3,
                    });
                };

                for (const pt of trunk) {
                    for (let i = 0; i < 8; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const r = 0.03 + Math.random() * 0.05;
                        addBlossom(pt.x + Math.cos(angle) * r, pt.y + Math.sin(angle) * r * 0.7);
                    }
                }

                for (const b of branches) {
                    const start = trunk[b.startIdx];
                    const allPts = [start, ...b.points];
                    for (let seg = 0; seg < allPts.length - 1; seg++) {
                        const a = allPts[seg], c = allPts[seg + 1];
                        for (let s = 0; s <= 6; s++) {
                            const k = s / 6;
                            const x = a.x + (c.x - a.x) * k;
                            const y = a.y + (c.y - a.y) * k;
                            for (let r = 0; r < 3; r++) {
                                addBlossom(x + (Math.random() * 0.03 - 0.015), y + (Math.random() * 0.03 - 0.015));
                            }
                        }
                    }
                }

                const buds = [];
                for (let i = 0; i < 18; i++) {
                    const b = branches[Math.floor(Math.random() * branches.length)];
                    const pt = b.points[Math.floor(Math.random() * b.points.length)];
                    buds.push({
                        x: pt.x + (Math.random() * 0.04 - 0.02),
                        y: pt.y + (Math.random() * 0.04 - 0.02),
                        size: 0.005 + Math.random() * 0.003,
                        rotation: Math.random() * Math.PI * 2,
                        hue: 340 + Math.random() * 10,
                    });
                }

                return { trunk, branches, blossoms, buds };
            },

            // ============================================================
            //  SAKURA — старт (запечённая ветка + падающие лепестки)
            // ============================================================
            _startSakura() {
                const root = document.getElementById('fquest-ui');
                if (!root) return;

                const canvas = this._makeCanvas('fq-sakura', 1.0);
                if (!canvas) return;
                const c2d = canvas.getContext('2d');

                let W = root.clientWidth, H = root.clientHeight;
                this._onResize = (w, h) => { W = w; H = h; };

                const branch = this._generateBranch();

                // === Offscreen-канвас для ветки (рисуется один раз) ===
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                let branchCanvas = null;
                let branchCtx = null;

                const renderBranchToOffscreen = () => {
                    if (!branchCanvas) {
                        branchCanvas = document.createElement('canvas');
                        branchCtx = branchCanvas.getContext('2d');
                    }
                    branchCanvas.width = W * dpr;
                    branchCanvas.height = H * dpr;
                    branchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    branchCtx.clearRect(0, 0, W, H);
                    drawBranchStatic(branchCtx, W, H, branch);
                };

                renderBranchToOffscreen();

                // Перерисовка offscreen при ресайзе окна
                const origOnResize = this._onResize;
                this._onResize = (w, h) => {
                    W = w; H = h;
                    origOnResize?.(w, h);
                    renderBranchToOffscreen();
                };

                // === Лепестки ===
                const MAX_PETALS = 30;
                const petals = [];

                const spawnPoints = branch.blossoms
                    .filter(b => b.y < 0.35)
                    .map(b => ({ x: b.x, y: b.y }));

                const spawnPetal = () => {
                    const p = spawnPoints[Math.floor(Math.random() * spawnPoints.length)] || { x: 0.85, y: 0.1 };
                    const startX = W * p.x + (Math.random() * 20 - 10);
                    const startY = H * p.y + (Math.random() * 14 - 7);
                    const maxFallY = H * (0.30 + Math.random() * 0.50);

                    return {
                        x: startX, y: startY, startX, startY, maxFallY,
                        size: 5 + Math.random() * 4,
                        fallSpeed: 0.18 + Math.random() * 0.22,
                        wobbleAmp: 1.0 + Math.random() * 1.6,
                        wobbleFreq: 0.0006 + Math.random() * 0.0012,
                        wobblePhase: Math.random() * Math.PI * 2,
                        rot: Math.random() * Math.PI * 2,
                        rotSpeed: (Math.random() - 0.5) * 0.02,
                        driftX: (Math.random() * 2 - 1) * 0.12,
                        hue: 335 + Math.random() * 15,
                        sat: 65 + Math.random() * 20,
                        lit: 80 + Math.random() * 10,
                        baseAlpha: 0.7 + Math.random() * 0.3,
                    };
                };

                const draw = (ts) => {
                    if (_active !== 'sakura') return;
                    if (ts - _lastFrame < 33) { _rafId = requestAnimationFrame(draw); return; }
                    _lastFrame = ts;
                    const t = ts * 0.001;

                    c2d.clearRect(0, 0, W, H);

                    // === 1. Ветка (с лёгким sway) ===
                    const swayX = Math.sin(t * 0.4) * 2.5;
                    const swayY = Math.cos(t * 0.35) * 1.5;
                    const swayRot = Math.sin(t * 0.3) * 0.008;

                    c2d.save();
                    c2d.translate(W, 0);
                    c2d.rotate(swayRot);
                    c2d.translate(-W + swayX, swayY);
                    c2d.drawImage(
                        branchCanvas,
                        0, 0, branchCanvas.width, branchCanvas.height,
                        0, 0, W, H
                    );
                    c2d.restore();

                    // === 2. Лепестки ===
                    while (petals.length < MAX_PETALS && Math.random() > 0.4) {
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
                        if (progress > 0.55) {
                            const fade = 1 - (progress - 0.55) / 0.45;
                            alpha = p.baseAlpha * Math.max(0, fade);
                        }
                        if (progress < 0.08) alpha *= progress / 0.08;

                        if (alpha <= 0.01 || p.y > p.maxFallY || p.y > H * 0.9) {
                            petals.splice(i, 1);
                            continue;
                        }

                        drawPetal(c2d, p, alpha);
                    }

                    _rafId = requestAnimationFrame(draw);
                };
                _rafId = requestAnimationFrame(draw);

                // Порывы ветра
                _intervalId = setInterval(() => {
                    if (_active !== 'sakura') return;
                    const gust = (Math.random() * 2 - 1) * 0.5;
                    for (const p of petals) p.driftX = gust * (0.5 + Math.random());
                    setTimeout(() => {
                        for (const p of petals) p.driftX *= 0.2;
                    }, 1500 + Math.random() * 1500);
                }, 7000);
            },

            // ============================================================
            //  STARFIELD
            // ============================================================
            _startStarfield() {
                const root = document.getElementById('fquest-ui');
                if (!root) return;

                const canvas = this._makeCanvas('fq-starfield', 1.0);
                if (!canvas) return;
                const c2d = canvas.getContext('2d');

                let W = root.clientWidth, H = root.clientHeight;
                this._onResize = (w, h) => { W = w; H = h; };

                const layers = [
                    { count: 90, depth: 0.4, sizeMin: 0.3, sizeMax: 0.8, alpha: 0.55 },
                    { count: 50, depth: 0.7, sizeMin: 0.6, sizeMax: 1.3, alpha: 0.8 },
                    { count: 22, depth: 1.0, sizeMin: 0.9, sizeMax: 2.0, alpha: 1.0 },
                ];
                const stars = [];
                for (const L of layers) {
                    for (let i = 0; i < L.count; i++) {
                        stars.push({
                            x: Math.random() * W,
                            y: Math.random() * H,
                            size: L.sizeMin + Math.random() * (L.sizeMax - L.sizeMin),
                            depth: L.depth,
                            alpha: L.alpha * (0.5 + Math.random() * 0.5),
                            baseAlpha: L.alpha,
                            twinkleSpeed: 0.0004 + Math.random() * 0.0012,
                            twinklePhase: Math.random() * Math.PI * 2,
                            hue: 200 + Math.random() * 60,
                            vx: (0.12 + Math.random() * 0.10) * L.depth,
                            vy: (0.05 + Math.random() * 0.06) * L.depth,
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
                    if (ts - _lastFrame < 33) { _rafId = requestAnimationFrame(draw); return; }
                    _lastFrame = ts;
                    const elapsed = ts - t0;

                    c2d.clearRect(0, 0, W, H);

                    const px = (mouseX - 0.5) * -30;
                    const py = (mouseY - 0.5) * -30;

                    // Туманности
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

                    // Звёзды
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

                    // Кометы
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
        };

        return _themes;
    },
};

// ============================================================
//  СТАТИЧНАЯ отрисовка ветки (для offscreen canvas)
// ============================================================
function drawBranchStatic(c2d, W, H, branch) {
    // Тень ветки
    c2d.save();
    c2d.shadowColor = 'rgba(0, 0, 0, .55)';
    c2d.shadowBlur = 22;
    c2d.shadowOffsetY = 6;
    drawTrunk(c2d, W, H, branch);
    c2d.restore();

    // Сама ветка
    drawTrunk(c2d, W, H, branch);

    // Бутоны
    for (const bud of branch.buds) {
        drawBud(c2d, bud, W, H);
    }

    // Цветки — сортируем по Y
    const sorted = [...branch.blossoms].sort((a, b) => a.y - b.y);
    for (const blossom of sorted) {
        drawBlossomFast(c2d, blossom, W, H);
    }
}

// ============================================================
//  СТВОЛ И ВЕТВИ
// ============================================================
function drawTrunk(c2d, W, H, branch) {
    c2d.strokeStyle = '#1F1218';
    c2d.lineCap = 'round';
    c2d.lineJoin = 'round';
    c2d.lineWidth = Math.max(8, W * 0.018);

    c2d.beginPath();
    branch.trunk.forEach((p, i) => {
        if (i === 0) c2d.moveTo(p.x * W, p.y * H);
        else c2d.lineTo(p.x * W, p.y * H);
    });
    c2d.stroke();

    // Блик на стволе
    c2d.strokeStyle = 'rgba(120, 70, 90, .55)';
    c2d.lineWidth = Math.max(2, W * 0.005);
    c2d.beginPath();
    branch.trunk.forEach((p, i) => {
        const x = p.x * W, y = p.y * H - 3;
        if (i === 0) c2d.moveTo(x, y);
        else c2d.lineTo(x, y);
    });
    c2d.stroke();

    // Ветви
    for (const b of branch.branches) {
        const start = branch.trunk[b.startIdx];
        c2d.strokeStyle = '#2A1820';
        c2d.lineWidth = Math.max(3, W * 0.008);
        c2d.beginPath();
        c2d.moveTo(start.x * W, start.y * H);
        for (const p of b.points) {
            c2d.lineTo(p.x * W, p.y * H);
        }
        c2d.stroke();

        c2d.strokeStyle = 'rgba(110, 60, 80, .4)';
        c2d.lineWidth = Math.max(1, W * 0.002);
        c2d.beginPath();
        c2d.moveTo(start.x * W, start.y * H - 2);
        for (const p of b.points) {
            c2d.lineTo(p.x * W, p.y * H - 2);
        }
        c2d.stroke();
    }
}

// ============================================================
//  ЦВЕТОК (быстрая версия — без shadowBlur, минимум градиентов)
// ============================================================
function drawBlossomFast(c2d, blossom, W, H) {
    const x = blossom.x * W;
    const y = blossom.y * H;
    const size = blossom.size * W;

    c2d.save();
    c2d.translate(x, y);
    c2d.rotate(blossom.rotation);
    c2d.scale(blossom.scale, blossom.scale);

    // 5 лепестков одним цветом
    c2d.fillStyle = `hsl(${blossom.hue}, ${blossom.sat}%, ${blossom.lit}%)`;
    c2d.strokeStyle = `hsl(${blossom.hue - 20}, ${blossom.sat}%, ${blossom.lit - 35}%)`;
    c2d.lineWidth = 0.5;

    const petals = blossom.petalCount;
    for (let i = 0; i < petals; i++) {
        const angle = (i / petals) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(angle) * size * 0.55;
        const py = Math.sin(angle) * size * 0.55;

        c2d.beginPath();
        c2d.ellipse(px, py, size * 0.42, size * 0.3, angle + Math.PI / 2, 0, Math.PI * 2);
        c2d.fill();
        c2d.stroke();
    }

    // Сердцевина — один градиент
    const coreGrad = c2d.createRadialGradient(0, 0, 0, 0, 0, size * 0.3);
    coreGrad.addColorStop(0, '#FFEEB0');
    coreGrad.addColorStop(0.6, '#F0C060');
    coreGrad.addColorStop(1, '#C08830');
    c2d.fillStyle = coreGrad;
    c2d.beginPath();
    c2d.arc(0, 0, size * 0.22, 0, Math.PI * 2);
    c2d.fill();

    // Тычинки
    c2d.fillStyle = '#FFE090';
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const r = size * 0.2;
        c2d.beginPath();
        c2d.arc(Math.cos(a) * r, Math.sin(a) * r, size * 0.05, 0, Math.PI * 2);
        c2d.fill();
    }

    c2d.restore();
}

// ============================================================
//  БУТОН (без shadowBlur)
// ============================================================
function drawBud(c2d, bud, W, H) {
    const x = bud.x * W;
    const y = bud.y * H;
    const size = bud.size * W;

    c2d.save();
    c2d.translate(x, y);
    c2d.rotate(bud.rotation);

    const grad = c2d.createRadialGradient(-size * 0.2, -size * 0.2, 0, 0, 0, size);
    grad.addColorStop(0, `hsl(${bud.hue}, 75%, 92%)`);
    grad.addColorStop(0.7, `hsl(${bud.hue}, 75%, 78%)`);
    grad.addColorStop(1, `hsl(${bud.hue - 15}, 65%, 55%)`);
    c2d.fillStyle = grad;

    c2d.beginPath();
    c2d.ellipse(0, 0, size * 0.5, size * 0.9, 0, 0, Math.PI * 2);
    c2d.fill();

    // Зелёный чашелистик
    c2d.fillStyle = '#4E7A4A';
    c2d.beginPath();
    c2d.ellipse(0, size * 0.7, size * 0.4, size * 0.3, 0, 0, Math.PI * 2);
    c2d.fill();

    c2d.restore();
}

// ============================================================
//  ЛЕПЕСТОК (без shadowBlur — свечение через доп. слой)
// ============================================================
function drawPetal(c2d, p, alpha) {
    c2d.save();
    c2d.translate(p.x, p.y);
    c2d.rotate(p.rot);

    // Мягкое свечение — большой полупрозрачный круг
    c2d.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, ${alpha * 0.15})`;
    c2d.beginPath();
    c2d.arc(0, 0, p.size * 1.4, 0, Math.PI * 2);
    c2d.fill();

    // Основная форма лепестка
    c2d.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, ${alpha})`;
    c2d.beginPath();
    c2d.moveTo(-p.size, 0);
    c2d.quadraticCurveTo(-p.size * 0.4, -p.size * 0.75, p.size * 0.7, -p.size * 0.18);
    c2d.quadraticCurveTo(p.size, 0, p.size * 0.7, p.size * 0.18);
    c2d.quadraticCurveTo(-p.size * 0.4, p.size * 0.75, -p.size, 0);
    c2d.closePath();
    c2d.fill();

    // Верхний светлый блик
    c2d.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.lit + 10}%, ${alpha * 0.5})`;
    c2d.beginPath();
    c2d.moveTo(-p.size * 0.7, 0);
    c2d.quadraticCurveTo(-p.size * 0.3, -p.size * 0.55, p.size * 0.5, -p.size * 0.12);
    c2d.quadraticCurveTo(0, 0, -p.size * 0.7, 0);
    c2d.fill();

    c2d.restore();
}