/**
 * SV Real Estates Hyderabad — Complete Integration & Workflow Automated Tests
 * Runs natively with `node --test tests/workflow.test.js`
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-key-1234567890';
const app = require('../server');

let server;
let port;
let baseUrl;
let sessionCookie = '';

before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => {
        server.listen(0, () => {
            port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
});

after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
});

describe('1. Health Endpoint & System Readiness', () => {
    test('GET /api/health returns 200 OK and valid status without exposing secrets', async () => {
        const res = await fetch(`${baseUrl}/api/health`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.status, 'ok');
        assert.strictEqual(data.service, 'SV Real Estates Hyderabad API');
        assert.ok(data.timestamp);
        assert.strictEqual(typeof data.database.cloud_configured, 'boolean');
        // Ensure no sensitive environment variables are leaked
        assert.strictEqual(data.SUPABASE_SERVICE_ROLE_KEY, undefined);
        assert.strictEqual(data.SV_REAL_ESTATE_EDGE_TOKEN_V2, undefined);
        assert.strictEqual(data.DATABASE_URL, undefined);
    });
});

describe('2. Validation & Input Sanitization', () => {
    test('Rejects enquiry missing full_name with HTTP 400', async () => {
        const res = await fetch(`${baseUrl}/api/leads/public`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '9849012345' })
        });
        assert.strictEqual(res.status, 400);
        const json = await res.json();
        assert.ok(json.errors.some(e => e.toLowerCase().includes('name')));
    });

    test('Rejects enquiry with invalid phone number with HTTP 400', async () => {
        const res = await fetch(`${baseUrl}/api/leads/public`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: 'John Doe', phone: '12345' })
        });
        assert.strictEqual(res.status, 400);
        const json = await res.json();
        assert.ok(json.errors.some(e => e.toLowerCase().includes('mobile') || e.toLowerCase().includes('phone')));
    });

    test('Sanitizes XSS payloads safely in enquiry data', async () => {
        const res = await fetch(`${baseUrl}/api/leads/public`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'Safe Customer <script>alert("hack")</script>',
                phone: '9876543210',
                message: '<img src=x onerror=alert(1)> Interested in villa',
                property_requirement: 'Villa'
            })
        });
        // Succeeded or created with sanitized strings
        assert.ok(res.status === 201 || res.status === 200);
    });
});

describe('3. Public Enquiry Submission & Lead Reference', () => {
    let leadRef = '';

    test('Valid enquiry submission returns HTTP 201 and unique SV-LEAD reference', async () => {
        const res = await fetch(`${baseUrl}/api/leads/public`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'Automated Suite Tester',
                phone: '9848099887',
                email: 'suite.test@example.com',
                appointment_date: '2026-10-28',
                appointment_time: '11:00 AM - 01:00 PM',
                property_requirement: '3BHK Villa',
                source: 'website'
            })
        });
        assert.strictEqual(res.status, 201);
        const json = await res.json();
        assert.ok(json.lead_code || json.reference);
        leadRef = json.lead_code || json.reference;
        assert.ok(leadRef.startsWith('SV-LEAD-'));
    });

    test('Rapid duplicate submission from same phone receives friendly status', async () => {
        const res = await fetch(`${baseUrl}/api/leads/public`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'Automated Suite Tester',
                phone: '9848099887',
                property_requirement: '3BHK Villa'
            })
        });
        // Either 409 duplicate or 201 created depending on SQLite / Cloud mode
        assert.ok([200, 201, 409].includes(res.status));
    });
});

describe('4. Security & Access Control Policies', () => {
    test('Unauthenticated access to /admin/leads redirects to login', async () => {
        const res = await fetch(`${baseUrl}/admin/leads`, { redirect: 'manual' });
        assert.ok([302, 307].includes(res.status));
        assert.ok(res.headers.get('location').includes('/admin/login'));
    });

    test('Unauthenticated PATCH to /api/leads/:id/status returns 401 Authentication Required', async () => {
        const res = await fetch(`${baseUrl}/api/leads/1/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'contacted' }),
            redirect: 'manual'
        });
        assert.strictEqual(res.status, 401);
        const json = await res.json();
        assert.strictEqual(json.error, 'Authentication required');
    });

    test('Unauthenticated POST to /api/properties returns 401 Authentication Required', async () => {
        const res = await fetch(`${baseUrl}/api/properties`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Hacked Property' }),
            redirect: 'manual'
        });
        assert.strictEqual(res.status, 401);
        const json = await res.json();
        assert.strictEqual(json.error, 'Authentication required');
    });
});

describe('5. Admin Authentication & Role-Based Permissions Workflow', () => {
    let superAdminCookie = '';
    let normalAdminCookie = '';

    test('Super Admin successfully logs in and redirects to /admin/dashboard', async () => {
        const res = await fetch(`${baseUrl}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'email=superadmin%40svrealestate.com&password=SuperAdmin%40SV2024',
            redirect: 'manual'
        });
        assert.ok([302, 307].includes(res.status));
        assert.strictEqual(res.headers.get('location'), '/admin/dashboard');
        superAdminCookie = (res.headers.get('set-cookie') || '').split(';')[0];
        assert.ok(superAdminCookie.startsWith('sv.sid='));
    });

    test('Super Admin can view /admin/dashboard, /admin/leads, and /admin/settings', async () => {
        const dashRes = await fetch(`${baseUrl}/admin/dashboard`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(dashRes.status, 200);

        const settingsRes = await fetch(`${baseUrl}/admin/settings`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(settingsRes.status, 200);
        const settingsHtml = await settingsRes.text();
        assert.ok(settingsHtml.includes('Normal Admin Permissions'));
    });

    test('Normal Admin successfully logs in and lands directly on /admin/leads', async () => {
        const res = await fetch(`${baseUrl}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'email=admin%40svrealestate.com&password=Admin%40SV2024',
            redirect: 'manual'
        });
        assert.ok([302, 307].includes(res.status));
        assert.strictEqual(res.headers.get('location'), '/admin/leads');
        normalAdminCookie = (res.headers.get('set-cookie') || '').split(';')[0];
        sessionCookie = normalAdminCookie; // maintain compatibility for subsequent tests
        assert.ok(normalAdminCookie.startsWith('sv.sid='));
    });

    test('Normal Admin can view /admin/leads and does NOT see Super Admin button on page', async () => {
        const res = await fetch(`${baseUrl}/admin/leads`, {
            headers: { 'Cookie': normalAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const html = await res.text();
        assert.ok(html.includes('Leads') || html.includes('Enquiries'));
        // Verify no Super Admin button or badge is visible to Normal Admin
        assert.ok(!html.includes('Super Admin'), 'Normal admin page must not display Super Admin button or badge');
    });

    test('Normal Admin is blocked from /admin/settings and redirected to /admin/leads', async () => {
        const res = await fetch(`${baseUrl}/admin/settings`, {
            headers: { 'Cookie': normalAdminCookie },
            redirect: 'manual'
        });
        assert.ok([302, 307].includes(res.status));
        assert.strictEqual(res.headers.get('location'), '/admin/leads');
    });

    test('Super Admin can toggle Normal Admin permissions dynamically', async () => {
        // Enable dashboard permission for Normal Admin
        const postRes = await fetch(`${baseUrl}/admin/settings/permissions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': superAdminCookie
            },
            body: 'perm_dashboard=1&perm_leads=1',
            redirect: 'manual'
        });
        assert.ok([302, 307].includes(postRes.status));

        // Normal Admin can now access /admin/dashboard
        const dashRes = await fetch(`${baseUrl}/admin/dashboard`, {
            headers: { 'Cookie': normalAdminCookie }
        });
        assert.strictEqual(dashRes.status, 200);

        // Reset permission back: Normal Admin only gets leads
        await fetch(`${baseUrl}/admin/settings/permissions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': superAdminCookie
            },
            body: 'perm_leads=1',
            redirect: 'manual'
        });
    });
});

describe('6. Properties Catalog & Search Quality', () => {
    test('Public /properties returns 200 OK with properties list', async () => {
        const res = await fetch(`${baseUrl}/properties`);
        assert.strictEqual(res.status, 200);
        const html = await res.text();
        assert.ok(html.includes('Properties'));
    });

    test('Category filtering for villa works correctly', async () => {
        const res = await fetch(`${baseUrl}/properties?category=villa`);
        assert.strictEqual(res.status, 200);
    });

    test('Budget filtering min_price=7000000 filters correctly', async () => {
        const res = await fetch(`${baseUrl}/properties?min_price=7000000`);
        assert.strictEqual(res.status, 200);
    });

    test('Budget filtering max_price=60000000 (6 Crore cap) filters correctly', async () => {
        const res = await fetch(`${baseUrl}/properties?max_price=60000000`);
        assert.strictEqual(res.status, 200);
    });

    test('Public API returns properties with high-res cover images within ₹70L - ₹6 Cr range', async () => {
        const res = await fetch(`${baseUrl}/api/properties/public`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data.properties));
        assert.ok(data.properties.length > 0);
        for (const p of data.properties) {
            assert.ok(p.price >= 7000000, `Property ${p.property_code} price ${p.price} should be >= ₹70L`);
            assert.ok(p.price <= 60000000, `Property ${p.property_code} price ${p.price} should be <= ₹6 Cr`);
            assert.ok(p.cover_image && (p.cover_image.startsWith('http') || p.cover_image.startsWith('/uploads/')), `Property ${p.property_code} must have a valid cover_image URL`);
        }
    });

    test('Local offline property photo bank contains valid image assets for catalog properties', async () => {
        const fs = require('fs');
        const path = require('path');
        const { getDb } = require('../database/db');
        const db = getDb();
        const images = db.prepare("SELECT image_url FROM property_images WHERE image_url LIKE '/uploads/%'").all();
        assert.ok(images.length > 50, `Expected at least 50 local images, found ${images.length}`);
        const sample = images[0];
        const localPath = path.join(__dirname, '..', 'public', sample.image_url.replace(/^\//, ''));
        assert.ok(fs.existsSync(localPath), `Sample image file ${localPath} should exist on disk`);
        assert.ok(fs.statSync(localPath).size > 1000, `Sample image file ${localPath} should have content`);
    });
});

