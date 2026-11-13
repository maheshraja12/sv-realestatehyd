/**
 * SV REAL ESTATES HYDERABAD — 3D LIQUID GLASS LAUNCH ENGINE
 * Cinematic 3D Glass Sphere, Waterdrop Refraction, Drift-Free Countdown & Grand Reveal
 */

(function () {
    'use strict';

    window.SVLaunchOverlay = {
        state: 'ready', // 'ready' | 'counting' | 'zero' | 'live' | 'closed'
        liquidEffects: true,
        timer: null,
        currentCount: 10,
        startTime: null,
        waterdrops: null,
        threeSphere: null,
        isPaused: false,

        init: function () {
            const overlay = document.getElementById('launchOverlay');
            if (!overlay) return;

            // 1. Authoritative Server-Driven Settings
            const isEnabled = overlay.getAttribute('data-enabled') === '1';
            const isAdminPreview = overlay.getAttribute('data-admin-preview') === '1';
            const mode = overlay.getAttribute('data-mode') || 'always';
            const fxConfig = overlay.getAttribute('data-liquid-effects');
            const alreadySeen = sessionStorage.getItem('sv_launch_seen') === '1';

            // If globally disabled and not an authorized admin preview, remove overlay
            if (!isEnabled && !isAdminPreview) {
                overlay.classList.remove('is-active');
                overlay.style.display = 'none';
                document.body.style.overflow = '';
                return;
            }

            // If session mode and visitor already saw the launch screen in this session (unless admin preview)
            if (!isAdminPreview && mode === 'session' && alreadySeen) {
                overlay.classList.remove('is-active');
                overlay.style.display = 'none';
                document.body.style.overflow = '';
                return;
            }

            // 2. Liquid Effects Configuration
            this.liquidEffects = fxConfig !== '0';
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                this.liquidEffects = false;
            }

            // 3. Initialize Visual Engines
            if (this.liquidEffects) {
                this.initWaterdrops();
                this.initThreeSphere();
            }

            // 4. Bind Events & Lifecycle Listeners
            this.bindEvents();

            // 5. Open & Lock Scrolling
            this.open();
        },

        bindEvents: function () {
            const self = this;

            // Start Countdown button
            const btnStart = document.getElementById('btnLaunchStart');
            if (btnStart) {
                btnStart.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.startCountdown();
                });
            }

            // Explore Website button (Stage 3)
            const btnExplore = document.getElementById('btnLaunchExplore');
            if (btnExplore) {
                btnExplore.addEventListener('click', function (e) {
                    e.preventDefault();
                    self.close();
                });
            }

            // Delegate any .js-launch-explore triggers
            document.addEventListener('click', function (e) {
                const target = e.target.closest('.js-launch-explore');
                if (target) {
                    e.preventDefault();
                    self.close();
                }
            });

            // Pause animations when browser tab is inactive / hidden
            document.addEventListener('visibilitychange', function () {
                if (document.hidden) {
                    self.pause();
                } else {
                    self.resume();
                }
            });
        },

        open: function () {
            const overlay = document.getElementById('launchOverlay');
            if (!overlay) return;
            overlay.classList.remove('is-closing');
            overlay.classList.add('is-active');
            overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            if (this.waterdrops) this.waterdrops.start();
            if (this.threeSphere) this.threeSphere.start();
        },

        pause: function () {
            this.isPaused = true;
            if (this.waterdrops) this.waterdrops.stop();
            if (this.threeSphere) this.threeSphere.stop();
        },

        resume: function () {
            this.isPaused = false;
            if (this.state !== 'closed') {
                if (this.waterdrops) this.waterdrops.start();
                if (this.threeSphere) this.threeSphere.start();
            }
        },

        close: function () {
            if (this.state === 'closed') return;
            this.state = 'closed';

            const overlay = document.getElementById('launchOverlay');
            if (!overlay) return;

            // Clear any active timer
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }

            // Mark session as seen
            const mode = overlay.getAttribute('data-mode') || 'always';
            if (mode === 'session') {
                sessionStorage.setItem('sv_launch_seen', '1');
            }

            // Smooth exit animation
            overlay.classList.add('is-closing');

            setTimeout(() => {
                overlay.classList.remove('is-active', 'is-closing');
                overlay.style.display = 'none';
                document.body.style.overflow = '';
                this.dispose();
            }, 850);
        },

        dispose: function () {
            if (this.waterdrops) {
                this.waterdrops.stop();
                this.waterdrops = null;
            }
            if (this.threeSphere) {
                this.threeSphere.dispose();
                this.threeSphere = null;
            }
        },

        // ── Stage 2: Drift-Free Elapsed-Time Countdown ──
        startCountdown: function () {
            // Guard against multiple timers
            if (this.state === 'counting' || this.state === 'zero' || this.state === 'live') return;
            this.state = 'counting';

            const welcomeStage = document.getElementById('launchWelcomeStage');
            const idleMonogram = document.getElementById('orbIdleMonogram');
            const numberDisplay = document.getElementById('orbNumberDisplay');
            const liquidRipple = document.getElementById('orbLiquidRipple');

            // Smoothly collapse Stage 1 text and center countdown orb
            if (welcomeStage) welcomeStage.classList.add('is-counting');
            if (idleMonogram) idleMonogram.style.display = 'none';
            if (numberDisplay) {
                numberDisplay.style.display = 'block';
                numberDisplay.textContent = '10';
            }

            this.currentCount = 10;
            this.startTime = performance.now();
            this.tickCount(10, numberDisplay, liquidRipple);

            // Elapsed-time interval to prevent timer drift
            const self = this;
            const tickDuration = 1000;

            this.timer = setInterval(function () {
                if (self.state !== 'counting') {
                    clearInterval(self.timer);
                    self.timer = null;
                    return;
                }

                const elapsed = performance.now() - self.startTime;
                const remaining = 10 - Math.floor(elapsed / tickDuration);

                if (remaining !== self.currentCount) {
                    if (remaining > 0) {
                        self.currentCount = remaining;
                        self.tickCount(self.currentCount, numberDisplay, liquidRipple);
                    } else {
                        clearInterval(self.timer);
                        self.timer = null;
                        self.triggerZeroTransition();
                    }
                }
            }, 30);
        },

        tickCount: function (count, numberDisplay, liquidRipple) {
            // Update Number Display with water bubble-pop animation
            if (numberDisplay) {
                numberDisplay.textContent = count;
                numberDisplay.classList.remove('number-bubble-pop');
                void numberDisplay.offsetWidth; // Force reflow
                numberDisplay.classList.add('number-bubble-pop');
            }

            // Liquid Ripple Pulse
            if (liquidRipple) {
                liquidRipple.classList.remove('pulse');
                void liquidRipple.offsetWidth;
                liquidRipple.classList.add('pulse');
            }

            // Trigger Three.js Glass Sphere Wave
            if (this.threeSphere) {
                this.threeSphere.triggerWave(1.2);
            }

            // Waterdrop Canvas Shockwave
            if (this.waterdrops) {
                this.waterdrops.createShockwave(window.innerWidth / 2, window.innerHeight / 2, 70);
            }

            // Screen reader accessibility announcement
            const sr = document.getElementById('launchSrAnnouncements');
            if (sr) {
                sr.textContent = 'Launch Countdown ' + count;
            }
        },

        // ── Stage 3: Grand Launch Reveal At Zero ──
        triggerZeroTransition: function () {
            this.state = 'zero';

            const welcomeStage = document.getElementById('launchWelcomeStage');
            const liveStage = document.getElementById('launchLiveStage');
            const shockwave = document.getElementById('launchZeroShockwave');
            const sr = document.getElementById('launchSrAnnouncements');

            // Trigger cinematic expanding ripple shockwave
            if (shockwave) {
                shockwave.classList.add('trigger');
            }

            // Waterdrop burst splash
            if (this.waterdrops) {
                this.waterdrops.burstSplash(window.innerWidth / 2, window.innerHeight / 2);
            }

            // Three.js surge disturbance
            if (this.threeSphere) {
                this.threeSphere.triggerWave(3.0);
            }

            // Screen reader announcement
            if (sr) {
                sr.textContent = 'We are live! Your next chapter begins here.';
            }

            // Seamless transition to Stage 3 celebration
            setTimeout(() => {
                if (welcomeStage) {
                    welcomeStage.style.display = 'none';
                }
                if (liveStage) {
                    liveStage.style.display = 'block';
                    void liveStage.offsetWidth;
                    liveStage.classList.add('is-visible');
                }
                this.state = 'live';
            }, 600);
        },

        // ── Waterdrop Physics Simulation (2D Canvas) ──
        initWaterdrops: function () {
            const canvas = document.getElementById('launchWaterdropCanvas');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            let animId = null;
            let width = 0;
            let height = 0;
            const isMobile = window.innerWidth < 768;

            const staticDrops = [];
            const slidingDrops = [];
            const shockwaves = [];
            const maxStatic = isMobile ? 18 : 36;
            const maxSliding = isMobile ? 4 : 8;

            function resize() {
                width = canvas.width = window.innerWidth;
                height = canvas.height = window.innerHeight;
                initStaticDrops();
            }

            function initStaticDrops() {
                staticDrops.length = 0;
                for (let i = 0; i < maxStatic; i++) {
                    staticDrops.push({
                        x: Math.random() * width,
                        y: Math.random() * height,
                        r: 1 + Math.random() * 3.2,
                        opacity: 0.3 + Math.random() * 0.4
                    });
                }
            }

            function spawnSlidingDrop(x, y, r) {
                slidingDrops.push({
                    x: x !== undefined ? x : Math.random() * width,
                    y: y !== undefined ? y : -10,
                    r: r !== undefined ? r : 3 + Math.random() * 2.8,
                    vy: 0.8 + Math.random() * 1.5,
                    trail: [],
                    maxTrail: 12
                });
            }

            window.addEventListener('resize', resize);
            resize();

            // Populate initial sliding drops
            for (let i = 0; i < (isMobile ? 3 : 5); i++) {
                spawnSlidingDrop(Math.random() * width, Math.random() * height * 0.7);
            }

            function render() {
                ctx.clearRect(0, 0, width, height);

                // 1. Static Ambient Drops
                for (let i = 0; i < staticDrops.length; i++) {
                    const d = staticDrops[i];
                    drawDroplet(ctx, d.x, d.y, d.r, d.opacity);
                }

                // 2. Sliding Drops with Trails
                for (let i = slidingDrops.length - 1; i >= 0; i--) {
                    const s = slidingDrops[i];

                    s.trail.push({ x: s.x, y: s.y, r: s.r * 0.45, alpha: 0.28 });
                    if (s.trail.length > s.maxTrail) s.trail.shift();

                    for (let t = 0; t < s.trail.length; t++) {
                        const tr = s.trail[t];
                        tr.alpha *= 0.93;
                        drawDroplet(ctx, tr.x, tr.y, tr.r, tr.alpha);
                    }

                    s.y += s.vy;
                    s.x += Math.sin(s.y * 0.05) * 0.3;

                    drawDroplet(ctx, s.x, s.y, s.r, 0.85);

                    // Absorb static drops on collision
                    for (let j = 0; j < staticDrops.length; j++) {
                        const sd = staticDrops[j];
                        const dx = sd.x - s.x;
                        const dy = sd.y - s.y;
                        if (Math.sqrt(dx * dx + dy * dy) < s.r + sd.r) {
                            s.r = Math.min(s.r + 0.12, 7.0);
                            s.vy = Math.min(s.vy + 0.06, 4.0);
                            staticDrops.splice(j, 1);
                            break;
                        }
                    }

                    if (s.y > height + 20) {
                        slidingDrops.splice(i, 1);
                        if (slidingDrops.length < maxSliding) {
                            spawnSlidingDrop();
                        }
                    }
                }

                // 3. Liquid Shockwaves
                for (let i = shockwaves.length - 1; i >= 0; i--) {
                    const sw = shockwaves[i];
                    sw.r += sw.speed;
                    sw.alpha *= 0.94;

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(212, 175, 55, ${sw.alpha * 0.55})`;
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
                grad.addColorStop(0.35, 'rgba(212, 175, 55, 0.22)');
                grad.addColorStop(0.7, 'rgba(15, 20, 32, 0.4)');
                grad.addColorStop(1, 'rgba(212, 175, 55, 0.55)');
                c.fillStyle = grad;
                c.fill();

                // Specular glint
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
                        speed: 5.5,
                        alpha: 0.85,
                        width: 2.2
                    });
                },
                burstSplash: function (x, y) {
                    for (let i = 0; i < (isMobile ? 12 : 20); i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 30 + Math.random() * 180;
                        slidingDrops.push({
                            x: x + Math.cos(angle) * dist,
                            y: y + Math.sin(angle) * dist,
                            r: 2 + Math.random() * 3,
                            vy: 1.2 + Math.random() * 2,
                            trail: [],
                            maxTrail: 8
                        });
                    }
                    this.createShockwave(x, y, 350);
                }
            };
        },

        // ── Three.js 3D Liquid Glass Sphere Engine ──
        initThreeSphere: function () {
            if (typeof THREE === 'undefined') return;

            const container = document.getElementById('launchOrbThreeContainer') || document.getElementById('launchWebglCanvas');
            if (!container) return;

            let scene, camera, renderer, sphereMesh, liquidMesh;
            let sphereGeo, glassMat, liquidGeo, liquidMat;
            let animId = null;
            let waveIntensity = 0;

            const width = container.clientWidth || 240;
            const height = container.clientHeight || 240;

            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
            camera.position.z = 4.2;

            try {
                renderer = new THREE.WebGLRenderer({
                    alpha: true,
                    antialias: true,
                    powerPreference: 'high-performance'
                });
            } catch (err) {
                console.warn('WebGL initialization failed, falling back to CSS glass orb:', err);
                return;
            }

            renderer.setSize(width, height);
            const pixelRatio = Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 2);
            renderer.setPixelRatio(pixelRatio);
            container.appendChild(renderer.domElement);

            // 1. Lighting (Champagne + Luxury Warm Gold)
            const ambientLight = new THREE.AmbientLight(0xfff8ee, 0.85);
            scene.add(ambientLight);

            const goldPointLight = new THREE.PointLight(0xd4af37, 2.6, 20);
            goldPointLight.position.set(3, 4, 3);
            scene.add(goldPointLight);

            const rimPointLight = new THREE.PointLight(0xffffff, 2.0, 20);
            rimPointLight.position.set(-3, -3, 2.5);
            scene.add(rimPointLight);

            // 2. Outer Transparent Glass Sphere
            sphereGeo = new THREE.SphereGeometry(1.22, 48, 48);
            glassMat = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.38,
                roughness: 0.05,
                metalness: 0.08,
                transmission: 0.94,
                ior: 1.48,
                reflectivity: 0.9,
                clearcoat: 1.0,
                clearcoatRoughness: 0.04,
                wireframe: false
            });
            sphereMesh = new THREE.Mesh(sphereGeo, glassMat);
            scene.add(sphereMesh);

            // 3. Inner Liquid Core (Gold Wireframe Grid)
            liquidGeo = new THREE.SphereGeometry(1.0, 36, 36);
            liquidMat = new THREE.MeshStandardMaterial({
                color: 0xd4af37,
                transparent: true,
                opacity: 0.22,
                roughness: 0.25,
                metalness: 0.85,
                wireframe: true
            });
            liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
            scene.add(liquidMesh);

            // Resize handler
            const onResize = function () {
                if (!container || !renderer || !camera) return;
                const w = container.clientWidth || 240;
                const h = container.clientHeight || 240;
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
            };
            window.addEventListener('resize', onResize);

            let clock = new THREE.Clock();

            function animate() {
                const elapsed = clock.getElapsedTime();

                // Gentle floating & idle rotation
                sphereMesh.rotation.y = elapsed * 0.15;
                sphereMesh.rotation.x = Math.sin(elapsed * 0.25) * 0.08;
                sphereMesh.position.y = Math.sin(elapsed * 0.8) * 0.05;

                // Liquid core counter-rotation
                liquidMesh.rotation.y = -elapsed * 0.28;
                liquidMesh.rotation.z = Math.cos(elapsed * 0.2) * 0.12;

                // Dynamic liquid wave surge on countdown ticks
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
                },
                dispose: function () {
                    this.stop();
                    window.removeEventListener('resize', onResize);
                    if (sphereGeo) sphereGeo.dispose();
                    if (glassMat) glassMat.dispose();
                    if (liquidGeo) liquidGeo.dispose();
                    if (liquidMat) liquidMat.dispose();
                    if (renderer) {
                        renderer.dispose();
                        if (renderer.domElement && renderer.domElement.parentNode) {
                            renderer.domElement.parentNode.removeChild(renderer.domElement);
                        }
                    }
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
