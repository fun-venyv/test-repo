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

                // DPR=1 для сакуры, 2 для остальных
                const dpr = id === 'fq-sakura' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
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
            //  SAKURA — генерация ветки (новая траектория)
            // ============================================================
            _generateBranch() {
                // === Новая траектория: сначала вдоль шапки, потом вниз ===
                const trunk = [
                    { x: 1.05, y: 0.06 },   // из-за правого края, в области шапки
                    { x: 0.94, y: 0.07 },   // идёт по шапке горизонтально
                    { x: 0.83, y: 0.09 },
                    { x: 0.72, y: 0.12 },   // начинает загибаться вниз
                    { x: 0.63, y: 0.18 },   // резкий поворот вниз
                    { x: 0.57, y: 0.27 },
                    { x: 0.53, y: 0.38 },   // уходит вниз по правой-центру
                    { x: 0.50, y: 0.50 },
                ];

                // Ветви отходят от ствола
                const branches = [
                    // Верхние (от горизонтальной части) — тонкие, короткие
                    { startIdx: 1, points: [{ x: 0.90, y: 0.03 }, { x: 0.84, y: 0.01 }] },
                    { startIdx: 1, points: [{ x: 0.88, y: 0.11 }, { x: 0.81, y: 0.13 }] },
                    { startIdx: 2, points: [{ x: 0.78, y: 0.04 }, { x: 0.72, y: 0.03 }] },
                    { startIdx: 2, points: [{ x: 0.76, y: 0.14 }, { x: 0.70, y: 0.16 }] },
                    // Средние (на загибе)
                    { startIdx: 3, points: [{ x: 0.66, y: 0.08 }, { x: 0.60, y: 0.06 }] },
                    { startIdx: 4, points: [{ x: 0.58, y: 0.20 }, { x: 0.52, y: 0.19 }] },
                    // Нижние (уже на спуске)
                    { startIdx: 5, points: [{ x: 0.52, y: 0.30 }, { x: 0.47, y: 0.29 }] },
                    { startIdx: 6, points: [{ x: 0.48, y: 0.42 }, { x: 0.43, y: 0.42 }] },
                    { startIdx: 6, points: [{ x: 0.56, y: 0.44 }, { x: 0.51, y: 0.47 }] },
                ];

                const blossoms = [];
                const addBlossom = (x, y) => {
                    // Границы — не выходим за пределы верхней-правой области
                    if (x < 0.38 || x > 1.05 || y > 0.58 || y < 0.0) return;
                    blossoms.push({
                        x, y,
                        // Уменьшенные цветки: 0.006–0.010
                        size: 0.006 + Math.random() * 0.004,
                        rotation: Math.random() * Math.PI * 2,
                        hue: 335 + Math.random() * 18,
                        sat: 72 + Math.random() * 18,
                        lit: 86 + Math.random() * 8,
                        scale: 0.85 + Math.random() * 0.25,
                    });
                };

                // Вокруг каждой точки ствола — по 4 цветка
                for (const pt of trunk) {
                    for (let i = 0; i < 4; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const r = 0.018 + Math.random() * 0.025;
                        addBlossom(pt.x + Math.cos(angle) * r, pt.y + Math.sin(angle) * r * 0.6);
                    }
                }

                // По 2 цветка на каждый сегмент ветви
                for (const b of branches) {
                    const start = trunk[b.startIdx];
                    const allPts = [start, ...b.points];
                    for (let seg = 0; seg < allPts.length - 1; seg++) {
                        const a = allPts[seg], c = allPts[seg + 1];
                        addBlossom(c.x + (Math.random() * 0.02 - 0.01), c.y + (Math.random() * 0.02 - 0.01));
                        addBlossom(
                            (a.x + c.x) / 2 + (Math.random() * 0.02 - 0.01),
                            (a.y + c.y) / 2 + (Math.random() * 0.02 - 0.01)
                        );
                    }
                }

                // Бутоны — мелкие
                const buds = [];
                for (let i = 0; i < 12; i++) {
                    const b = branches[Math.floor(Math.random() * branches.length)];
                    const pt = b.points[Math.floor(Math.random() * b.points.length)];
                    buds.push({
                        x: pt.x + (Math.random() * 0.03 - 0.015),
                        y: pt.y + (Math.random() * 0.03 - 0.015),
                        size: 0.003 + Math.random() * 0.002,
                        rotation: Math.random() * Math.PI * 2,
                        hue: 340 + Math.random() * 10,
                    });
                }

                return { trunk, branches, blossoms, buds };
            },

            // ============================================================
            //  SAKURA — старт
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

                // Offscreen-канвас для ветки — 1:1 без DPR
                let branchCanvas = null;
                let branchCtx = null;

                const renderBranchToOffscreen = () => {
                    if (!branchCanvas) {
                        branchCanvas = document.createElement('canvas');
                        branchCtx = branchCanvas.getContext('2d');
                    }
                    branchCanvas.width = W;
                    branchCanvas.height = H;
                    branchCtx.clearRect(0, 0, W, H);
                    drawBranchStatic(branchCtx, W, H, branch);
                };

                renderBranchToOffscreen();

                const origOnResize = this._onResize;
                this._onResize = (w, h) => {
                    W = w; H = h;
                    origOnResize?.(w, h);
                    renderBranchToOffscreen();
                };

                // === Лепестки ===
                const MAX_PETALS = 20;
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
                        size: 4 + Math.random() * 3,
                        fallSpeed: 0.25 + Math.random() * 0.25,
                        wobbleAmp: 1.0 + Math.random() * 1.6,
                        wobbleFreq: 0.0006 + Math.random() * 0.0012,
                        wobblePhase: Math.random() * Math.PI * 2,
                        rot: Math.random() * Math.PI * 2,
                        rotSpeed: (Math.random() - 0.5) * 0.02,
                        driftX: (Math.random() * 2 - 1) * 0.12,
                        hue: 335 + Math.random() * 15,
                        sat: 70 + Math.random() * 15,
                        lit: 82 + Math.random() * 8,
                        baseAlpha: 0.75 + Math.random() * 0.25,
                    };
                };

                // FPS cap: 50 мс = 20 fps
                const FRAME_MS = 50;

                const draw = (ts) => {
                    if (_active !== 'sakura') return;
                    if (ts - _lastFrame < FRAME_MS) { _rafId = requestAnimationFrame(draw); return; }
                    _lastFrame = ts;

                    c2d.clearRect(0, 0, W, H);

                    // Ветка — drawImage 1:1
                    c2d.drawImage(branchCanvas, 0, 0);

                    // Лепестки
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
//  SAKURA — статичная отрисовка ветки на offscreen
// ============================================================
function drawBranchStatic(c2d, W, H, branch) {
    drawTrunk(c2d, W, H, branch);
    for (const bud of branch.buds) drawBud(c2d, bud, W, H);

    // Сортируем по Y для правильного перекрытия
    const sorted = [...branch.blossoms].sort((a, b) => a.y - b.y);
    for (const blossom of sorted) drawBlossomFast(c2d, blossom, W, H);
}

// ============================================================
//  Ствол + ветви (тоньше)
// ============================================================
function drawTrunk(c2d, W, H, branch) {
    c2d.lineCap = 'round';
    c2d.lineJoin = 'round';

    // Основной ствол — тоньше
    c2d.strokeStyle = '#241820';
    c2d.lineWidth = Math.max(5, W * 0.010);
    c2d.beginPath();
    branch.trunk.forEach((p, i) => {
        if (i === 0) c2d.moveTo(p.x * W, p.y * H);
        else c2d.lineTo(p.x * W, p.y * H);
    });
    c2d.stroke();

    // Ветви — тоньше
    c2d.strokeStyle = '#2E1A24';
    for (const b of branch.branches) {
        const start = branch.trunk[b.startIdx];
        c2d.lineWidth = Math.max(2, W * 0.004);
        c2d.beginPath();
        c2d.moveTo(start.x * W, start.y * H);
        for (const p of b.points) {
            c2d.lineTo(p.x * W, p.y * H);
        }
        c2d.stroke();
    }
}

// ============================================================
//  Цветок — минималистичный
// ============================================================
function drawBlossomFast(c2d, blossom, W, H) {
    const x = blossom.x * W;
    const y = blossom.y * H;
    const size = blossom.size * W;

    c2d.save();
    c2d.translate(x, y);
    c2d.rotate(blossom.rotation);
    c2d.scale(blossom.scale, blossom.scale);

    // 5 лепестков
    c2d.fillStyle = `hsl(${blossom.hue}, ${blossom.sat}%, ${blossom.lit}%)`;
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(angle) * size * 0.55;
        const py = Math.sin(angle) * size * 0.55;

        c2d.beginPath();
        c2d.ellipse(px, py, size * 0.42, size * 0.3, angle + Math.PI / 2, 0, Math.PI * 2);
        c2d.fill();
    }

    // Сердцевина
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

// ============================================================
//  Бутон — 2 кружка
// ============================================================
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

// ============================================================
//  Лепесток — просто эллипс
// ============================================================
function drawPetal(c2d, p, alpha) {
    c2d.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, ${alpha})`;
    c2d.beginPath();
    c2d.ellipse(p.x, p.y, p.size, p.size * 0.55, p.rot, 0, Math.PI * 2);
    c2d.fill();
}