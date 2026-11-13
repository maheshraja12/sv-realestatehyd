/**
 * SV REAL ESTATES HYDERABAD — 3D LIQUID GLASS & WATERDROP LAUNCH ENGINE
 * Interactive 3D Liquid Glass Orb, Waterdrop Physics, Refraction & Countdown
 */

(function () {
    'use strict';

    // ── Global Namespace ──
    window.SVLaunchOverlay = {
        state: 'ready', // 'ready' | 'counting' | 'zero' | 'live' | 'closed'
        liquidEffects: true,
        soundEnabled: true,
        timer: null,
        currentCount: 10,
        audioCtx: null,

        init: function () {
            const overlay = document.getElementById('launchOverlay');
            if (!overlay) return;

            // Check admin configuration
            const fxConfig = overlay.getAttribute('data-liquid-effects');
            this.liquidEffects = fxConfig !== '0';

            // Check reduced motion
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                this.liquidEffects = false;
            }

            // Setup Sound
            this.setupAudio();

            // Setup Canvas Waterdrop Simulation
            if (this.liquidEffects) {
                this.initWaterdrops();
                this.initThreeSphere();
            }

            // Setup Event Handlers
            this.bindEvents();

            // Check if should open automatically
            const urlParams = new URLSearchParams(window.location.search);
            const isManualPreview = urlParams.has('launch') || urlParams.has('preview_launch') || window.location.pathname === '/launch';
            const isEnabled = overlay.getAttribute('data-enabled') === '1';
            const mode = overlay.getAttribute('data-mode') || 'session';
            const alreadySeen = sessionStorage.getItem('sv_launch_seen') === '1';

            if (isManualPreview || (isEnabled && (mode === 'always' || !alreadySeen))) {
                this.open();
            }
        },

        // ── Audio Synthesizer (Web Audio API) ──
        setupAudio: function () {
            const self = this;
            const unlockAudio = function () {
                if (!self.audioCtx) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) {
                        self.audioCtx = new AudioContext();
                    }
                }
                if (self.audioCtx && self.audioCtx.state === 'suspended') {
                    self.audioCtx.resume();
                }
                document.removeEventListener('click', unlockAudio);
                document.removeEventListener('touchstart', unlockAudio);
            };
            document.addEventListener('click', unlockAudio, { once: true });
            document.addEventListener('touchstart', unlockAudio, { once: true });
        },

        playWaterdropChime: function (pitchMultiplier) {
            if (!this.soundEnabled || !this.audioCtx) return;
            try {
                const ctx = this.audioCtx;
                const now = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                const baseFreq = 950 * (pitchMultiplier || 1);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(baseFreq, now);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 0.08);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.25);

                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 0.36);
            } catch (e) {}
        },

        playZeroShockwaveSound: function () {
            if (!this.soundEnabled || !this.audioCtx) return;
            try {
                const ctx = this.audioCtx;
                const now = ctx.currentTime;

                // Sub bass swell
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(140, now);
                osc.frequency.exponentialRampToValueAtTime(45, now + 1.2);

                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 1.85);

                // High shimmer chime
                const chime = ctx.createOscillator();
                const chimeGain = ctx.createGain();
                chime.type = 'sine';
                chime.frequency.setValueAtTime(1600, now);
                chime.frequency.exponentialRampToValueAtTime(2400, now + 0.4);
                chime.frequency.exponentialRampToValueAtTime(1200, now + 1.5);

                chimeGain.gain.setValueAtTime(0.001, now);
                chimeGain.gain.linearRampToValueAtTime(0.18, now + 0.05);
                chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

                chime.connect(chimeGain);
                chimeGain.connect(ctx.destination);
                chime.start(now);
                chime.stop(now + 1.55);
            } catch (e) {}
        },

        // ── Open / Close State Controller ──
        open: function () {
            const overlay = document.getElementById('launchOverlay');
            if (!overlay) return;
            overlay.classList.remove('is-closing');
            overlay.classList.add('is-active');
            document.body.style.overflow = 'hidden';

            if (this.waterdrops) this.waterdrops.start();
            if (this.threeSphere) this.threeSphere.start();
        },

        close: function () {
            const overlay = document.getElementById('launchOverlay');
            if (!overlay) return;
            overlay.classList.add('is-closing');

            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }

            sessionStorage.setItem('sv_launch_seen', '1');

            setTimeout(() => {
                overlay.classList.remove('is-active', 'is-closing');
                document.body.style.overflow = '';
                if (this.waterdrops) this.waterdrops.stop();
                if (this.threeSphere) this.threeSphere.stop();
            }, 850);
        },

        // ── Countdown Lifecycle ──
        startCountdown: function () {
            if (this.state === 'counting') return;
            this.state = 'counting';

            const welcomeStage = document.getElementById('launchWelcomeStage');
            const countdownStage = document.getElementById('launchCountdownStage');
            const numberDisplay = document.getElementById('orbNumberDisplay');
            const idleMonogram = document.getElementById('orbIdleMonogram');
            const liquidRipple = document.getElementById('orbLiquidRipple');

            if (welcomeStage) welcomeStage.style.display = 'none';
            if (countdownStage) countdownStage.style.display = 'block';
            if (idleMonogram) idleMonogram.style.display = 'none';
            if (numberDisplay) numberDisplay.style.display = 'block';

            this.currentCount = 10;
            this.tickCount(numberDisplay, liquidRipple);

            this.timer = setInterval(() => {
                this.currentCount--;
                if (this.currentCount > 0) {
                    this.tickCount(numberDisplay, liquidRipple);
                } else {
                    clearInterval(this.timer);
                    this.timer = null;
                    this.triggerZeroTransition();
                }
            }, 1000);
        },

        tickCount: function (numberDisplay, liquidRipple) {
            if (!numberDisplay) return;

            // Update text with water bubble animation
            numberDisplay.textContent = this.currentCount;
            numberDisplay.classList.remove('number-bubble-pop');
            void numberDisplay.offsetWidth; // Trigger reflow
            numberDisplay.classList.add('number-bubble-pop');

            // Sphere liquid ripple
            if (liquidRipple) {
                liquidRipple.classList.remove('pulse');
                void liquidRipple.offsetWidth;
                liquidRipple.classList.add('pulse');
            }

            // 3D Three.js sphere wave disturbance
            if (this.threeSphere) {
                this.threeSphere.triggerWave(1.2);
            }

            // Waterdrop canvas disturbance
            if (this.waterdrops) {
                this.waterdrops.createShockwave(window.innerWidth / 2, window.innerHeight / 2, 70);
            }

            // Sound chime
            const pitchFactor = 0.9 + (10 - this.currentCount) * 0.04;
            this.playWaterdropChime(pitchFactor);
        },

        triggerZeroTransition: function () {
            this.state = 'zero';

            const numberDisplay = document.getElementById('orbNumberDisplay');
            const shockwave = document.getElementById('launchZeroShockwave');
            const orbStage = document.getElementById('launchOrbStage');
            const countdownStage = document.getElementById('launchCountdownStage');
            const liveStage = document.getElementById('launchLiveStage');

            if (numberDisplay) {
                numberDisplay.textContent = '0';
                numberDisplay.classList.remove('number-bubble-pop');
                void numberDisplay.offsetWidth;
                numberDisplay.classList.add('number-bubble-pop');
            }

            // Play shockwave audio
            this.playZeroShockwaveSound();

            // Massive shockwave ripple
            if (shockwave) {
                shockwave.classList.add('trigger');
            }

            if (this.threeSphere) {
                this.threeSphere.triggerWave(3.5);
            }

            if (this.waterdrops) {
                this.waterdrops.burstSplash(window.innerWidth / 2, window.innerHeight / 2);
            }

            // Reveal "WE ARE LIVE" celebration after ripple
            setTimeout(() => {
                this.state = 'live';
                if (countdownStage) countdownStage.style.display = 'none';
                if (orbStage) orbStage.style.display = 'none';
                if (liveStage) {
                    liveStage.classList.add('is-visible');
                }
            }, 850);
        },

        // ── Event Bindings ──
        bindEvents: function () {
            const self = this;

            // Start countdown button
            const startBtn = document.getElementById('btnLaunchStart');
            if (startBtn) {
                startBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.startCountdown();
                });
            }

            // Explore buttons (close overlay)
            const exploreBtns = document.querySelectorAll('.js-launch-explore');
            exploreBtns.forEach(btn => {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.close();
                });
            });

            // Close button (X)
            const closeBtn = document.getElementById('btnLaunchClose');
            if (closeBtn) {
                closeBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.close();
                });
            }

            // Sound toggle button
            const soundBtn = document.getElementById('btnLaunchSound');
            if (soundBtn) {
                soundBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.soundEnabled = !self.soundEnabled;
                    const icon = soundBtn.querySelector('i');
                    if (icon) {
                        icon.className = self.soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
                    }
                    soundBtn.title = self.soundEnabled ? 'Mute Sound' : 'Enable Sound';
                });
            }

            // FX Toggle button (independent liquid effects disable/enable)
            const fxBtn = document.getElementById('btnLaunchFxToggle');
            if (fxBtn) {
                fxBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.liquidEffects = !self.liquidEffects;
                    if (self.liquidEffects) {
                        fxBtn.classList.remove('fx-disabled');
                        fxBtn.innerHTML = '<i class="fas fa-magic"></i> FX: 3D Liquid';
                        if (self.waterdrops) self.waterdrops.start();
                        if (self.threeSphere) self.threeSphere.start();
                    } else {
                        fxBtn.classList.add('fx-disabled');
                        fxBtn.innerHTML = '<i class="fas fa-ban"></i> FX: Minimal';
                        if (self.waterdrops) self.waterdrops.stop();
                        if (self.threeSphere) self.threeSphere.stop();
                    }
                });
            }

            // Keyboard ESC
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') {
                    const overlay = document.getElementById('launchOverlay');
                    if (overlay && overlay.classList.contains('is-active')) {
                        self.close();
                    }
                }
            });
        },

        // ── 2D Canvas Waterdrop Simulation ──
        initWaterdrops: function () {
            const canvas = document.getElementById('launchWaterdropCanvas');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            let animId = null;
            let width, height;
            const staticDrops = [];
            const slidingDrops = [];
            const shockwaves = [];

            function resize() {
                width = canvas.width = window.innerWidth;
                height = canvas.height = window.innerHeight;
                initStaticDrops();
            }

            function initStaticDrops() {
                staticDrops.length = 0;
                const count = Math.floor((width * height) / 12000);
                for (let i = 0; i < count; i++) {
                    staticDrops.push({
                        x: Math.random() * width,
                        y: Math.random() * height,
                        r: 1 + Math.random() * 3.5,
                        opacity: 0.35 + Math.random() * 0.45
                    });
                }
            }

            function spawnSlidingDrop(x, y, r) {
                slidingDrops.push({
                    x: x !== undefined ? x : Math.random() * width,
                    y: y !== undefined ? y : -10,
                    r: r !== undefined ? r : 3 + Math.random() * 3,
                    vy: 0.8 + Math.random() * 1.6,
                    vx: 0,
                    trail: [],
                    maxTrail: 16
                });
            }

            window.addEventListener('resize', resize);
            resize();

            // Populate initial sliding drops
            for (let i = 0; i < 6; i++) {
                spawnSlidingDrop(Math.random() * width, Math.random() * height * 0.7);
            }

            // Mouse / touch interaction
            canvas.addEventListener('mousemove', function (e) {
                if (Math.random() < 0.25) {
                    spawnSlidingDrop(e.clientX + (Math.random() - 0.5) * 30, e.clientY, 3.5);
                }
            });

            function render() {
                ctx.clearRect(0, 0, width, height);

                // 1. Render Static Drops
                for (let i = 0; i < staticDrops.length; i++) {
                    const d = staticDrops[i];
                    drawDroplet(ctx, d.x, d.y, d.r, d.opacity);
                }

                // 2. Render Sliding Drops with trails
                for (let i = slidingDrops.length - 1; i >= 0; i--) {
                    const s = slidingDrops[i];

                    // Trail
                    s.trail.push({ x: s.x, y: s.y, r: s.r * 0.45, alpha: 0.3 });
                    if (s.trail.length > s.maxTrail) s.trail.shift();

                    for (let t = 0; t < s.trail.length; t++) {
                        const tr = s.trail[t];
                        tr.alpha *= 0.94;
                        drawDroplet(ctx, tr.x, tr.y, tr.r, tr.alpha);
                    }

                    // Movement & slight organic sway
                    s.y += s.vy;
                    s.x += Math.sin(s.y * 0.05) * 0.35;

                    drawDroplet(ctx, s.x, s.y, s.r, 0.85);

                    // Absorb static drops
                    for (let j = 0; j < staticDrops.length; j++) {
                        const sd = staticDrops[j];
                        const dx = sd.x - s.x;
                        const dy = sd.y - s.y;
                        if (Math.sqrt(dx * dx + dy * dy) < s.r + sd.r) {
                            s.r = Math.min(s.r + 0.15, 7.5);
                            s.vy = Math.min(s.vy + 0.08, 4.5);
                            staticDrops.splice(j, 1);
                            break;
                        }
                    }

                    // Reset when off screen
                    if (s.y > height + 20) {
                        slidingDrops.splice(i, 1);
                        if (slidingDrops.length < 7) {
                            spawnSlidingDrop();
                        }
                    }
                }

                // 3. Render Shockwaves
                for (let i = shockwaves.length - 1; i >= 0; i--) {
                    const sw = shockwaves[i];
                    sw.r += sw.speed;
                    sw.alpha *= 0.94;

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(212, 175, 55, ${sw.alpha * 0.6})`;
                    ctx.lineWidth = sw.width;
                    ctx.stroke();
                    ctx.restore();

                    if (sw.alpha < 0.01) {
                        shockwaves.splice(i, 1);
                    }
                }

                animId = requestAnimationFrame(render);
            }

            function drawDroplet(c, x, y, r, alpha) {
                c.save();
                c.globalAlpha = Math.max(0, Math.min(1, alpha));

                // Ambient shadow underneath
                c.beginPath();
                c.arc(x + r * 0.25, y + r * 0.3, r, 0, Math.PI * 2);
                c.fillStyle = 'rgba(0, 0, 0, 0.45)';
                c.fill();

                // Liquid body with slight gold caustic tint
                c.beginPath();
                c.arc(x, y, r, 0, Math.PI * 2);
                const grad = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
                grad.addColorStop(0.3, 'rgba(212, 175, 55, 0.25)');
                grad.addColorStop(0.7, 'rgba(15, 20, 32, 0.4)');
                grad.addColorStop(1, 'rgba(212, 175, 55, 0.6)');
                c.fillStyle = grad;
                c.fill();

                // Specular top-left bright glint
                c.beginPath();
                c.arc(x - r * 0.32, y - r * 0.32, r * 0.35, 0, Math.PI * 2);
                c.fillStyle = 'rgba(255, 255, 255, 0.95)';
                c.fill();

                c.restore();
            }

            this.waterdrops = {
                start: function () {
                    if (!animId) render();
                },
                stop: function () {
                    if (animId) {
                        cancelAnimationFrame(animId);
                        animId = null;
                    }
                },
                createShockwave: function (x, y, maxRadius) {
                    shockwaves.push({
                        x: x,
                        y: y,
                        r: 10,
                        speed: 6,
                        alpha: 0.85,
                        width: 2.5
                    });
                },
                burstSplash: function (x, y) {
                    for (let i = 0; i < 24; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 40 + Math.random() * 220;
                        slidingDrops.push({
                            x: x + Math.cos(angle) * dist,
                            y: y + Math.sin(angle) * dist,
                            r: 2 + Math.random() * 3.5,
                            vy: 1.5 + Math.random() * 2.5,
                            vx: (Math.random() - 0.5) * 1.5,
                            trail: [],
                            maxTrail: 10
                        });
                    }
                    this.createShockwave(x, y, 400);
                }
            };
        },

        // ── Three.js 3D Liquid Glass Sphere ──
        initThreeSphere: function () {
            if (typeof THREE === 'undefined') return;

            const container = document.getElementById('launchWebglCanvas');
            if (!container) return;

            let scene, camera, renderer, sphereMesh, liquidMesh;
            let animId = null;
            let waveIntensity = 0;

            const width = window.innerWidth;
            const height = window.innerHeight;

            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
            camera.position.z = 5.2;

            renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            container.appendChild(renderer.domElement);

            // 1. Lighting (Luxury Gold + Studio Speculars)
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            scene.add(ambientLight);

            const goldPointLight = new THREE.PointLight(0xd4af37, 2.5, 20);
            goldPointLight.position.set(3, 4, 3);
            scene.add(goldPointLight);

            const rimPointLight = new THREE.PointLight(0xffffff, 1.8, 20);
            rimPointLight.position.set(-3, -3, 2);
            scene.add(rimPointLight);

            // 2. Outer Transparent Glass Sphere
            const sphereGeo = new THREE.SphereGeometry(1.25, 64, 64);
            const glassMat = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.35,
                roughness: 0.08,
                metalness: 0.1,
                transmission: 0.92,
                ior: 1.45,
                reflectivity: 0.85,
                clearcoat: 1.0,
                clearcoatRoughness: 0.05,
                wireframe: false
            });
            sphereMesh = new THREE.Mesh(sphereGeo, glassMat);
            scene.add(sphereMesh);

            // 3. Inner Swirling Golden Liquid Core
            const liquidGeo = new THREE.SphereGeometry(1.05, 48, 48);
            const liquidMat = new THREE.MeshStandardMaterial({
                color: 0xd4af37,
                transparent: true,
                opacity: 0.18,
                roughness: 0.3,
                metalness: 0.8,
                wireframe: true
            });
            liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
            scene.add(liquidMesh);

            // Window resize handler
            window.addEventListener('resize', function () {
                const w = window.innerWidth;
                const h = window.innerHeight;
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
            });

            // Gentle floating loop
            let clock = new THREE.Clock();

            function animate() {
                const elapsed = clock.getElapsedTime();

                // Idle organic rotation
                sphereMesh.rotation.y = elapsed * 0.15;
                sphereMesh.rotation.x = Math.sin(elapsed * 0.25) * 0.1;
                sphereMesh.position.y = Math.sin(elapsed * 0.8) * 0.06;

                // Liquid core counter-rotates and breathes
                liquidMesh.rotation.y = -elapsed * 0.3;
                liquidMesh.rotation.z = Math.cos(elapsed * 0.2) * 0.15;

                // Dynamic wave ripple surge
                if (waveIntensity > 0) {
                    const waveScale = 1.0 + Math.sin(elapsed * 25) * 0.08 * waveIntensity;
                    sphereMesh.scale.set(waveScale, waveScale, waveScale);
                    waveIntensity *= 0.92;
                    if (waveIntensity < 0.01) {
                        waveIntensity = 0;
                        sphereMesh.scale.set(1, 1, 1);
                    }
                }

                renderer.render(scene, camera);
                animId = requestAnimationFrame(animate);
            }

            this.threeSphere = {
                start: function () {
                    if (!animId) animate();
                },
                stop: function () {
                    if (animId) {
                        cancelAnimationFrame(animId);
                        animId = null;
                    }
                },
                triggerWave: function (intensity) {
                    waveIntensity = intensity || 1.0;
                }
            };
        }
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            window.SVLaunchOverlay.init();
        });
    } else {
        window.SVLaunchOverlay.init();
    }
})();
