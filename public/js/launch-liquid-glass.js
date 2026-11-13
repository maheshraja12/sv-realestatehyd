/**
 * SV REAL ESTATES HYDERABAD — PHOTOREALISTIC 3D LIQUID GLASS LAUNCH ENGINE
 * High-End Three.js PBR Glass Sphere, Real Procedural Liquid Core, 3D Water Droplets & Studio Lighting
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
        threeEngine: null,
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

            // If globally disabled and not an authorized admin preview, remove overlay immediately
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
                this.initThreeEngine();
            } else {
                overlay.classList.add('fallback-mode');
            }

            // 4. Bind Events & Lifecycle Listeners
            this.bindEvents();

            // 5. Open & Lock Scrolling
            this.open();
        },

        initThreeSphere: function () {
            return this.initThreeEngine();
        },

        initWaterdrops: function () {
            // 3D Water droplets are handled directly inside Three.js scene
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

            if (this.threeEngine) this.threeEngine.start();
        },

        pause: function () {
            this.isPaused = true;
            if (this.threeEngine) this.threeEngine.stop();
        },

        resume: function () {
            this.isPaused = false;
            if (this.state !== 'closed') {
                if (this.threeEngine) this.threeEngine.start();
            }
        },

        close: function () {
            if (this.state === 'closed') return;
            this.state = 'closed';

            const overlay = document.getElementById('launchOverlay');
            if (!overlay) return;

            // Clear active timer
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }

            // Mark session as seen if mode is session
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
            if (this.threeEngine) {
                this.threeEngine.dispose();
                this.threeEngine = null;
            }
        },

        // ── Stage 2: Drift-Free Elapsed-Time Countdown ──
        startCountdown: function () {
            if (this.state === 'counting' || this.state === 'zero' || this.state === 'live') return;
            this.state = 'counting';

            const welcomeStage = document.getElementById('launchWelcomeStage');
            const idleMonogram = document.getElementById('orbIdleMonogram');
            const numberDisplay = document.getElementById('orbNumberDisplay');

            // Smoothly collapse Stage 1 text and center countdown orb
            if (welcomeStage) welcomeStage.classList.add('is-counting');
            if (idleMonogram) idleMonogram.style.display = 'none';
            if (numberDisplay) {
                numberDisplay.style.display = 'block';
                numberDisplay.textContent = '10';
            }

            this.currentCount = 10;
            this.startTime = performance.now();
            this.tickCount(10, numberDisplay);

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
                        self.tickCount(self.currentCount, numberDisplay);
                    } else {
                        clearInterval(self.timer);
                        self.timer = null;
                        self.triggerZeroTransition();
                    }
                }
            }, 30);
        },

        tickCount: function (count, numberDisplay) {
            // Update Number Display with water bubble-pop animation
            if (numberDisplay) {
                numberDisplay.textContent = count;
                numberDisplay.classList.remove('number-bubble-pop');
                void numberDisplay.offsetWidth; // Force reflow
                numberDisplay.classList.add('number-bubble-pop');
            }

            // Trigger Three.js Liquid Shockwave Surge
            if (this.threeEngine) {
                this.threeEngine.triggerLiquidPulse(1.6);
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

            // Trigger expanding radial zero shockwave
            if (shockwave) {
                shockwave.classList.add('trigger');
            }

            // Three.js grand explosion surge
            if (this.threeEngine) {
                this.threeEngine.triggerLiquidPulse(3.5);
            }

            // Screen reader announcement
            if (sr) {
                sr.textContent = 'We are live! Your next chapter begins here.';
            }

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

        // ── Photorealistic 3D Three.js Engine ──
        initThreeEngine: function () {
            if (typeof THREE === 'undefined') {
                const overlay = document.getElementById('launchOverlay');
                if (overlay) overlay.classList.add('fallback-mode');
                return;
            }

            const container = document.getElementById('launchOrbThreeContainer') || document.getElementById('launchWebglCanvas');
            if (!container) return;

            let scene, camera, renderer;
            let glassMesh, liquidMesh, liquidOrigVertices;
            let liquidGeo, liquidMat, glassGeo, glassMat;
            let dropletsGroup = null;
            let dropletList = [];
            let animId = null;
            let liquidPulseIntensity = 0;
            let mouseX = 0, mouseY = 0;
            let targetCamX = 0, targetCamY = 0;

            const width = container.clientWidth || 360;
            const height = container.clientHeight || 360;

            // 1. Scene & Camera Setup
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
            camera.position.set(0, 0, 4.6);

            // 2. WebGL Renderer with High Dynamic Range & Color Management
            try {
                renderer = new THREE.WebGLRenderer({
                    alpha: true,
                    antialias: true,
                    powerPreference: 'high-performance'
                });
            } catch (err) {
                console.warn('WebGL initialization failed, falling back to CSS crystal orb:', err);
                const overlay = document.getElementById('launchOverlay');
                if (overlay) overlay.classList.add('fallback-mode');
                return;
            }

            renderer.setSize(width, height);
            const pixelRatio = Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 2);
            renderer.setPixelRatio(pixelRatio);
            if (renderer.toneMapping !== undefined) {
                renderer.toneMapping = THREE.ACESFilmicToneMapping;
                renderer.toneMappingExposure = 1.25;
            }
            container.appendChild(renderer.domElement);

            // 3. Generate Procedural Luxury Studio Environment Map (PMREM)
            let envTexture = null;
            try {
                envTexture = createLuxuryStudioEnvironment(renderer);
                scene.environment = envTexture;
            } catch (envErr) {
                console.warn('Notice: PMREM environment generation fallback:', envErr);
            }

            // 4. Studio Lighting Rig (Champagne Key + Gold Rim + Cool Specular Kicker)
            const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.7);
            scene.add(ambientLight);

            // Key Light: Warm Champagne Softbox
            const keyLight = new THREE.DirectionalLight(0xffeedd, 2.4);
            keyLight.position.set(3.5, 4.2, 4.0);
            scene.add(keyLight);

            // Gold Rim / Caustic Light
            const goldRimLight = new THREE.PointLight(0xd4af37, 3.2, 18);
            goldRimLight.position.set(2.8, -2.6, 2.8);
            scene.add(goldRimLight);

            // Cool White Specular Kicker Light
            const coolRimLight = new THREE.PointLight(0xffffff, 2.6, 18);
            coolRimLight.position.set(-3.2, 3.0, -2.2);
            scene.add(coolRimLight);

            // Subtle Underglow
            const bottomFillLight = new THREE.PointLight(0xf7df94, 1.6, 12);
            bottomFillLight.position.set(0, -3.8, 1.8);
            scene.add(bottomFillLight);

            // 5. Outer Photorealistic Glass Sphere
            glassGeo = new THREE.SphereGeometry(1.26, 64, 64);
            glassMat = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.32,
                roughness: 0.02,
                metalness: 0.05,
                transmission: 0.96,
                ior: 1.52, // Genuine Crown Glass IOR
                reflectivity: 0.95,
                thickness: 1.6,
                clearcoat: 1.0,
                clearcoatRoughness: 0.02,
                envMap: envTexture,
                envMapIntensity: 2.2,
                wireframe: false
            });
            glassMesh = new THREE.Mesh(glassGeo, glassMat);
            scene.add(glassMesh);

            // 6. Real Procedural Fluid Liquid Core (Not Wireframe!)
            liquidGeo = new THREE.SphereGeometry(1.02, 64, 64);
            const posAttr = liquidGeo.attributes.position;
            liquidOrigVertices = new Float32Array(posAttr.array); // Store pristine vertex coordinates

            liquidMat = new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(0xd4af37), // Warm liquid champagne gold
                roughness: 0.1,
                metalness: 0.35,
                transmission: 0.62,
                ior: 1.333, // Water / Fluid IOR
                transparent: true,
                opacity: 0.85,
                clearcoat: 1.0,
                clearcoatRoughness: 0.05,
                envMap: envTexture,
                envMapIntensity: 2.0,
                wireframe: false
            });
            liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
            scene.add(liquidMesh);

            // 7. Individual 3D Water Droplets with Refraction & Physics
            dropletsGroup = new THREE.Group();
            scene.add(dropletsGroup);

            const dropletGeoShared = new THREE.SphereGeometry(1, 20, 20);
            const dropletMatShared = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                roughness: 0.03,
                metalness: 0.05,
                transmission: 0.95,
                ior: 1.333,
                transparent: true,
                opacity: 0.9,
                clearcoat: 1.0,
                clearcoatRoughness: 0.02,
                envMap: envTexture,
                envMapIntensity: 2.2
            });

            const dropletCount = window.innerWidth < 768 ? 12 : 22;
            for (let i = 0; i < dropletCount; i++) {
                const r = 0.045 + Math.random() * 0.075;
                const dropletMesh = new THREE.Mesh(dropletGeoShared, dropletMatShared);
                dropletMesh.scale.set(r, r * (1.1 + Math.random() * 0.3), r * 0.95);

                const isSurface = i < (dropletCount * 0.45);
                let dist, theta, phi;

                if (isSurface) {
                    dist = 1.28 + Math.random() * 0.04; // Surface contact droplet
                    theta = Math.random() * Math.PI * 2;
                    phi = 0.3 + Math.random() * (Math.PI - 0.6);
                } else {
                    dist = 1.48 + Math.random() * 0.85; // Suspended ambient floating droplet
                    theta = Math.random() * Math.PI * 2;
                    phi = Math.random() * Math.PI;
                }

                dropletMesh.position.set(
                    dist * Math.sin(phi) * Math.cos(theta),
                    dist * Math.cos(phi),
                    dist * Math.sin(phi) * Math.sin(theta)
                );

                dropletsGroup.add(dropletMesh);
                dropletList.push({
                    mesh: dropletMesh,
                    isSurface: isSurface,
                    baseDist: dist,
                    theta: theta,
                    phi: phi,
                    rotSpeedX: (Math.random() - 0.5) * 0.03,
                    rotSpeedY: (Math.random() - 0.5) * 0.03,
                    orbitSpeed: (0.15 + Math.random() * 0.3) * (Math.random() < 0.5 ? 1 : -1),
                    wobbleFreq: 1.5 + Math.random() * 2.0,
                    wobbleAmp: 0.03 + Math.random() * 0.05
                });
            }

            // 8. Desktop Pointer Movement & Smooth Parallax
            const isDesktop = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
            function onMouseMove(e) {
                mouseX = (e.clientX / window.innerWidth) - 0.5;
                mouseY = (e.clientY / window.innerHeight) - 0.5;
                targetCamX = mouseX * 0.9;
                targetCamY = -mouseY * 0.7;
            }
            if (isDesktop) {
                window.addEventListener('mousemove', onMouseMove, { passive: true });
            }

            // 9. Resize Handling
            function onResize() {
                if (!container || !renderer || !camera) return;
                const w = container.clientWidth || 360;
                const h = container.clientHeight || 360;
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
            }
            window.addEventListener('resize', onResize);

            // 10. Animation & Fluid Physics Loop
            const clock = new THREE.Clock();

            function animate() {
                const time = clock.getElapsedTime();

                // Gentle Camera Parallax (Desktop Only)
                if (isDesktop) {
                    camera.position.x += (targetCamX - camera.position.x) * 0.06;
                    camera.position.y += (targetCamY - camera.position.y) * 0.06;
                    camera.lookAt(0, 0, 0);
                }

                // Outer Glass Sphere Motion (Slow luxury orbit)
                glassMesh.rotation.y = time * 0.12;
                glassMesh.rotation.x = Math.sin(time * 0.22) * 0.06;
                glassMesh.position.y = Math.sin(time * 0.75) * 0.04;

                // ── Procedural Fluid Wave Simulation on Liquid Core ──
                const positions = liquidGeo.attributes.position;
                const orig = liquidOrigVertices;
                const count = positions.count;

                for (let i = 0; i < count; i++) {
                    const idx = i * 3;
                    const u = orig[idx];
                    const v = orig[idx + 1];
                    const w = orig[idx + 2];

                    // Multi-frequency harmonic fluid waves
                    const w1 = Math.sin(u * 2.6 + time * 2.4) * 0.04;
                    const w2 = Math.cos(v * 3.2 + time * 1.9) * 0.035;
                    const w3 = Math.sin((u + w) * 2.2 + time * 2.8) * 0.025;

                    // Surge response to countdown ticks
                    const pulse = Math.sin(time * 16.0 - v * 5.0) * (liquidPulseIntensity * 0.07);

                    const scale = 1.0 + w1 + w2 + w3 + pulse;
                    positions.setXYZ(i, u * scale, v * scale, w * scale);
                }
                positions.needsUpdate = true;
                liquidGeo.computeVertexNormals();

                // Liquid Core Counter-Rotation & Floating
                liquidMesh.rotation.y = -time * 0.24;
                liquidMesh.rotation.z = Math.cos(time * 0.18) * 0.1;
                liquidMesh.position.y = Math.sin(time * 0.75 + 0.4) * 0.035;

                // Decay liquid shockwave pulse
                if (liquidPulseIntensity > 0) {
                    liquidPulseIntensity *= 0.93;
                    if (liquidPulseIntensity < 0.01) liquidPulseIntensity = 0;
                }

                // ── 3D Water Droplets Motion & Parallax ──
                for (let i = 0; i < dropletList.length; i++) {
                    const d = dropletList[i];
                    d.theta += d.orbitSpeed * 0.008;

                    // Gentle floating wobble
                    const wobble = Math.sin(time * d.wobbleFreq + i) * d.wobbleAmp;
                    const currentDist = d.baseDist + wobble + (liquidPulseIntensity * 0.04);

                    d.mesh.position.set(
                        currentDist * Math.sin(d.phi) * Math.cos(d.theta),
                        currentDist * Math.cos(d.phi),
                        currentDist * Math.sin(d.phi) * Math.sin(d.theta)
                    );

                    d.mesh.rotation.x += d.rotSpeedX;
                    d.mesh.rotation.y += d.rotSpeedY;
                }

                renderer.render(scene, camera);
                animId = requestAnimationFrame(animate);
            }

            // Expose Engine Controls
            this.threeEngine = {
                start: function () {
                    if (!animId) {
                        clock.start();
                        animate();
                    }
                },
                stop: function () {
                    if (animId) {
                        cancelAnimationFrame(animId);
                        animId = null;
                    }
                },
                triggerLiquidPulse: function (intensity) {
                    liquidPulseIntensity = intensity || 1.5;
                },
                dispose: function () {
                    this.stop();
                    window.removeEventListener('resize', onResize);
                    if (isDesktop) {
                        window.removeEventListener('mousemove', onMouseMove);
                    }

                    if (glassGeo) glassGeo.dispose();
                    if (glassMat) glassMat.dispose();
                    if (liquidGeo) liquidGeo.dispose();
                    if (liquidMat) liquidMat.dispose();
                    if (dropletGeoShared) dropletGeoShared.dispose();
                    if (dropletMatShared) dropletMatShared.dispose();
                    if (envTexture) envTexture.dispose();

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

    // ── Procedural Luxury Studio Radiance Environment Map (PMREM) ──
    function createLuxuryStudioEnvironment(renderer) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // 1. Deep luxury studio dark gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
        bgGrad.addColorStop(0, '#040609');
        bgGrad.addColorStop(0.35, '#0b0f18');
        bgGrad.addColorStop(0.65, '#121722');
        bgGrad.addColorStop(1, '#05070a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1024, 512);

        // 2. Warm Gold Main Studio Softbox (Top-Right Key Reflection)
        const goldSoftbox = ctx.createRadialGradient(720, 130, 8, 720, 130, 200);
        goldSoftbox.addColorStop(0, '#ffffff');
        goldSoftbox.addColorStop(0.2, '#fff1cc');
        goldSoftbox.addColorStop(0.5, '#d4af37');
        goldSoftbox.addColorStop(0.8, 'rgba(184, 134, 11, 0.4)');
        goldSoftbox.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = goldSoftbox;
        ctx.beginPath();
        ctx.arc(720, 130, 200, 0, Math.PI * 2);
        ctx.fill();

        // 3. Crisp White Specular Strip Light (Top-Left Kicker Reflection)
        const stripGrad = ctx.createLinearGradient(200, 0, 360, 0);
        stripGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        stripGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
        stripGrad.addColorStop(0.5, '#ffffff');
        stripGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.7)');
        stripGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = stripGrad;
        ctx.fillRect(200, 70, 160, 260);

        // 4. Subtle Champagne Horizon Glow (Adds depth to Fresnel edge)
        const horizonGrad = ctx.createLinearGradient(0, 230, 0, 310);
        horizonGrad.addColorStop(0, 'rgba(212, 175, 55, 0.25)');
        horizonGrad.addColorStop(0.5, 'rgba(247, 223, 148, 0.45)');
        horizonGrad.addColorStop(1, 'rgba(212, 175, 55, 0)');
        ctx.fillStyle = horizonGrad;
        ctx.fillRect(0, 230, 1024, 80);

        // 5. Generate Texture & PMREM Pre-filtered Cube Map
        const texture = new THREE.CanvasTexture(canvas);
        texture.mapping = THREE.EquirectangularReflectionMapping;

        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        const renderTarget = pmremGenerator.fromEquirectangular(texture);

        texture.dispose();
        pmremGenerator.dispose();

        return renderTarget.texture;
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            window.SVLaunchOverlay.init();
        });
    } else {
        window.SVLaunchOverlay.init();
    }
})();
