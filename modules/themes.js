/* ============================================================
 *  FQuest · modules/themes.js
 *  JS-движок для живых тем:
 *    - cyberpunk     → глитч-пульсация
 *    - midnight      → дрейфующие туманные пятна
 *    - sakura        → падающие лепестки (canvas)
 *    - starfield     → параллакс-звёзды + мерцание + туманность
 *    - aurora-waves  → северное сияние волнами
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

        return {
            apply(theme) {
                this.clear();
                _active = theme;

                switch (theme) {
                    case 'cyberpunk':    this._startCyberpunk(); break;
                    case 'midnight':     this._startMidnight(); break;
                    case 'sakura':       this._startSakura(); break;
                    case 'starfield':    this._startStarfield(); break;
                    case 'aurora-waves': this._startAuroraWaves(); break;
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
            },

            getActive() { return _active; },

            // ============================================================
            //  ХЕЛПЕР: создать canvas с автоподгонкой под окно
            // ============================================================
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
            //  MIDNIGHT BLOSSOM (туманные пятна)
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
            //  SAKURA — падающие лепестки поверх CSS-ветки
            // ============================================================
            _startSakura() {
                const root = document.getElementById('fquest-ui');
                if (!root) return;

                const canvas = this._makeCanvas('fq-sakura-petals', 0.95);
                if (!canvas) return;
                const c2d = canvas.getContext('2d');

                let W = root.clientWidth, H = root.clientHeight;
                this._onResize = (w, h) => { W = w; H = h; };

                const PETAL_COUNT = 32;
                const petals = [];
                for (let i = 0; i < PETAL_COUNT; i++) {
                    petals.push({
                        x: Math.random() * W,
                        y: Math.random() * H - H,
                        size: 4 + Math.random() * 5,
                        speed: 0.4 + Math.random() * 0.9,
                        drift: 0.3 + Math.random() * 0.7,
                        rot: Math.random() * Math.PI * 2,
                        rotSpeed: (Math.random() - 0.5) * 0.04,
                        hue: 335 + Math.random() * 20,
                        sat: 60 + Math.random() * 20,
                        lit: 78 + Math.random() * 12,
                        alpha: 0.55 + Math.random() * 0.4,
                        wobblePhase: Math.random() * Math.PI * 2,
                        wobbleAmp: 0.6 + Math.random() * 0.9,
                    });
                }

                // Падающие лепестки + лёгкое свечение
                const draw = (ts) => {
                    if (_active !== 'sakura') return;
                    if (ts - _lastFrame < 33) { _rafId = requestAnimationFrame(draw); return; }
                    _lastFrame = ts;

                    c2d.clearRect(0, 0, W, H);

                    for (const p of petals) {
                        // Движение вниз + синусоидальное покачивание
                        p.y += p.speed;
                        p.x += Math.sin(ts * 0.001 + p.wobblePhase) * p.wobbleAmp * 0.3 + p.drift * 0.15;
                        p.rot += p.rotSpeed;

                        // Сброс за нижней границей
                        if (p.y > H + 20) {
                            p.y = -20;
                            p.x = Math.random() * W;
                        }
                        // Заворачивание по горизонтали
                        if (p.x < -20) p.x = W + 20;
                        if (p.x > W + 20) p.x = -20;

                        // Рисуем лепесток (пятилепестковая форма — упрощённо эллипс)
                        c2d.save();
                        c2d.translate(p.x, p.y);
                        c2d.rotate(p.rot);

                        // Мягкое свечение
                        c2d.shadowColor = `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, .6)`;
                        c2d.shadowBlur = 8;

                        // Тело лепестка
                        const grad = c2d.createRadialGradient(0, 0, 0, 0, 0, p.size);
                        grad.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, ${p.lit + 8}%, ${p.alpha})`);
                        grad.addColorStop(0.7, `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, ${p.alpha * 0.85})`);
                        grad.addColorStop(1, `hsla(${p.hue - 15}, ${p.sat}%, ${p.lit - 10}%, ${p.alpha * 0.4})`);
                        c2d.fillStyle = grad;
                        c2d.beginPath();
                        c2d.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
                        c2d.fill();

                        // Маленькая "прожилка"
                        c2d.shadowBlur = 0;
                        c2d.strokeStyle = `hsla(${p.hue}, ${p.sat}%, 95%, ${p.alpha * 0.35})`;
                        c2d.lineWidth = 0.6;
                        c2d.beginPath();
                        c2d.moveTo(-p.size * 0.6, 0);
                        c2d.lineTo(p.size * 0.6, 0);
                        c2d.stroke();

                        c2d.restore();
                    }

                    _rafId = requestAnimationFrame(draw);
                };
                _rafId = requestAnimationFrame(draw);

                // Периодический "порыв ветра" — усиливает горизонтальный дрейф
                _intervalId = setInterval(() => {
                    if (_active !== 'sakura') return;
                    const gust = (Math.random() * 2 - 1) * 3;
                    for (const p of petals) p.drift = gust * (0.5 + Math.random());
                    setTimeout(() => {
                        for (const p of petals) p.drift *= 0.3;
                    }, 1500 + Math.random() * 1500);
                }, 6000);
            },

            // ============================================================
            //  STARFIELD — параллакс-звёзды + мерцание + туманность
            // ============================================================
            _startStarfield() {
                const root = document.getElementById('fquest-ui');
                if (!root) return;

                const canvas = this._makeCanvas('fq-starfield', 1.0);
                if (!canvas) return;
                const c2d = canvas.getContext('2d');

                let W = root.clientWidth, H = root.clientHeight;
                this._onResize = (w, h) => { W = w; H = h; };

                // 3 слоя звёзд с разной глубиной
                const layers = [
                    { count: 90, depth: 0.4, sizeMin: 0.3, sizeMax: 0.8, alpha: 0.55 },   // далёкие
                    { count: 50, depth: 0.7, sizeMin: 0.6, sizeMax: 1.3, alpha: 0.8  },   // средние
                    { count: 22, depth: 1.0, sizeMin: 0.9, sizeMax: 2.0, alpha: 1.0  },   // близкие
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
                            hue: 200 + Math.random() * 60, // синеватые + немного фиолетовых
                            vx: (0.02 + Math.random() * 0.04) * L.depth,
                            vy: (0.008 + Math.random() * 0.015) * L.depth,
                        });
                    }
                }

                // Туманность — 3 больших мягких пятна в дальнем слое
                const nebulas = [
                    { ox: 0.25, oy: 0.35, r: 0.7, hue: 250, alpha: 0.10 },
                    { ox: 0.75, oy: 0.55, r: 0.6, hue: 210, alpha: 0.08 },
                    { ox: 0.5,  oy: 0.85, r: 0.65, hue: 300, alpha: 0.07 },
                ];

                // Стрелка параллакса — следует за курсором
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

                    // Параллакс-смещение по курсору
                    const px = (mouseX - 0.5) * -30;
                    const py = (mouseY - 0.5) * -30;

                    // === Туманности ===
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

                    // === Звёзды ===
                    for (const s of stars) {
                        // Медленный дрейф вправо-вниз
                        s.x += s.vx;
                        s.y += s.vy;
                        if (s.x > W + 4) s.x = -4;
                        if (s.y > H + 4) s.y = -4;

                        // Мерцание
                        const twinkle = 0.7 + Math.sin(elapsed * s.twinkleSpeed + s.twinklePhase) * 0.3;
                        const a = s.baseAlpha * twinkle;

                        // Параллакс-сдвиг по глубине
                        const dx = s.x + px * s.depth;
                        const dy = s.y + py * s.depth;

                        // Для крупных звёзд — свечение
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
                    c2d.globalCompositeOperation = 'source-over';
                    _rafId = requestAnimationFrame(draw);
                };
                _rafId = requestAnimationFrame(draw);
            },

            // ============================================================
            //  AURORA WAVES — северное сияние волнами
            // ============================================================
            _startAuroraWaves() {
                const root = document.getElementById('fquest-ui');
                if (!root) return;

                const canvas = this._makeCanvas('fq-aurora-canvas', 0.85, 'screen');
                if (!canvas) return;
                const c2d = canvas.getContext('2d');

                let W = root.clientWidth, H = root.clientHeight;
                this._onResize = (w, h) => { W = w; H = h; };

                // 4 "ленты" северного сияния
                const ribbons = [
                    { y: 0.25, hue: 150, sat: 90, lit: 55, alpha: 0.55, amp: 0.10, freq: 0.008, speed: 0.00030, width: 0.30, phase: 0    },
                    { y: 0.40, hue: 180, sat: 85, lit: 60, alpha: 0.45, amp: 0.08, freq: 0.011, speed: 0.00022, width: 0.28, phase: 1.5  },
                    { y: 0.55, hue: 200, sat: 80, lit: 65, alpha: 0.40, amp: 0.12, freq: 0.007, speed: 0.00027, width: 0.32, phase: 3.0  },
                    { y: 0.70, hue: 280, sat: 75, lit: 65, alpha: 0.32, amp: 0.09, freq: 0.010, speed: 0.00020, width: 0.26, phase: 4.7  },
                ];

                const t0 = performance.now();
                const draw = (ts) => {
                    if (_active !== 'aurora-waves') return;
                    if (ts - _lastFrame < 33) { _rafId = requestAnimationFrame(draw); return; }
                    _lastFrame = ts;
                    const elapsed = ts - t0;

                    c2d.clearRect(0, 0, W, H);
                    c2d.globalCompositeOperation = 'lighter';

                    for (const rb of ribbons) {
                        const baseY = H * rb.y;
                        const bandH = H * rb.width;

                        // Строим "ленту" как набор вертикальных столбцов с синусоидальным отклонением
                        const step = 8; // px
                        const points = [];
                        for (let x = -step; x <= W + step; x += step) {
                            const wave1 = Math.sin(x * rb.freq + elapsed * rb.speed * 1000 + rb.phase) * H * rb.amp;
                            const wave2 = Math.cos(x * rb.freq * 2.3 + elapsed * rb.speed * 1700) * H * rb.amp * 0.4;
                            const wave3 = Math.sin(x * rb.freq * 0.5 - elapsed * rb.speed * 700) * H * rb.amp * 0.6;
                            points.push({ x, y: baseY + wave1 + wave2 + wave3 });
                        }

                        // Рисуем вертикальные градиентные столбцы
                        for (let i = 0; i < points.length - 1; i++) {
                            const p = points[i];
                            // Верхняя часть ярче, к низу затухание
                            const grad = c2d.createLinearGradient(p.x, p.y - bandH * 0.3, p.x, p.y + bandH);
                            grad.addColorStop(0,    `hsla(${rb.hue}, ${rb.sat}%, ${rb.lit}%, 0)`);
                            grad.addColorStop(0.2,  `hsla(${rb.hue}, ${rb.sat}%, ${rb.lit}%, ${rb.alpha * 0.9})`);
                            grad.addColorStop(0.55, `hsla(${rb.hue + 15}, ${rb.sat}%, ${rb.lit - 10}%, ${rb.alpha * 0.55})`);
                            grad.addColorStop(1,    `hsla(${rb.hue + 30}, ${rb.sat}%, ${rb.lit - 20}%, 0)`);

                            c2d.fillStyle = grad;
                            c2d.fillRect(p.x, p.y - bandH * 0.3, step + 1, bandH * 1.3);
                        }

                        // Дополнительное свечение — тонкая яркая линия в середине
                        c2d.strokeStyle = `hsla(${rb.hue}, 100%, 75%, ${rb.alpha * 0.5})`;
                        c2d.lineWidth = 2;
                        c2d.shadowColor = `hsla(${rb.hue}, 100%, 70%, .9)`;
                        c2d.shadowBlur = 12;
                        c2d.beginPath();
                        points.forEach((p, i) => {
                            if (i === 0) c2d.moveTo(p.x, p.y);
                            else c2d.lineTo(p.x, p.y);
                        });
                        c2d.stroke();
                        c2d.shadowBlur = 0;
                    }

                    c2d.globalCompositeOperation = 'source-over';
                    _rafId = requestAnimationFrame(draw);
                };
                _rafId = requestAnimationFrame(draw);
            },
        };
    },
};