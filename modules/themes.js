/* ============================================================
 *  FQuest · modules/themes.js
 *  Живые темы:
 *    - sakura     → ветка на кривых Безье + падающие лепестки
 *    - starfield  → звёзды, туманности, кометы
 *    - midnight   → дрейфующие туманные пятна
 *    - cyberpunk  → глитч-пульсация
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
            //  SAKURA — новая ветка на кривых Безье
            // ============================================================
            _startSakura() {
                const root = getRoot();
                if (!root) return;

                const canvas = this._makeCanvas('fq-sakura', 1.0);
                if (!canvas) return;
                const c2d = canvas.getContext('2d');

                let W = root.clientWidth, H = root.clientHeight;
                this._onResize = (w, h) => { W = w; H = h; };

                // Генерируем ветку
                const branch = generateSakuraBranch();

                // Offscreen — рисуем 1 раз
                let branchCanvas = null;
                let branchCtx = null;

                const renderBranch = () => {
                    if (!branchCanvas) {
                        branchCanvas = document.createElement('canvas');
                        branchCtx = branchCanvas.getContext('2d');
                    }
                    branchCanvas.width = W;
                    branchCanvas.height = H;
                    branchCtx.clearRect(0, 0, W, H);
                    drawSakuraBranch(branchCtx, W, H, branch);
                };
                renderBranch();

                const origOnResize = this._onResize;
                this._onResize = (w, h) => {
                    W = w; H = h;
                    origOnResize?.(w, h);
                    renderBranch();
                };

                // Лепестки
                const MAX_PETALS = 18;
                const petals = [];

                // Спавн-точки — берём верхние цветки
                const spawnPoints = branch.blossoms
                    .filter(b => b.y < 0.4)
                    .map(b => ({ x: b.x, y: b.y }));

                const spawnPetal = () => {
                    const p = spawnPoints[Math.floor(Math.random() * spawnPoints.length)] || { x: 0.75, y: 0.15 };
                    const startX = W * p.x + (Math.random() * 24 - 12);
                    const startY = H * p.y + (Math.random() * 16 - 8);
                    const maxFallY = H * (0.35 + Math.random() * 0.45);

                    return {
                        x: startX, y: startY, startX, startY, maxFallY,
                        size: 4 + Math.random() * 3,
                        fallSpeed: 0.28 + Math.random() * 0.24,
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

                    c2d.clearRect(0, 0, W, H);

                    // Ветка
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
                        if (progress > 0.6) {
                            const fade = 1 - (progress - 0.6) / 0.4;
                            alpha = p.baseAlpha * Math.max(0, fade);
                        }
                        if (progress < 0.08) alpha *= progress / 0.08;

                        if (alpha <= 0.01 || p.y > p.maxFallY || p.y > H * 0.9) {
                            petals.splice(i, 1);
                            continue;
                        }

                        // Простой лепесток-эллипс
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
//  ГЕНЕРАЦИЯ ВЕТКИ САКУРЫ (кривые Безье)
// ============================================================
function generateSakuraBranch() {
    // === Кривые ствола через контрольные точки Безье ===
    // Каждая ветка = { start, cp1, cp2, end } в % от W и H
    // Изогнутые, плавные — как настоящие

    const curves = [
        // === Главный ствол — от правого-верхнего угла вниз-влево ===
        {
            start: { x: 1.05, y: 0.08 },
            cp1:   { x: 0.85, y: 0.05 },
            cp2:   { x: 0.65, y: 0.20 },
            end:   { x: 0.52, y: 0.45 },
            thickness: 8,
        },
        // === Вторая главная ветвь — ниже, круче ===
        {
            start: { x: 1.05, y: 0.18 },
            cp1:   { x: 0.88, y: 0.22 },
            cp2:   { x: 0.75, y: 0.35 },
            end:   { x: 0.68, y: 0.55 },
            thickness: 6,
        },
        // === Третья ветвь — самая нижняя ===
        {
            start: { x: 1.05, y: 0.30 },
            cp1:   { x: 0.92, y: 0.40 },
            cp2:   { x: 0.85, y: 0.50 },
            end:   { x: 0.82, y: 0.58 },
            thickness: 4.5,
        },
    ];

    // === Вторичные веточки — отходят от главных ===
    const twigs = [
        // От первой (верхней) ветви
        { start: { x: 0.88, y: 0.10 }, cp1: { x: 0.82, y: 0.04 }, cp2: { x: 0.74, y: 0.06 }, end: { x: 0.68, y: 0.08 }, thickness: 2.5 },
        { start: { x: 0.78, y: 0.12 }, cp1: { x: 0.72, y: 0.08 }, cp2: { x: 0.66, y: 0.10 }, end: { x: 0.60, y: 0.13 }, thickness: 2 },
        { start: { x: 0.68, y: 0.22 }, cp1: { x: 0.62, y: 0.20 }, cp2: { x: 0.56, y: 0.24 }, end: { x: 0.52, y: 0.28 }, thickness: 1.8 },
        { start: { x: 0.60, y: 0.32 }, cp1: { x: 0.54, y: 0.32 }, cp2: { x: 0.49, y: 0.36 }, end: { x: 0.46, y: 0.42 }, thickness: 1.5 },
        { start: { x: 0.72, y: 0.16 }, cp1: { x: 0.68, y: 0.10 }, cp2: { x: 0.62, y: 0.08 }, end: { x: 0.57, y: 0.05 }, thickness: 2 },

        // От второй (средней)
        { start: { x: 0.90, y: 0.26 }, cp1: { x: 0.84, y: 0.22 }, cp2: { x: 0.78, y: 0.20 }, end: { x: 0.72, y: 0.20 }, thickness: 2 },
        { start: { x: 0.80, y: 0.38 }, cp1: { x: 0.74, y: 0.36 }, cp2: { x: 0.68, y: 0.38 }, end: { x: 0.62, y: 0.42 }, thickness: 1.8 },
        { start: { x: 0.74, y: 0.48 }, cp1: { x: 0.70, y: 0.48 }, cp2: { x: 0.66, y: 0.52 }, end: { x: 0.62, y: 0.56 }, thickness: 1.5 },

        // От третьей (нижней)
        { start: { x: 0.94, y: 0.38 }, cp1: { x: 0.90, y: 0.36 }, cp2: { x: 0.86, y: 0.38 }, end: { x: 0.82, y: 0.42 }, thickness: 1.8 },
        { start: { x: 0.88, y: 0.48 }, cp1: { x: 0.85, y: 0.48 }, cp2: { x: 0.82, y: 0.52 }, end: { x: 0.80, y: 0.57 }, thickness: 1.5 },
    ];

    // === Цветки вдоль кривых ===
    const blossoms = [];

    const sampleCurve = (c, t) => {
        // Формула кубической Безье
        const mt = 1 - t;
        const x = mt * mt * mt * c.start.x + 3 * mt * mt * t * c.cp1.x + 3 * mt * t * t * c.cp2.x + t * t * t * c.end.x;
        const y = mt * mt * mt * c.start.y + 3 * mt * mt * t * c.cp1.y + 3 * mt * t * t * c.cp2.y + t * t * t * c.end.y;
        return { x, y };
    };

    const addBlossomAt = (pt, sizeScale = 1) => {
        if (pt.x < 0.35 || pt.x > 1.05 || pt.y > 0.65 || pt.y < 0) return;
        blossoms.push({
            x: pt.x + (Math.random() - 0.5) * 0.020,
            y: pt.y + (Math.random() - 0.5) * 0.016,
            size: (0.006 + Math.random() * 0.004) * sizeScale,
            rotation: Math.random() * Math.PI * 2,
            hue: 335 + Math.random() * 18,
            sat: 72 + Math.random() * 18,
            lit: 86 + Math.random() * 8,
            scale: 0.85 + Math.random() * 0.25,
        });
    };

    // Плотность цветков вдоль главных стволов
    for (const c of curves) {
        const steps = 14;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const pt = sampleCurve(c, t);
            addBlossomAt(pt, 1);
            if (Math.random() > 0.5) {
                addBlossomAt({ x: pt.x + (Math.random() - 0.5) * 0.03, y: pt.y + (Math.random() - 0.5) * 0.03 }, 0.9);
            }
        }
    }

    // Вдоль веточек
    for (const c of twigs) {
        const steps = 6;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const pt = sampleCurve(c, t);
            addBlossomAt(pt, 0.85);
        }
    }

    // === Бутоны ===
    const buds = [];
    for (const c of twigs) {
        const pt = sampleCurve(c, 1);   // конец веточки
        buds.push({
            x: pt.x + (Math.random() - 0.5) * 0.02,
            y: pt.y + (Math.random() - 0.5) * 0.02,
            size: 0.004 + Math.random() * 0.002,
            rotation: Math.random() * Math.PI * 2,
            hue: 340 + Math.random() * 10,
        });
    }

    return { curves, twigs, blossoms, buds };
}

// ============================================================
//  РИСОВАНИЕ ВЕТКИ
// ============================================================
function drawSakuraBranch(c2d, W, H, branch) {
    // 1. Стволы
    c2d.lineCap = 'round';
    c2d.lineJoin = 'round';

    for (const c of branch.curves) {
        c2d.strokeStyle = '#1F1218';
        c2d.lineWidth = Math.max(4, W * (c.thickness / 700));
        c2d.beginPath();
        c2d.moveTo(c.start.x * W, c.start.y * H);
        c2d.bezierCurveTo(
            c.cp1.x * W, c.cp1.y * H,
            c.cp2.x * W, c.cp2.y * H,
            c.end.x * W, c.end.y * H
        );
        c2d.stroke();
    }

    // 2. Веточки
    for (const c of branch.twigs) {
        c2d.strokeStyle = '#2A1820';
        c2d.lineWidth = Math.max(1.5, W * (c.thickness / 700));
        c2d.beginPath();
        c2d.moveTo(c.start.x * W, c.start.y * H);
        c2d.bezierCurveTo(
            c.cp1.x * W, c.cp1.y * H,
            c.cp2.x * W, c.cp2.y * H,
            c.end.x * W, c.end.y * H
        );
        c2d.stroke();
    }

    // 3. Бутоны
    for (const bud of branch.buds) {
        drawBud(c2d, bud, W, H);
    }

    // 4. Цветки (сортируем по Y — дальние сзади)
    const sorted = [...branch.blossoms].sort((a, b) => a.y - b.y);
    for (const b of sorted) {
        drawBlossom(c2d, b, W, H);
    }
}

// ============================================================
//  ЦВЕТОК
// ============================================================
function drawBlossom(c2d, blossom, W, H) {
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
        c2d.ellipse(px, py, size * 0.42, size * 0.30, angle + Math.PI / 2, 0, Math.PI * 2);
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
//  БУТОН
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