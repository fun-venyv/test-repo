/* ============================================================
 *  FQuest · modules/themes.js
 *  JS-движок для живых тем: Matrix rain, Cyberpunk glitch, Neon pulse
 * ============================================================ */

module.exports = {
    createThemes(ctx) {
        const { RUNTIME, platform } = ctx;

        let _active = null;         // имя активной JS-темы
        let _rafId = null;          // requestAnimationFrame
        let _canvas = null;         // для matrix
        let _intervalId = null;     // для cyberpunk/neon
        let _lastFrame = 0;         // для троттлинга

        return {
            /**
             * Применяет JS-анимацию для темы. Если тема не требует JS — очищает.
             * @param {string} theme
             */
            apply(theme) {
                this.clear();

                _active = theme;

                switch (theme) {
                    case 'matrix':
                        this._startMatrix();
                        break;
                    case 'cyberpunk':
                        this._startCyberpunk();
                        break;
                    case 'neon-nights':
                        this._startNeon();
                        break;
                    // dark / light / sakura / aurora-glass — только CSS
                    default:
                        break;
                }
            },

            clear() {
                if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
                if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
                if (_canvas && _canvas.parentElement) _canvas.remove();
                _canvas = null;
                _active = null;
            },

            getActive() { return _active; },

            // ============================================================
            //  MATRIX RAIN
            // ============================================================
            _startMatrix() {
                const root = document.getElementById('fquest-ui');
                if (!root) return;

                _canvas = document.createElement('canvas');
                _canvas.id = 'fq-matrix-canvas';
                _canvas.style.cssText = `
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    z-index: 0;
                    opacity: 0.55;
                    mix-blend-mode: screen;
                `;
                root.insertBefore(_canvas, root.firstChild);

                const ctx2d = _canvas.getContext('2d');
                const FONT_SIZE = 14;
                const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

                let cols = 0;
                let drops = [];
                let dpr = window.devicePixelRatio || 1;

                const resize = () => {
                    const w = root.clientWidth;
                    const h = root.clientHeight;
                    _canvas.width = w * dpr;
                    _canvas.height = h * dpr;
                    _canvas.style.width = w + 'px';
                    _canvas.style.height = h + 'px';
                    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
                    cols = Math.ceil(w / FONT_SIZE);
                    drops = new Array(cols).fill(0).map(() => Math.random() * -100);
                };
                resize();

                const ro = new ResizeObserver(resize);
                ro.observe(root);
                this._matrixObserver = ro;

                const draw = (ts) => {
                    if (ts - _lastFrame < 50) {
                        _rafId = requestAnimationFrame(draw);
                        return;
                    }
                    _lastFrame = ts;

                    const w = root.clientWidth;
                    const h = root.clientHeight;

                    // Плавное затухание
                    ctx2d.fillStyle = 'rgba(6, 10, 6, 0.08)';
                    ctx2d.fillRect(0, 0, w, h);

                    ctx2d.font = `${FONT_SIZE}px 'JetBrains Mono', monospace`;
                    ctx2d.textBaseline = 'top';

                    for (let i = 0; i < cols; i++) {
                        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
                        const y = drops[i] * FONT_SIZE;
                        const x = i * FONT_SIZE;

                        // Свежие — яркие, старые — тёмные
                        const alpha = Math.random();
                        if (alpha > 0.95) {
                            ctx2d.fillStyle = '#CFFFE0';
                            ctx2d.shadowColor = '#7CFFB2';
                            ctx2d.shadowBlur = 8;
                        } else if (alpha > 0.6) {
                            ctx2d.fillStyle = '#7CFFB2';
                            ctx2d.shadowColor = '#7CFFB2';
                            ctx2d.shadowBlur = 4;
                        } else {
                            ctx2d.fillStyle = '#3D8B5C';
                            ctx2d.shadowBlur = 0;
                        }
                        ctx2d.fillText(ch, x, y);

                        if (y > h && Math.random() > 0.975) drops[i] = 0;
                        drops[i]++;
                    }

                    _rafId = requestAnimationFrame(draw);
                };

                _rafId = requestAnimationFrame(draw);
            },

            // ============================================================
            //  CYBERPUNK GLITCH
            // ============================================================
            _startCyberpunk() {
                const root = document.getElementById('fquest-ui');
                if (!root) return;

                // Впрыскиваем случайные "глитч"-вспышки
                _intervalId = setInterval(() => {
                    if (Math.random() > 0.7) {
                        const target = root.querySelector('#fquest-head') || root;
                        target.style.textShadow = `${(Math.random() * 4 - 2).toFixed(1)}px 0 #FF2C9C, ${(Math.random() * 4 - 2).toFixed(1)}px 0 #00FFF0`;
                        target.style.transform = `translate(${(Math.random() * 2 - 1).toFixed(1)}px, ${(Math.random() * 2 - 1).toFixed(1)}px)`;
                        setTimeout(() => {
                            target.style.textShadow = '';
                            target.style.transform = '';
                        }, 80 + Math.random() * 120);
                    }
                }, 600);

                // Пульсирующая граница
                const root2 = root;
                let t = 0;
                const pulse = () => {
                    if (!_active) return;
                    t += 0.05;
                    const hue = 300 + Math.sin(t) * 30;      // розовый-пурпурный
                    const glow = 12 + Math.sin(t * 1.3) * 6;
                    root2.style.boxShadow = `0 24px 80px rgba(0,0,0,.85), 0 0 ${glow}px hsl(${hue}, 100%, 60%), 0 0 0 1px hsla(${hue}, 100%, 60%, .4) inset`;
                    _rafId = requestAnimationFrame(pulse);
                };
                _rafId = requestAnimationFrame(pulse);
            },

            // ============================================================
            //  NEON NIGHTS
            // ============================================================
            _startNeon() {
                const root = document.getElementById('fquest-ui');
                if (!root) return;

                let t = 0;
                const drift = () => {
                    if (!_active) return;
                    t += 0.008;

                    // Плавно меняем акцентный цвет по HSL
                    const hue = (280 + Math.sin(t) * 60 + 360) % 360;
                    document.documentElement.style.setProperty('--fq-accent', `hsl(${hue.toFixed(0)}, 90%, 65%)`);

                    // И фон окна чуть-чуть
                    const bgHue = (240 + Math.cos(t * 0.7) * 40 + 360) % 360;
                    root.style.backgroundImage = `radial-gradient(140% 70% at 50% 0%,
                        hsla(${bgHue.toFixed(0)}, 60%, 20%, .9),
                        hsla(${(bgHue + 60) % 360}, 50%, 10%, 1))`;

                    _rafId = requestAnimationFrame(drift);
                };
                _rafId = requestAnimationFrame(drift);
            },
        };
    },
};