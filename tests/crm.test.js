/**
 * Automated CRM Test Suite — SV Real Estates Hyderabad
 * Tests all 12 pipeline stages, follow-up manager, customer 360, duplicate merging,
 * employee workload, bulk actions, activity timeline, and analytics.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../server');

let server;
let baseUrl;
let superAdminCookie = '';
let testLeadId = null;
let testCustomerId = null;
let testEmployeeId = null;
let testFollowupId = null;

before(async () => {
    await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            baseUrl = `http://127.0.0.1:${addr.port}`;
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
        await new Promise(resolve => server.close(resolve));
    }
});

describe('1. CRM Pipeline Kanban & 12-Stage Transitions', () => {
    test('GET /api/crm/pipeline returns all 12 canonical stages with valid summary stats', async () => {
        const res = await fetch(`${baseUrl}/api/crm/pipeline`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data.stages));
        assert.strictEqual(data.stages.length, 12);

        const stageIds = data.stages.map(s => s.id);
        const expected = [
            'new', 'not_contacted', 'contacted', 'qualified', 'interested',
            'site_visit_scheduled', 'site_visit_completed', 'negotiation',
            'booking_in_progress', 'converted', 'lost', 'spam'
        ];
        assert.deepStrictEqual(stageIds, expected);
        assert.ok(data.summary.totalLeads >= 0);
        assert.ok(typeof data.summary.totalValue === 'number');
    });

    test('Create test lead via public enquiry and verify it starts in "new" pipeline stage', async () => {
        const uniquePhone = '99' + Math.floor(10000000 + Math.random() * 90000000);
        const res = await fetch(`${baseUrl}/api/leads/public`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'Pipeline Test Prospect',
                phone: uniquePhone,
                property_requirement: '4BHK Villa Kokapet',
                budget: '₹4.5 Cr'
            })
        });
        assert.strictEqual(res.status, 201);
        const json = await res.json();
        assert.ok(json.lead_code);

        // Fetch lead ID from DB
        const { getDb } = require('../database/db');
        const db = getDb();
        const row = db.prepare('SELECT id, status FROM leads WHERE lead_code = ?').get(json.lead_code);
        assert.ok(row);
        assert.strictEqual(row.status, 'new');
        testLeadId = row.id;
    });

    test('PATCH /api/crm/pipeline/move transitions lead to "contacted" and records activity', async () => {
        const res = await fetch(`${baseUrl}/api/crm/pipeline/move`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Cookie': superAdminCookie 
            },
            body: JSON.stringify({
                lead_id: testLeadId,
                target_stage: 'contacted',
                reason: 'Called prospect and confirmed interest'
            })
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.success, true);
        assert.strictEqual(json.new_status, 'contacted');

        // Verify status in database
        const { getDb } = require('../database/db');
        const db = getDb();
        const lead = db.prepare('SELECT status FROM leads WHERE id = ?').get(testLeadId);
        assert.strictEqual(lead.status, 'contacted');

        // Verify activity logged
        const activity = db.prepare("SELECT * FROM lead_activities WHERE lead_id = ? AND activity_type = 'status_change' ORDER BY id DESC LIMIT 1").get(testLeadId);
        assert.ok(activity);
        assert.ok(activity.title.includes('Contacted'));
    });

    test('PATCH /api/leads/:id/status updates lead to "negotiation" stage', async () => {
        const res = await fetch(`${baseUrl}/api/leads/${testLeadId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': superAdminCookie
            },
            body: JSON.stringify({ status: 'negotiation' })
        });
        assert.strictEqual(res.status, 200);

        const { getDb } = require('../database/db');
        const db = getDb();
        const lead = db.prepare('SELECT status FROM leads WHERE id = ?').get(testLeadId);
        assert.strictEqual(lead.status, 'negotiation');
    });
});

describe('2. Follow-up Tasks & Reminders Manager', () => {
    test('POST /api/crm/followups schedules a high-priority follow-up task', async () => {
        const res = await fetch(`${baseUrl}/api/crm/followups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': superAdminCookie
            },
            body: JSON.stringify({
                lead_id: testLeadId,
                title: 'Review Kokapet site layout and floor plan',
                description: 'Client requested specific Vaastu alignment details',
                scheduled_at: new Date(Date.now() + 86400000).toISOString(),
                priority: 'high'
            })
        });
        assert.strictEqual(res.status, 201);
        const json = await res.json();
        assert.ok(json.task_id);
        assert.ok(json.task_code.startsWith('SV-TASK-'));
        testFollowupId = json.task_id;
    });

    test('GET /api/crm/followups returns scheduled task and accurate counts', async () => {
        const res = await fetch(`${baseUrl}/api/crm/followups?tab=all`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.ok(Array.isArray(json.tasks));
        assert.ok(json.counts);
        assert.ok(json.counts.all >= 1);

        const task = json.tasks.find(t => t.id === testFollowupId);
        assert.ok(task);
        assert.strictEqual(task.priority, 'high');
        assert.strictEqual(task.status, 'pending');
    });

    test('PATCH /api/crm/followups/:id marks task as completed with outcome notes', async () => {
        const res = await fetch(`${baseUrl}/api/crm/followups/${testFollowupId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': superAdminCookie
            },
            body: JSON.stringify({
                status: 'completed',
                result_notes: 'Discussed floor plans, client agreed to visit site on Saturday'
            })
        });
        assert.strictEqual(res.status, 200);

        const { getDb } = require('../database/db');
        const db = getDb();
        const task = db.prepare('SELECT status, result_notes, completed_at FROM follow_up_tasks WHERE id = ?').get(testFollowupId);
        assert.strictEqual(task.status, 'completed');
        assert.ok(task.completed_at);
        assert.strictEqual(task.result_notes, 'Discussed floor plans, client agreed to visit site on Saturday');
    });
});

describe('3. Customer 360 & Duplicate Merging', () => {
    test('POST /api/crm/leads/:id/convert-to-customer creates customer profile and code', async () => {
        const res = await fetch(`${baseUrl}/api/crm/leads/${testLeadId}/convert-to-customer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': superAdminCookie
            }
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.success, true);
        assert.ok(json.customer_id);
        assert.ok(json.customer_code.startsWith('SV-CUST-'));
        testCustomerId = json.customer_id;

        // Verify lead has customer_id updated
        const { getDb } = require('../database/db');
        const db = getDb();
        const lead = db.prepare('SELECT customer_id FROM leads WHERE id = ?').get(testLeadId);
        assert.strictEqual(lead.customer_id, testCustomerId);
    });

    test('GET /api/crm/customers/:id returns complete 360 customer profile with timeline', async () => {
        const res = await fetch(`${baseUrl}/api/crm/customers/${testCustomerId}`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.ok(json.customer);
        assert.strictEqual(json.customer.id, testCustomerId);
        assert.ok(Array.isArray(json.leads));
        assert.ok(json.leads.length >= 1);
        assert.ok(Array.isArray(json.activities));
    });

    test('POST /api/crm/customers/merge merges duplicate profile and updates records', async () => {
        const { getDb } = require('../database/db');
        const db = getDb();
        // Create a duplicate customer profile
        const dupCode = 'SV-CUST-DUP-' + Date.now();
        const dupInsert = db.prepare(`
            INSERT INTO customer_profiles (
                customer_code, full_name, phone, deal_status
            ) VALUES (?, 'Duplicate Prospect', '9900000099', 'active')
        `).run(dupCode);
        const dupId = dupInsert.lastInsertRowid;

        const res = await fetch(`${baseUrl}/api/crm/customers/merge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': superAdminCookie
            },
            body: JSON.stringify({
                primary_id: testCustomerId,
                duplicate_id: dupId,
                reason: 'Same individual with alternate mobile number'
            })
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.success, true);

        // Verify duplicate is now marked inactive and merged_into_id set
        const dupRecord = db.prepare('SELECT deal_status, merged_into_id FROM customer_profiles WHERE id = ?').get(dupId);
        assert.strictEqual(dupRecord.deal_status, 'inactive');
        assert.strictEqual(dupRecord.merged_into_id, testCustomerId);
    });
});

describe('4. Employee & Team Management with Multi-tier Roles', () => {
    test('POST /api/crm/employees creates a new Sales Executive account', async () => {
        const res = await fetch(`${baseUrl}/api/crm/employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': superAdminCookie
            },
            body: JSON.stringify({
                name: 'Vikram Sales Executive',
                email: `vikram.${Date.now()}@svrealestate.com`,
                password: 'Password@SV123',
                role: 'sales_executive',
                phone: '9848099112',
                designation: 'Luxury Villa Specialist'
            })
        });
        assert.strictEqual(res.status, 201);
        const json = await res.json();
        assert.strictEqual(json.success, true);
        assert.ok(json.user_id);
        testEmployeeId = json.user_id;
    });

    test('GET /api/crm/employees returns employee directory with workload metrics', async () => {
        const res = await fetch(`${baseUrl}/api/crm/employees`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.ok(Array.isArray(json.employees));
        const emp = json.employees.find(e => e.id === testEmployeeId);
        assert.ok(emp);
        assert.strictEqual(emp.role, 'sales_executive');
        assert.ok(typeof emp.assigned_leads_count === 'number');
    });

    test('POST /api/crm/employees/:id/reset-password securely updates password', async () => {
        const res = await fetch(`${baseUrl}/api/crm/employees/${testEmployeeId}/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': superAdminCookie
            },
            body: JSON.stringify({ new_password: 'NewSecurePassword@SV99' })
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.ok(json.message.includes('successfully'));
    });
});

describe('5. Bulk Lead Operations & Duplicate Detection', () => {
    test('POST /api/crm/leads/bulk-assign assigns leads to specified executive', async () => {
        const res = await fetch(`${baseUrl}/api/crm/leads/bulk-assign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': superAdminCookie
            },
            body: JSON.stringify({
                lead_ids: [testLeadId],
                agent_id: testEmployeeId
            })
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.success, true);

        const { getDb } = require('../database/db');
        const db = getDb();
        const lead = db.prepare('SELECT assigned_to, assigned_agent_id FROM leads WHERE id = ?').get(testLeadId);
        assert.strictEqual(lead.assigned_to, testEmployeeId);
    });

    test('POST /api/crm/leads/check-duplicate identifies existing prospect', async () => {
        const { getDb } = require('../database/db');
        const db = getDb();
        const existingLead = db.prepare('SELECT phone FROM leads WHERE id = ?').get(testLeadId);

        const res = await fetch(`${baseUrl}/api/crm/leads/check-duplicate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': superAdminCookie
            },
            body: JSON.stringify({ phone: existingLead.phone })
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.duplicate, true);
        assert.ok(json.lead);
    });

    test('POST /api/crm/import/csv imports valid leads and skips duplicate numbers', async () => {
        const { getDb } = require('../database/db');
        const db = getDb();
        const existingLead = db.prepare('SELECT phone FROM leads WHERE id = ?').get(testLeadId);

const freshPhone = '91' + Math.floor(10000000 + Math.random() * 90000000);
        const csvContent = [
            'Name,Phone,Email,Requirement,Budget',
            `Existing Buyer,${existingLead.phone},existing@example.com,Villa,₹4 Cr`,
            `Fresh Buyer,${freshPhone},fresh@example.com,Apartment Bachupally,₹75 Lakhs`
        ].join('\n');

        const res = await fetch(`${baseUrl}/api/crm/import/csv`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': superAdminCookie
            },
            body: JSON.stringify({ csv_data: csvContent })
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.success, true);
        assert.strictEqual(json.imported, 1);
        assert.strictEqual(json.skippedDuplicates, 1);
    });
});

describe('6. Activity Timeline Quick-Log', () => {
    test('POST /api/crm/activity/quick-log records phone call interaction', async () => {
        const res = await fetch(`${baseUrl}/api/crm/activity/quick-log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': superAdminCookie
            },
            body: JSON.stringify({
                lead_id: testLeadId,
                activity_type: 'call',
                title: 'Outbound Call — Connected',
                notes: 'Discussed registration process and bank loan tie-ups',
                outcome: 'interested'
            })
        });
        assert.strictEqual(res.status, 201);
        const json = await res.json();
        assert.strictEqual(json.success, true);

        // Verify last_contacted_at updated
        const { getDb } = require('../database/db');
        const db = getDb();
        const lead = db.prepare('SELECT last_contacted_at FROM leads WHERE id = ?').get(testLeadId);
        assert.ok(lead.last_contacted_at);
    });
});

describe('7. CRM Analytics & Date Range Filtering', () => {
    test('GET /api/crm/analytics returns valid KPIs, funnel distribution, and leaderboard', async () => {
        const res = await fetch(`${baseUrl}/api/crm/analytics?range=30d`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.ok(json.kpis);
        assert.ok(typeof json.kpis.totalLeads === 'number');
        assert.ok(Array.isArray(json.funnel));
        assert.strictEqual(json.funnel.length, 12);
        assert.ok(Array.isArray(json.sources));
    });
});

describe('8. Admin CRM Web Views', () => {
    test('GET /admin/crm renders CRM Overview page', async () => {
        const res = await fetch(`${baseUrl}/admin/crm`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const text = await res.text();
        assert.ok(text.includes('CRM Control Center'));
        assert.ok(text.includes('Real Estate Sales Funnel'));
    });

    test('GET /admin/crm/pipeline renders Sales Pipeline Kanban view', async () => {
        const res = await fetch(`${baseUrl}/admin/crm/pipeline`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const text = await res.text();
        assert.ok(text.includes('Sales Pipeline (12 Stages)'));
    });

    test('GET /admin/crm/customers renders Customer Directory view', async () => {
        const res = await fetch(`${baseUrl}/admin/crm/customers`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const text = await res.text();
        assert.ok(text.includes('Customer Management'));
    });

    test('GET /admin/crm/followups renders Follow-up Manager view', async () => {
        const res = await fetch(`${baseUrl}/admin/crm/followups`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const text = await res.text();
        assert.ok(text.includes('Follow-up Manager'));
    });

    test('GET /admin/crm/employees renders Employees and Teams view', async () => {
        const res = await fetch(`${baseUrl}/admin/crm/employees`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const text = await res.text();
        assert.ok(text.includes('Employees & Sales Teams'));
    });

    test('GET /admin/crm/reports renders Reports and Performance Analytics view', async () => {
        const res = await fetch(`${baseUrl}/admin/crm/reports`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const text = await res.text();
        assert.ok(text.includes('Reports & Performance Analytics'));
    });

    test('GET /admin/crm/import-export renders Import and Export view', async () => {
        const res = await fetch(`${baseUrl}/admin/crm/import-export`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const text = await res.text();
        assert.ok(text.includes('Import & Export CRM Data'));
    });

    test('GET /admin/crm/audit-logs renders Audit Logs view', async () => {
        const res = await fetch(`${baseUrl}/admin/crm/audit-logs`, {
            headers: { 'Cookie': superAdminCookie }
        });
        assert.strictEqual(res.status, 200);
        const text = await res.text();
        assert.ok(text.includes('CRM & System Audit Logs'));
    });
});
