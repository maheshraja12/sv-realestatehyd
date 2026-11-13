/**
 * Automated Integration Tests for 3D Liquid Glass Launch Overlay & Countdown Engine
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-key-1234567890';
const app = require('../server');

let server;
let baseUrl;
let superAdminCookie = '';

before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => {
        server.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });

    // Login as Super Admin
    const loginRes = await fetch(`${baseUrl}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'email=superadmin%40svrealestate.com&password=SuperAdmin%40SV2024',
        redirect: 'manual'
    });
    superAdminCookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
});

after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
});

describe('11. 3D Liquid Glass & Waterdrop Launch Countdown Overlay', () => {
    test('Static Assets: /css/launch-overlay.css returns 200 OK with glassmorphism styles', async () => {
        const res = await fetch(`${baseUrl}/css/launch-overlay.css`);
        assert.strictEqual(res.status, 200);
        const css = await res.text();
        assert.ok(css.includes('.liquid-glass-card'));
        assert.ok(css.includes('.glass-sphere-orb'));
        assert.ok(css.includes('.btn-liquid-glass'));
    });

    test('Static Assets: /js/launch-liquid-glass.js returns 200 OK with waterdrop & 3D engine', async () => {
        const res = await fetch(`${baseUrl}/js/launch-liquid-glass.js`);
        assert.strictEqual(res.status, 200);
        const js = await res.text();
        assert.ok(js.includes('SVLaunchOverlay'));
        assert.ok(js.includes('initWaterdrops'));
        assert.ok(js.includes('initThreeSphere'));
        assert.ok(js.includes('triggerZeroTransition'));
    });

    test('Static Assets: /js/vendor/three.min.js is served locally with HTTP 200', async () => {
        const res = await fetch(`${baseUrl}/js/vendor/three.min.js`);
        assert.strictEqual(res.status, 200);
        const js = await res.text();
        assert.ok(js.length > 500000, 'Three.js should be available locally');
    });

    test('GET /launch dedicated route returns 200 OK and renders 3D launch overlay', async () => {
        const res = await fetch(`${baseUrl}/launch`);
        assert.strictEqual(res.status, 200);
        const html = await res.text();
        assert.ok(html.includes('id="launchOverlay"'));
        assert.ok(html.includes('id="launchWaterdropCanvas"'));
        assert.ok(html.includes('id="launchWebglCanvas"'));
        assert.ok(html.includes('id="btnLaunchStart"'));
        assert.ok(html.includes('The Grand'));
        assert.ok(html.includes('WE ARE'));
    });

    test('GET / homepage includes launch overlay partial and stylesheet', async () => {
        const res = await fetch(`${baseUrl}/`);
        assert.strictEqual(res.status, 200);
        const html = await res.text();
        assert.ok(html.includes('href="/css/launch-overlay.css"'));
        assert.ok(html.includes('id="launchOverlay"'));
    });

    test('Admin Settings: Super Admin can toggle launch overlay & independent liquid effects', async () => {
        // Disable liquid effects independently
        const postRes = await fetch(`${baseUrl}/admin/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': superAdminCookie
            },
            body: 'launch_settings_submitted=1&launch_overlay_enabled=1&launch_overlay_mode=always',
            redirect: 'manual'
        });
        assert.ok([302, 307].includes(postRes.status));

        // Verify public page reflects data-liquid-effects="0"
        const homeRes = await fetch(`${baseUrl}/`);
        const html = await homeRes.text();
        assert.ok(html.includes('data-liquid-effects="0"'), 'Liquid effects should be disabled independently when unticked');

        // Re-enable both launch overlay and 3D liquid effects
        const reEnableRes = await fetch(`${baseUrl}/admin/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': superAdminCookie
            },
            body: 'launch_settings_submitted=1&launch_overlay_enabled=1&launch_liquid_effects_enabled=1&launch_overlay_mode=always',
            redirect: 'manual'
        });
        assert.ok([302, 307].includes(reEnableRes.status));

        const homeRes2 = await fetch(`${baseUrl}/`);
        const html2 = await homeRes2.text();
        assert.ok(html2.includes('data-liquid-effects="1"'), 'Liquid effects should be re-enabled');
    });
});

