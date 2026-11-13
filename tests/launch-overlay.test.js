/**
 * Automated Integration Tests for 3D Liquid Glass Launch Overlay & Countdown Engine
 * Covers both ENABLED and DISABLED states, security access rules, and UI requirements
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
        assert.ok(css.includes('.orb-three-container'));
    });

    test('Static Assets: /js/launch-liquid-glass.js returns 200 OK with waterdrop & 3D engine', async () => {
        const res = await fetch(`${baseUrl}/js/launch-liquid-glass.js`);
        assert.strictEqual(res.status, 200);
        const js = await res.text();
        assert.ok(js.includes('SVLaunchOverlay'));
        assert.ok(js.includes('initWaterdrops'));
        assert.ok(js.includes('initThreeSphere'));
        assert.ok(js.includes('triggerZeroTransition'));
        assert.ok(js.includes('startCountdown'));
    });

    test('Static Assets: /js/vendor/three.min.js is served locally with HTTP 200', async () => {
        const res = await fetch(`${baseUrl}/js/vendor/three.min.js`);
        assert.strictEqual(res.status, 200);
        const js = await res.text();
        assert.ok(js.length > 500000, 'Three.js should be available locally');
    });

    test('UI & Copy: Homepage displays luxury entrance with single primary button and no bypass controls', async () => {
        // Ensure enabled first
        await fetch(`${baseUrl}/admin/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': superAdminCookie
            },
            body: 'launch_settings_submitted=1&launch_overlay_enabled=1&launch_liquid_effects_enabled=1&launch_overlay_mode=always',
            redirect: 'manual'
        });

        const res = await fetch(`${baseUrl}/`);
        assert.strictEqual(res.status, 200);
        const html = await res.text();

        // 1. Branding & Copy
        assert.ok(html.includes('THE ART OF'));
        assert.ok(html.includes('BETTER LIVING'));
        assert.ok(html.includes('Discover a world of exceptional properties and refined living.'));
        assert.ok(html.includes('START EXPERIENCE'));
        assert.ok(html.includes('WE ARE'));
        assert.ok(html.includes('LIVE'));
        assert.ok(html.includes('Your next chapter begins here.'));
        assert.ok(html.includes('EXPLORE WEBSITE'));

        // 2. Elements & 3D stage
        assert.ok(html.includes('id="launchOverlay"'));
        assert.ok(html.includes('id="launchWaterdropCanvas"'));
        assert.ok(html.includes('id="launchOrbThreeContainer"'));
        assert.ok(html.includes('id="btnLaunchStart"'));

        // 3. Unnecessary controls removed
        assert.ok(!html.includes('id="btnLaunchClose"'), 'Public close button must be removed');
        assert.ok(!html.includes('id="btnLaunchFxToggle"'), 'Public FX toggle must be removed');
        assert.ok(!html.includes('100% Clear Title Verified'), 'Unverified claim must be removed from entrance screen');
        assert.ok(!html.includes('40+ Handpicked Listings'), 'Extra statistics cards must be removed');
    });

    test('Security & Access: When disabled, public visitors cannot bypass using /launch', async () => {
        // Disable overlay using Admin action
        const disableRes = await fetch(`${baseUrl}/admin/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': superAdminCookie
            },
            body: 'action=remove_launch_overlay',
            redirect: 'manual'
        });
        assert.ok([302, 307].includes(disableRes.status));

        // 1. Homepage / must NOT render active launch overlay
        const homeRes = await fetch(`${baseUrl}/`);
        const homeHtml = await homeRes.text();
        assert.ok(!homeHtml.includes('id="launchOverlay"'), 'Disabled overlay should not be rendered on homepage for public visitors');

        // 2. Unauthenticated GET /launch must redirect to / (no public bypass)
        const unauthLaunchRes = await fetch(`${baseUrl}/launch`, { redirect: 'manual' });
        assert.strictEqual(unauthLaunchRes.status, 302);
        assert.strictEqual(unauthLaunchRes.headers.get('location'), '/');

        // 3. Authenticated Admin preview /admin/launch/preview works even when globally disabled
        const adminPreviewRes = await fetch(`${baseUrl}/admin/launch/preview`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(adminPreviewRes.status, 200);
        const adminPreviewHtml = await adminPreviewRes.text();
        assert.ok(adminPreviewHtml.includes('id="launchOverlay"'), 'Admin preview route renders overlay for testing');
        assert.ok(adminPreviewHtml.includes('data-admin-preview="1"'), 'Admin preview flag should be present');

        // Re-enable overlay for subsequent tests
        const reEnableRes = await fetch(`${baseUrl}/admin/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': superAdminCookie
            },
            body: 'action=enable_launch_overlay',
            redirect: 'manual'
        });
        assert.ok([302, 307].includes(reEnableRes.status));

        // Verify it is back active on homepage
        const recheckHome = await fetch(`${baseUrl}/`);
        const recheckHtml = await recheckHome.text();
        assert.ok(recheckHtml.includes('id="launchOverlay"'), 'Overlay should be restored on homepage');
    });

    test('Admin Settings: Super Admin can toggle 3D liquid effects independently', async () => {
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
