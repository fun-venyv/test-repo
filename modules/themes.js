/* ============================================================
 *  FQuest · modules/themes.js
 *  JS-движок для живых тем:
 *    - cyberpunk      → глитч-пульсация
 *    - midnight       → дрейфующие туманные пятна
 *    - deep-ocean     → подводные лучи + пузырьки
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
                    case 'cyberpunk':  this._startCyberpunk(); break;
                    case 'midnight':   this._startMidnight(); break;
                    case 'deep-ocean': this._startDeepOcean(); break;
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
            //  CYBERPUNK (оставляем, ты не ругал)
            // ============================================================
            _startCyberpunk() {
                const root = document.getElementById('fquest-ui');
                if (!root) return;

                _intervalId = setInterval(() => {
                    if (!_active || _active !== 'cyberpunk') return;
                    if (Math.random() > 0.75) {
                        const target = root.querySelector('#fquest-head') || root;
                        const dx = (Math.random() * 2 - 1).toFixed(1);
                        target.style.textShadow = `${(Math.random() * 4 - 2).toFixed(1)}px 0 #FF2C9C, ${(Math.random() * 4 - 2).toFixed(1)}px 0 #00FFF0`;
                        target.style.transform = `translate(${dx}px, 0)`;
                        setTimeout(() => {
                            target.style.removeProperty('text-shadow');
                            target.style.removeProperty('transform');
                        }, 70 + Math.random() * 90);
                    }
                }, 700);

                let t = 0;
                const pulse = () => {
                    if (!_active || _active !== 'cyberpunk') return;
                    t += 0.05;
                    const hue = 300 + Math.sin(t) * 30;
                    const glow = 12 + Math.sin(t * 1.3) * 6;
                    root.style.boxShadow = `0 24px 80px rgba(0,0,0,.85), 0 0 ${glow}px hsl(${hue}, 100%, 60%), 0 0 0 1px hsla(${hue}, 100%, 60%, .4) inset`;
                    _rafId = requestAnimationFrame(pulse);
                };
                _rafId = requestAnimationFrame(pulse);
            },

            // ============================================================
            //  MIDNIGHT BLOSSOM — 3 дрейфующих туманных пятна
            // ============================================================
            _startMidnight() {
                const root = document.getElementById('fquest-ui');
                if (!root) return;

                // Создаём canvas для туманных пятен
                _canvas = document.createElement('canvas');
                _canvas.id = 'fq-midnight-canvas';
                _canvas.style.cssText = `
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    z-index: 0;
                    opacity: 0.9;
                `;
                root.insertBefore(_canvas, root.firstChild);

                const c2d = _canvas.getContext('2d', { alpha: true });
                const dpr = Math.min(window.devicePixelRatio || 1, 2);

                let W = 0, H = 0;
                const resize = () => {
                    if (!_canvas || !root) return;
                    W = root.clientWidth;
                    H = root.clientHeight;
                    _canvas.width = W * dpr;
                    _canvas.height = H * dpr;
                    _canvas.style.width = W + 'px';
                    _canvas.style.height = H + 'px';
                    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
                };
                resize();

                _resizeObserver = new ResizeObserver(resize);
                _resizeObserver.observe(root);

                // Определяем туманные пятна — 3 штуки с разными цветами/скоростями
                const blobs = [
                    { hue: 320, sat: 70, lit: 65, r: 0.55, ox: 0.25, oy: 0.3, vx: 0.00018, vy: 0.00011, phase: 0 },
                    { hue: 270, sat: 75, lit: 60, r: 0.5,  ox: 0.7,  oy: 0.65, vx: -0.00015, vy: 0.00013, phase: Math.PI * 0.6 },
                    { hue: 195, sat: 70, lit: 55, r: 0.45, ox: 0.55, oy: 0.85, vx: 0.00012, vy: -0.00014, phase: Math.PI * 1.3 },
                ];

                let t0 = performance.now();
                const draw = (ts) => {
                    if (!_canvas || !_active || _active !== 'midnight') return;
                    if (ts - _lastFrame < 33) {
                        _rafId = requestAnimationFrame(draw);
                        return;
                    }
                    _lastFrame = ts;

                    const elapsed = ts - t0;

                    // Очищаем полностью (canvas прозрачный, окно просвечивает)
                    c2d.clearRect(0, 0, W, H);

                    // Рисуем мягкие пятна
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
            //  DEEP OCEAN — подводные лучи + пузырьки
            // ============================================================
            _startDeepOcean() {
                const root = document.getElementById('fquest-ui');
                if (!root) return;

                _canvas = document.createElement('canvas');
                _canvas.id = 'fq-ocean-canvas';
                _canvas.style.cssText = `
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    z-index: 0;
                    opacity: 0.75;
                `;
                root.insertBefore(_canvas, root.firstChild);

                const c2d = _canvas.getContext('2d');
                const dpr = Math.min(window.devicePixelRatio || 1, 2);

                let W = 0, H = 0;
                const resize = () => {
                    if (!_canvas || !root) return;
                    W = root.clientWidth;
                    H = root.clientHeight;
                    _canvas.width = W * dpr;
                    _canvas.height = H * dpr;
                    _canvas.style.width = W + 'px';
                    _canvas.style.height = H + 'px';
                    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
                };
                resize();

                _resizeObserver = new ResizeObserver(resize);
                _resizeObserver.observe(root);

                // Лучи света (caustics) — 4 широких колонны, качаются
                const rays = [
                    { x: 0.15, w: 0.10, hue: 200, sat: 80, lit: 70, sway: 0.008, phase: 0 },
                    { x: 0.38, w: 0.08, hue: 195, sat: 75, lit: 65, sway: 0.010, phase: 1.6 },
                    { x: 0.62, w: 0.12, hue: 190, sat: 70, lit: 60, sway: 0.007, phase: 3.1 },
                    { x: 0.85, w: 0.09, hue: 205, sat: 80, lit: 70, sway: 0.009, phase: 4.2 },
                ];

                // Пузырьки
                const bubbles = [];
                const BUBBLE_COUNT = 22;
                for (let i = 0; i < BUBBLE_COUNT; i++) {
                    bubbles.push({
                        x: Math.random(),
                        y: Math.random(),
                        r: 1 + Math.random() * 2.5,
                        speed: 0.00008 + Math.random() * 0.00012,
                        wobblePhase: Math.random() * Math.PI * 2,
                        wobbleAmp: 0.008 + Math.random() * 0.012,
                        alpha: 0.15 + Math.random() * 0.35,
                    });
                }

                let t0 = performance.now();
                const draw = (ts) => {
                    if (!_canvas || !_active || _active !== 'deep-ocean') return;
                    if (ts - _lastFrame < 33) {
                        _rafId = requestAnimationFrame(draw);
                        return;
                    }
                    _lastFrame = ts;
                    const elapsed = ts - t0;

                    c2d.clearRect(0, 0, W, H);

                    // === Лучи (caustics) ===
                    c2d.globalCompositeOperation = 'lighter';
                    for (const ray of rays) {
                        const sway = Math.sin(elapsed * ray.sway + ray.phase) * 0.06;
                        const cx = W * (ray.x + sway);
                        const halfW = W * ray.w;

                        // Линейный градиент поперёк луча
                        const grad = c2d.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
                        grad.addColorStop(0,   `hsla(${ray.hue}, ${ray.sat}%, ${ray.lit}%, 0)`);
                        grad.addColorStop(0.5, `hsla(${ray.hue}, ${ray.sat}%, ${ray.lit}%, 0.22)`);
                        grad.addColorStop(1,   `hsla(${ray.hue}, ${ray.sat}%, ${ray.lit}%, 0)`);

                        // Вертикальный градиент — затухание к низу
                        c2d.fillStyle = grad;
                        c2d.globalAlpha = 0.7;
                        c2d.fillRect(cx - halfW, 0, halfW * 2, H);
                    }
                    c2d.globalAlpha = 1;

                    // === Пузырьки ===
                    for (const b of bubbles) {
                        // Двигаются вверх
                        b.y -= b.speed * (ts - t0 > 0 ? 16 : 0);
                        if (b.y < -0.05) {
                            b.y = 1.05;
                            b.x = Math.random();
                        }

                        const wobble = Math.sin(elapsed * 0.001 + b.wobblePhase) * b.wobbleAmp;
                        const cx = W * (b.x + wobble);
                        const cy = H * b.y;

                        // Тело пузырька
                        c2d.beginPath();
                        c2d.arc(cx, cy, b.r, 0, Math.PI * 2);
                        c2d.fillStyle = `hsla(195, 90%, 85%, ${b.alpha * 0.4})`;
                        c2d.fill();

                        // Блик сверху
                        c2d.beginPath();
                        c2d.arc(cx - b.r * 0.3, cy - b.r * 0.3, b.r * 0.4, 0, Math.PI * 2);
                        c2d.fillStyle = `hsla(200, 100%, 98%, ${b.alpha})`;
                        c2d.fill();

                        // Обводка
                        c2d.beginPath();
                        c2d.arc(cx, cy, b.r, 0, Math.PI * 2);
                        c2d.strokeStyle = `hsla(200, 90%, 80%, ${b.alpha * 0.5})`;
                        c2d.lineWidth = 0.8;
                        c2d.stroke();
                    }

                    c2d.globalCompositeOperation = 'source-over';
                    _rafId = requestAnimationFrame(draw);
                };
                _rafId = requestAnimationFrame(draw);
            },
        };
    },
};