/**
 * SV Real Estates Hyderabad — CRM API Module
 * Complete Customer Relationship Management Suite
 * Pipeline Kanban, Follow-ups, Customer 360, Teams, Distribution, Activity Timeline, Analytics
 */
const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDb } = require('../../database/db');
const {
    isPostgresConfigured,
    updateLeadStatus: updatePgLeadStatus,
    updateLead: updatePgLead,
    insertCustomerProfile: insertPgCustomer,
    updateCustomerProfile: updatePgCustomer,
    insertFollowUpTask: insertPgFollowup,
    updateFollowUpTask: updatePgFollowup,
    insertLeadActivity: insertPgActivity
} = require('../../database/postgres');
const {
    requireAuth,
    requireSuperAdmin,
    auditLog,
    logLeadActivity,
    getLeadFilterForUser
} = require('../../middleware/auth');

// All CRM endpoints require authentication
router.use(requireAuth);

// Canonical 12 Pipeline Stages
const PIPELINE_STAGES = [
    { id: 'new', name: 'New Lead', order: 1, color: '#3b82f6', icon: 'fa-user-plus' },
    { id: 'not_contacted', name: 'Not Contacted', order: 2, color: '#64748b', icon: 'fa-phone-slash' },
    { id: 'contacted', name: 'Contacted', order: 3, color: '#0ea5e9', icon: 'fa-phone' },
    { id: 'qualified', name: 'Qualified', order: 4, color: '#8b5cf6', icon: 'fa-clipboard-check' },
    { id: 'interested', name: 'Interested', order: 5, color: '#ec4899', icon: 'fa-heart' },
    { id: 'site_visit_scheduled', name: 'Site Visit Scheduled', order: 6, color: '#f59e0b', icon: 'fa-calendar-alt' },
    { id: 'site_visit_completed', name: 'Site Visit Completed', order: 7, color: '#10b981', icon: 'fa-check-circle' },
    { id: 'negotiation', name: 'Negotiation', order: 8, color: '#f97316', icon: 'fa-handshake' },
    { id: 'booking_in_progress', name: 'Booking in Progress', order: 9, color: '#d97706', icon: 'fa-file-signature' },
    { id: 'converted', name: 'Converted', order: 10, color: '#059669', icon: 'fa-trophy' },
    { id: 'lost', name: 'Lost', order: 11, color: '#ef4444', icon: 'fa-times-circle' },
    { id: 'spam', name: 'Invalid / Spam', order: 12, color: '#6b7280', icon: 'fa-ban' }
];

function normalizeStatusKey(s) {
    if (!s) return 'new';
    const key = String(s).toLowerCase().trim().replace(/\s+/g, '_').replace(/[\/-]/g, '_');
    const mapping = {
        'new': 'new',
        'new_lead': 'new',
        'not_contacted': 'not_contacted',
        'contacted': 'contacted',
        'qualified': 'qualified',
        'interested': 'interested',
        'site_visit_scheduled': 'site_visit_scheduled',
        'visit_scheduled': 'site_visit_scheduled',
        'site_visit_completed': 'site_visit_completed',
        'visit_completed': 'site_visit_completed',
        'negotiation': 'negotiation',
        'in_negotiation': 'negotiation',
        'booking_in_progress': 'booking_in_progress',
        'booking': 'booking_in_progress',
        'converted': 'converted',
        'won': 'converted',
        'closed': 'converted',
        'lost': 'lost',
        'spam': 'spam',
        'invalid': 'spam',
        'invalid_spam': 'spam'
    };
    return mapping[key] || 'new';
}

function parseBudgetToNumber(budgetStr) {
    if (!budgetStr) return 0;
    const s = String(budgetStr).toLowerCase().replace(/,/g, '').trim();
    const crMatch = s.match(/([\d.]+)\s*(cr|crore|crores)/);
    if (crMatch) {
        return parseFloat(crMatch[1]) * 10000000;
    }
    const lakhMatch = s.match(/([\d.]+)\s*(l|lakh|lakhs|lac|lacs)/);
    if (lakhMatch) {
        return parseFloat(lakhMatch[1]) * 100000;
    }
    const numMatch = s.match(/(\d+)/);
    if (numMatch) {
        const val = parseInt(numMatch[1], 10);
        return isNaN(val) ? 0 : val;
    }
    return 0;
}

// ── 1. PIPELINE KANBAN ENDPOINTS ─────────────────────────────

// GET /api/crm/pipeline — Grouped pipeline data
router.get('/pipeline', (req, res) => {
    try {
        const db = getDb();
        const roleFilter = getLeadFilterForUser(req.session ? { id: req.session.userId, role: req.session.userRole } : null);

        let whereClause = roleFilter.where;
        const params = [...roleFilter.params];

        if (req.query.agent_id) {
            whereClause += ' AND (l.assigned_agent_id = ? OR l.assigned_to = ?)';
            params.push(req.query.agent_id, req.query.agent_id);
        }
        if (req.query.category) {
            whereClause += ' AND (l.property_category = ? OR l.lead_category = ?)';
            params.push(req.query.category, req.query.category);
        }
        if (req.query.search) {
            whereClause += ' AND (l.customer_name LIKE ? OR l.phone LIKE ? OR l.lead_code LIKE ?)';
            params.push(`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`);
        }

        const leads = db.prepare(`
            SELECT 
                l.id, l.lead_code, l.customer_name, l.phone, l.email,
                l.property_category, l.budget, l.preferred_location,
                l.status, l.priority, l.assigned_agent_id, l.assigned_to,
                l.created_at, l.next_follow_up, l.next_follow_up_date,
                p.title as property_title,
                u.name as agent_name,
                (SELECT count(*) FROM follow_up_tasks WHERE lead_id = l.id AND status = 'pending') as pending_tasks_count,
                (SELECT count(*) FROM appointments WHERE lead_id = l.id) as site_visits_count
            FROM leads l
            LEFT JOIN properties p ON l.property_id = p.id
            LEFT JOIN users u ON COALESCE(l.assigned_to, l.assigned_agent_id) = u.id
            WHERE ${whereClause}
            ORDER BY l.id DESC
        `).all(...params);

        // Group into 12 pipeline stages
        const stageMap = {};
        PIPELINE_STAGES.forEach(s => {
            stageMap[s.id] = {
                ...s,
                leads: [],
                count: 0,
                totalValue: 0
            };
        });

        let grandTotalValue = 0;
        let convertedCount = 0;

        leads.forEach(lead => {
            const normalized = normalizeStatusKey(lead.status);
            const stage = stageMap[normalized] || stageMap['new'];
            const estimatedValue = parseBudgetToNumber(lead.budget);
            lead.estimatedValue = estimatedValue;

            stage.leads.push(lead);
            stage.count += 1;
            stage.totalValue += estimatedValue;

            grandTotalValue += estimatedValue;
            if (normalized === 'converted') convertedCount += 1;
        });

        const stagesList = PIPELINE_STAGES.map(s => stageMap[s.id]);
        const conversionRate = leads.length > 0 ? ((convertedCount / leads.length) * 100).toFixed(1) : 0;

        res.json({
            stages: stagesList,
            summary: {
                totalLeads: leads.length,
                totalValue: grandTotalValue,
                convertedCount,
                conversionRate: Number(conversionRate)
            }
        });
    } catch (err) {
        console.error('CRM Pipeline fetch error:', err);
        res.status(500).json({ error: 'Failed to load pipeline data' });
    }
});

// PATCH /api/crm/pipeline/move — Move lead to new pipeline stage
router.patch('/pipeline/move', (req, res) => {
    try {
        const db = getDb();
        const { lead_id, target_stage, reason } = req.body;
        if (!lead_id || !target_stage) {
            return res.status(400).json({ error: 'lead_id and target_stage are required' });
        }

        const validStage = normalizeStatusKey(target_stage);
        const stageMeta = PIPELINE_STAGES.find(s => s.id === validStage) || { name: validStage };

        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Check sales executive authorization
        const userRole = (req.session.userRole || '').toLowerCase();
        if (userRole === 'sales_executive' || userRole === 'agent') {
            const assigned = lead.assigned_to || lead.assigned_agent_id;
            if (assigned !== req.session.userId) {
                return res.status(403).json({ error: 'You are only authorized to manage your assigned leads' });
            }
        }

        const oldStatus = lead.status;
        db.prepare("UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?").run(validStage, lead_id);

        if (isPostgresConfigured()) {
            updatePgLeadStatus(lead_id, validStage).catch(() => {});
            insertPgActivity({
                lead_id,
                customer_id: lead.customer_id,
                user_id: req.session.userId,
                user_name: req.session.userName || 'Admin',
                activity_type: 'status_change',
                title: `Stage moved to ${stageMeta.name}`,
                notes: reason || `Pipeline transition from ${oldStatus} to ${stageMeta.name}`
            }).catch(() => {});
        }

        // Record in status history
        db.prepare(`
            INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by)
            VALUES (?, ?, ?, ?)
        `).run(lead_id, oldStatus, validStage, req.session.userId);

        // Record in CRM Activity timeline
        logLeadActivity(db, {
            leadId: lead_id,
            customerId: lead.customer_id,
            userId: req.session.userId,
            userName: req.session.userName || 'Admin',
            type: 'status_change',
            title: `Stage moved to ${stageMeta.name}`,
            notes: reason || `Pipeline transition from ${oldStatus} to ${stageMeta.name}`,
            metadata: { old_status: oldStatus, new_status: validStage, reason }
        });

        // Audit log
        auditLog(
            db,
            req.session.userId,
            req.session.userName,
            'pipeline_stage_change',
            'lead',
            lead_id,
            `${oldStatus} → ${validStage}`,
            req.ip
        );

        res.json({
            success: true,
            lead_id,
            old_status: oldStatus,
            new_status: validStage,
            stage_name: stageMeta.name
        });
    } catch (err) {
        console.error('Pipeline move error:', err);
        res.status(500).json({ error: 'Failed to update pipeline stage' });
    }
});

// ── 2. FOLLOW-UP TASKS ENDPOINTS ─────────────────────────────

// GET /api/crm/followups — List follow-ups with tab filter
router.get('/followups', (req, res) => {
    try {
        const db = getDb();
        const tab = req.query.tab || 'all';
        const roleFilter = getLeadFilterForUser(req.session ? { id: req.session.userId, role: req.session.userRole } : null);

        let where = '1=1';
        const params = [];

        if (roleFilter.scoped) {
            where += ' AND (t.assigned_to = ? OR l.assigned_to = ? OR l.assigned_agent_id = ?)';
            params.push(roleFilter.userId, roleFilter.userId, roleFilter.userId);
        }

        if (req.query.agent_id) {
            where += ' AND t.assigned_to = ?';
            params.push(req.query.agent_id);
        }
        if (req.query.lead_id) {
            where += ' AND t.lead_id = ?';
            params.push(req.query.lead_id);
        }

        // Tab filters
        if (tab === 'today') {
            where += " AND date(t.scheduled_at) = date('now') AND t.status = 'pending'";
        } else if (tab === 'overdue') {
            where += " AND t.scheduled_at < datetime('now') AND t.status = 'pending'";
        } else if (tab === 'upcoming') {
            where += " AND t.scheduled_at > datetime('now') AND t.status = 'pending'";
        } else if (tab === 'completed') {
            where += " AND t.status = 'completed'";
        } else if (tab === 'missed') {
            where += " AND (t.status = 'missed' OR (t.scheduled_at < datetime('now') AND t.status = 'pending'))";
        }

        const tasks = db.prepare(`
            SELECT 
                t.*,
                l.lead_code, l.customer_name, l.phone, l.status as lead_status, l.property_category,
                u.name as assigned_agent_name,
                c.name as created_by_name
            FROM follow_up_tasks t
            LEFT JOIN leads l ON t.lead_id = l.id
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN users c ON t.created_by = c.id
            WHERE ${where}
            ORDER BY t.scheduled_at ASC
        `).all(...params);

        // Counts for tab badges
        const counts = {
            today: db.prepare("SELECT count(*) as c FROM follow_up_tasks WHERE date(scheduled_at) = date('now') AND status = 'pending'").get().c,
            overdue: db.prepare("SELECT count(*) as c FROM follow_up_tasks WHERE scheduled_at < datetime('now') AND status = 'pending'").get().c,
            upcoming: db.prepare("SELECT count(*) as c FROM follow_up_tasks WHERE scheduled_at > datetime('now') AND status = 'pending'").get().c,
            completed: db.prepare("SELECT count(*) as c FROM follow_up_tasks WHERE status = 'completed'").get().c,
            all: db.prepare("SELECT count(*) as c FROM follow_up_tasks").get().c
        };

        res.json({ tasks, counts });
    } catch (err) {
        console.error('Followups list error:', err);
        res.status(500).json({ error: 'Failed to fetch follow-ups' });
    }
});

// POST /api/crm/followups — Create follow-up task
router.post('/followups', (req, res) => {
    try {
        const db = getDb();
        const { lead_id, customer_id, title, description, scheduled_at, priority, assigned_to } = req.body;

        if (!title || !scheduled_at) {
            return res.status(400).json({ error: 'Title and scheduled_at date/time are required' });
        }

        const lastTask = db.prepare("SELECT task_code FROM follow_up_tasks ORDER BY id DESC LIMIT 1").get();
        let nextNum = 1;
        if (lastTask && lastTask.task_code) {
            const m = lastTask.task_code.match(/SV-TASK-(\d+)/);
            if (m) nextNum = parseInt(m[1]) + 1;
        }
        const taskCode = `SV-TASK-${String(nextNum).padStart(5, '0')}`;
        const assignee = assigned_to ? parseInt(assigned_to) : req.session.userId;

        const result = db.prepare(`
            INSERT INTO follow_up_tasks (
                task_code, lead_id, customer_id, assigned_to, title,
                description, scheduled_at, priority, status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `).run(
            taskCode,
            lead_id || null,
            customer_id || null,
            assignee,
            title.trim(),
            description || null,
            scheduled_at,
            priority || 'medium',
            req.session.userId
        );

        // Update lead's next follow up date
        if (lead_id) {
            db.prepare(`
                UPDATE leads 
                SET next_follow_up = ?, next_follow_up_date = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(scheduled_at, scheduled_at, lead_id);

            if (isPostgresConfigured()) {
                updatePgLead(lead_id, { next_follow_up_date: scheduled_at }).catch(() => {});
            }

            logLeadActivity(db, {
                leadId: lead_id,
                customerId: customer_id || null,
                userId: req.session.userId,
                userName: req.session.userName,
                type: 'follow_up',
                title: `Scheduled Follow-up: ${title}`,
                notes: `${description || ''} · Due: ${scheduled_at}`,
                metadata: { task_code: taskCode, scheduled_at, priority }
            });
        }

        if (isPostgresConfigured()) {
            insertPgFollowup({
                task_code: taskCode,
                lead_id: lead_id || null,
                customer_id: customer_id || null,
                assigned_to: assignee,
                title: title.trim(),
                description: description || null,
                scheduled_at,
                priority: priority || 'medium',
                status: 'pending',
                created_by: req.session.userId
            }).catch(() => {});
        }

        res.status(201).json({
            message: 'Follow-up task scheduled successfully',
            task_id: result.lastInsertRowid,
            task_code: taskCode
        });
    } catch (err) {
        console.error('Create follow-up error:', err);
        res.status(500).json({ error: 'Failed to create follow-up task' });
    }
});

// PATCH /api/crm/followups/:id — Complete or Reschedule
router.patch('/followups/:id', (req, res) => {
    try {
        const db = getDb();
        const { status, result_notes, reschedule_at } = req.body;
        const task = db.prepare('SELECT * FROM follow_up_tasks WHERE id = ?').get(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });

        if (status === 'completed') {
            db.prepare(`
                UPDATE follow_up_tasks
                SET status = 'completed', completed_at = datetime('now'), result_notes = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(result_notes || 'Completed successfully', req.params.id);

            if (isPostgresConfigured()) {
                updatePgFollowup(req.params.id, {
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    result_notes: result_notes || 'Completed successfully'
                }).catch(() => {});
            }

            if (task.lead_id) {
                logLeadActivity(db, {
                    leadId: task.lead_id,
                    customerId: task.customer_id,
                    userId: req.session.userId,
                    userName: req.session.userName,
                    type: 'follow_up',
                    title: `Completed Follow-up: ${task.title}`,
                    notes: result_notes || 'Task completed'
                });
            }
        } else if (reschedule_at) {
            db.prepare(`
                UPDATE follow_up_tasks
                SET scheduled_at = ?, status = 'pending', updated_at = datetime('now')
                WHERE id = ?
            `).run(reschedule_at, req.params.id);

            if (isPostgresConfigured()) {
                updatePgFollowup(req.params.id, {
                    scheduled_at: reschedule_at,
                    status: 'pending'
                }).catch(() => {});
            }

            if (task.lead_id) {
                db.prepare("UPDATE leads SET next_follow_up = ?, next_follow_up_date = ? WHERE id = ?").run(reschedule_at, reschedule_at, task.lead_id);
                logLeadActivity(db, {
                    leadId: task.lead_id,
                    customerId: task.customer_id,
                    userId: req.session.userId,
                    userName: req.session.userName,
                    type: 'follow_up',
                    title: `Rescheduled Follow-up: ${task.title}`,
                    notes: `Rescheduled to ${reschedule_at}. Reason: ${result_notes || 'Client requested'}`
                });
            }
        }

        res.json({ message: 'Task updated successfully' });
    } catch (err) {
        console.error('Update follow-up error:', err);
        res.status(500).json({ error: 'Failed to update follow-up task' });
    }
});

// ── 3. CUSTOMER MANAGEMENT ENDPOINTS ─────────────────────────

// GET /api/crm/customers — List customer profiles
router.get('/customers', (req, res) => {
    try {
        const db = getDb();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        let where = "c.deal_status != 'inactive'";
        const params = [];

        if (req.query.search) {
            where += ' AND (c.full_name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ?)';
            params.push(`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`);
        }
        if (req.query.deal_status) {
            where += ' AND c.deal_status = ?';
            params.push(req.query.deal_status);
        }

        const total = db.prepare(`SELECT count(*) as c FROM customer_profiles c WHERE ${where}`).get(...params).c;
        const customers = db.prepare(`
            SELECT 
                c.*,
                u.name as assigned_agent_name,
                (SELECT count(*) FROM leads WHERE customer_id = c.id) as total_enquiries,
                (SELECT count(*) FROM appointments WHERE customer_id = c.id) as total_site_visits
            FROM customer_profiles c
            LEFT JOIN users u ON c.assigned_to = u.id
            WHERE ${where}
            ORDER BY c.updated_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        res.json({
            customers,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error('Customers list error:', err);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// GET /api/crm/customers/:id — Customer 360 view
router.get('/customers/:id', (req, res) => {
    try {
        const db = getDb();
        const customer = db.prepare(`
            SELECT c.*, u.name as assigned_agent_name
            FROM customer_profiles c
            LEFT JOIN users u ON c.assigned_to = u.id
            WHERE c.id = ?
        `).get(req.params.id);

        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        const leads = db.prepare(`
            SELECT l.*, p.title as property_title
            FROM leads l
            LEFT JOIN properties p ON l.property_id = p.id
            WHERE l.customer_id = ? OR l.phone = ?
            ORDER BY l.created_at DESC
        `).all(customer.id, customer.phone);

        const appointments = db.prepare(`
            SELECT a.*, p.title as property_title, u.name as agent_name
            FROM appointments a
            LEFT JOIN properties p ON a.property_id = p.id
            LEFT JOIN users u ON a.assigned_agent_id = u.id
            WHERE a.customer_id = ? OR a.phone = ?
            ORDER BY a.requested_date DESC
        `).all(customer.id, customer.phone);

        const followups = db.prepare(`
            SELECT t.*, u.name as assigned_agent_name
            FROM follow_up_tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.customer_id = ? OR t.lead_id IN (SELECT id FROM leads WHERE customer_id = ?)
            ORDER BY t.scheduled_at DESC
        `).all(customer.id, customer.id);

        const activities = db.prepare(`
            SELECT a.*, u.name as staff_name
            FROM lead_activities a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.customer_id = ? OR a.lead_id IN (SELECT id FROM leads WHERE customer_id = ?)
            ORDER BY a.created_at DESC
        `).all(customer.id, customer.id);

        res.json({
            customer,
            leads,
            appointments,
            followups,
            activities
        });
    } catch (err) {
        console.error('Customer detail error:', err);
        res.status(500).json({ error: 'Failed to fetch customer profile' });
    }
});

// POST /api/crm/leads/:id/convert-to-customer — Convert Lead to Customer Profile
router.post('/leads/:id/convert-to-customer', (req, res) => {
    try {
        const db = getDb();
        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        // Check if customer already exists for this phone
        let customer = db.prepare('SELECT * FROM customer_profiles WHERE phone = ?').get(lead.phone);
        if (!customer) {
            const custCount = db.prepare("SELECT count(*) as c FROM customer_profiles").get().c;
            const customerCode = `SV-CUST-${String(custCount + 1).padStart(5, '0')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

            const resInsert = db.prepare(`
                INSERT INTO customer_profiles (
                    customer_code, lead_id, full_name, phone, alt_phone,
                    email, preferred_locations, budget_range, property_interests,
                    deal_status, assigned_to, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
            `).run(
                customerCode,
                lead.id,
                lead.customer_name || lead.full_name || 'Customer',
                lead.phone,
                lead.whatsapp_number || null,
                lead.email || null,
                lead.preferred_location || 'Hyderabad',
                lead.budget || null,
                lead.property_category || lead.property_requirement || null,
                lead.assigned_to || lead.assigned_agent_id || req.session.userId,
                `Converted from lead ${lead.lead_code}`
            );
            customer = { id: resInsert.lastInsertRowid, customer_code: customerCode };
        }

        // Link lead to this customer
        db.prepare("UPDATE leads SET customer_id = ? WHERE id = ?").run(customer.id, lead.id);

        if (isPostgresConfigured()) {
            insertPgCustomer({
                customer_code: customer.customer_code,
                lead_id: lead.id,
                full_name: lead.customer_name || lead.full_name || 'Customer',
                phone: lead.phone,
                alt_phone: lead.whatsapp_number || null,
                email: lead.email || null,
                preferred_locations: lead.preferred_location || 'Hyderabad',
                budget_range: lead.budget || null,
                property_interests: lead.property_category || lead.property_requirement || null,
                assigned_to: lead.assigned_to || lead.assigned_agent_id || req.session.userId,
                notes: `Converted from lead ${lead.lead_code}`
            }).catch(() => {});
            updatePgLead(lead.id, { customer_id: customer.id }).catch(() => {});
        }

        logLeadActivity(db, {
            leadId: lead.id,
            customerId: customer.id,
            userId: req.session.userId,
            userName: req.session.userName,
            type: 'status_change',
            title: 'Lead Converted to Customer Profile',
            notes: `Customer record #${customer.customer_code} active`
        });

        res.json({
            success: true,
            message: 'Lead converted to customer successfully',
            customer_id: customer.id,
            customer_code: customer.customer_code
        });
    } catch (err) {
        console.error('Convert lead to customer error:', err);
        res.status(500).json({ error: 'Failed to convert lead to customer' });
    }
});

// POST /api/crm/customers/merge — Merge duplicate customers
router.post('/customers/merge', requireSuperAdmin, (req, res) => {
    try {
        const db = getDb();
        const { primary_id, duplicate_id, reason } = req.body;
        if (!primary_id || !duplicate_id || primary_id === duplicate_id) {
            return res.status(400).json({ error: 'Valid distinct primary_id and duplicate_id required' });
        }

        const primary = db.prepare('SELECT * FROM customer_profiles WHERE id = ?').get(primary_id);
        const duplicate = db.prepare('SELECT * FROM customer_profiles WHERE id = ?').get(duplicate_id);

        if (!primary || !duplicate) {
            return res.status(404).json({ error: 'One or both customer profiles not found' });
        }

        // Reassign leads from duplicate to primary
        db.prepare('UPDATE leads SET customer_id = ? WHERE customer_id = ?').run(primary.id, duplicate.id);
        // Reassign appointments
        db.prepare('UPDATE appointments SET customer_id = ? WHERE customer_id = ?').run(primary.id, duplicate.id);
        // Reassign followups
        db.prepare('UPDATE follow_up_tasks SET customer_id = ? WHERE customer_id = ?').run(primary.id, duplicate.id);
        // Reassign activities
        db.prepare('UPDATE lead_activities SET customer_id = ? WHERE customer_id = ?').run(primary.id, duplicate.id);

        // Mark duplicate as merged / inactive
        db.prepare(`
            UPDATE customer_profiles 
            SET deal_status = 'inactive', merged_into_id = ?, notes = coalesce(notes, '') || ?
            WHERE id = ?
        `).run(primary.id, ` [Merged into ${primary.customer_code}: ${reason || 'Duplicate'}]`, duplicate.id);

        auditLog(
            db,
            req.session.userId,
            req.session.userName,
            'merge_customer',
            'customer_profiles',
            primary.id,
            `Merged ${duplicate.customer_code} into ${primary.customer_code}. Reason: ${reason || 'Duplicate merge'}`,
            req.ip
        );

        res.json({
            success: true,
            message: `Customer ${duplicate.customer_code} merged into ${primary.customer_code}`
        });
    } catch (err) {
        console.error('Merge customer error:', err);
        res.status(500).json({ error: 'Failed to merge customers' });
    }
});

// ── 4. EMPLOYEE & TEAM MANAGEMENT ENDPOINTS ──────────────────

// GET /api/crm/employees — List employees with workload metrics
router.get('/employees', (req, res) => {
    try {
        const db = getDb();
        const employees = db.prepare(`
            SELECT 
                u.id, u.name, u.email, u.role, u.is_active, u.phone, u.designation, u.team_id,
                t.name as team_name,
                (SELECT count(*) FROM leads WHERE (assigned_to = u.id OR assigned_agent_id = u.id)) as assigned_leads_count,
                (SELECT count(*) FROM follow_up_tasks WHERE assigned_to = u.id AND status = 'pending') as pending_tasks_count,
                (SELECT count(*) FROM appointments WHERE assigned_agent_id = u.id AND status = 'completed') as completed_visits_count,
                (SELECT count(*) FROM leads WHERE (assigned_to = u.id OR assigned_agent_id = u.id) AND status = 'converted') as converted_count
            FROM users u
            LEFT JOIN crm_teams t ON u.team_id = t.id
            ORDER BY u.role = 'superadmin' DESC, u.name ASC
        `).all();

        res.json({ employees });
    } catch (err) {
        console.error('Employees list error:', err);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
});

// POST /api/crm/employees — Create employee (Super Admin or Admin)
router.post('/employees', requireSuperAdmin, (req, res) => {
    try {
        const db = getDb();
        const { name, email, password, role, phone, designation, team_id } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        const validRoles = ['admin', 'sales_manager', 'sales_executive', 'receptionist', 'agent'];
        const assignedRole = validRoles.includes(role) ? role : 'sales_executive';

        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (existing) {
            return res.status(400).json({ error: 'An employee with this email already exists' });
        }

        const hash = bcrypt.hashSync(password, 10);
        const result = db.prepare(`
            INSERT INTO users (name, email, password_hash, role, is_active, phone, designation, team_id)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?)
        `).run(
            name.trim(),
            email.toLowerCase().trim(),
            hash,
            assignedRole,
            phone || null,
            designation || 'Sales Executive',
            team_id ? parseInt(team_id) : null
        );

        auditLog(db, req.session.userId, req.session.userName, 'create_employee', 'users', result.lastInsertRowid, `Created ${name} (${assignedRole})`, req.ip);

        res.status(201).json({
            success: true,
            message: `Employee account created for ${name}`,
            user_id: result.lastInsertRowid
        });
    } catch (err) {
        console.error('Create employee error:', err);
        res.status(500).json({ error: 'Failed to create employee' });
    }
});

// PATCH /api/crm/employees/:id — Update employee / Toggle active
router.patch('/employees/:id', requireSuperAdmin, (req, res) => {
    try {
        const db = getDb();
        const { name, role, is_active, phone, designation, team_id } = req.body;
        const employee = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        if (employee.role === 'superadmin' && is_active === 0) {
            return res.status(400).json({ error: 'Cannot deactivate Super Admin account' });
        }

        const updatedName = name ? name.trim() : employee.name;
        const updatedRole = role || employee.role;
        const updatedActive = is_active !== undefined ? (is_active ? 1 : 0) : employee.is_active;
        const updatedPhone = phone !== undefined ? phone : employee.phone;
        const updatedDesig = designation !== undefined ? designation : employee.designation;
        const updatedTeam = team_id !== undefined ? (team_id ? parseInt(team_id) : null) : employee.team_id;

        db.prepare(`
            UPDATE users 
            SET name = ?, role = ?, is_active = ?, phone = ?, designation = ?, team_id = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(updatedName, updatedRole, updatedActive, updatedPhone, updatedDesig, updatedTeam, req.params.id);

        auditLog(db, req.session.userId, req.session.userName, 'update_employee', 'users', req.params.id, `Updated ${updatedName}`, req.ip);

        res.json({ message: 'Employee updated successfully' });
    } catch (err) {
        console.error('Update employee error:', err);
        res.status(500).json({ error: 'Failed to update employee' });
    }
});

// POST /api/crm/employees/:id/reset-password — Reset employee password
router.post('/employees/:id/reset-password', requireSuperAdmin, (req, res) => {
    try {
        const db = getDb();
        const { new_password } = req.body;
        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const employee = db.prepare('SELECT id, name FROM users WHERE id = ?').get(req.params.id);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        const hash = bcrypt.hashSync(new_password, 10);
        db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.params.id);

        auditLog(db, req.session.userId, req.session.userName, 'password_reset', 'users', req.params.id, `Reset password for ${employee.name}`, req.ip);

        res.json({ message: `Password reset successfully for ${employee.name}` });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// ── 5. BULK ASSIGNMENT & STATUS ACTIONS ──────────────────────

// POST /api/crm/leads/bulk-assign — Bulk assign leads
router.post('/leads/bulk-assign', (req, res) => {
    try {
        const db = getDb();
        const { lead_ids, agent_id } = req.body;
        if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
            return res.status(400).json({ error: 'lead_ids array is required' });
        }

        const agent = agent_id ? db.prepare('SELECT id, name FROM users WHERE id = ?').get(agent_id) : null;
        const agentName = agent ? agent.name : 'Unassigned';

        const updateStmt = db.prepare("UPDATE leads SET assigned_agent_id = ?, assigned_to = ?, updated_at = datetime('now') WHERE id = ?");
        lead_ids.forEach(id => {
            updateStmt.run(agent ? agent.id : null, agent ? agent.id : null, id);
            logLeadActivity(db, {
                leadId: id,
                userId: req.session.userId,
                userName: req.session.userName,
                type: 'assignment',
                title: `Assigned to ${agentName}`,
                notes: `Bulk assigned by ${req.session.userName}`
            });
        });

        auditLog(db, req.session.userId, req.session.userName, 'bulk_assign', 'lead', null, `Bulk assigned ${lead_ids.length} leads to ${agentName}`, req.ip);

        res.json({
            success: true,
            message: `Successfully assigned ${lead_ids.length} leads to ${agentName}`
        });
    } catch (err) {
        console.error('Bulk assign error:', err);
        res.status(500).json({ error: 'Failed to bulk assign leads' });
    }
});

// POST /api/crm/leads/bulk-status — Bulk update status
router.post('/leads/bulk-status', (req, res) => {
    try {
        const db = getDb();
        const { lead_ids, status } = req.body;
        if (!Array.isArray(lead_ids) || lead_ids.length === 0 || !status) {
            return res.status(400).json({ error: 'lead_ids array and valid status are required' });
        }

        const validStage = normalizeStatusKey(status);
        const stageMeta = PIPELINE_STAGES.find(s => s.id === validStage) || { name: validStage };

        const updateStmt = db.prepare("UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?");
        const histStmt = db.prepare("INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by) VALUES (?, (SELECT status FROM leads WHERE id = ?), ?, ?)");

        lead_ids.forEach(id => {
            histStmt.run(id, id, validStage, req.session.userId);
            updateStmt.run(validStage, id);
            logLeadActivity(db, {
                leadId: id,
                userId: req.session.userId,
                userName: req.session.userName,
                type: 'status_change',
                title: `Bulk status update to ${stageMeta.name}`,
                notes: `Updated by ${req.session.userName}`
            });
        });

        auditLog(db, req.session.userId, req.session.userName, 'bulk_status_update', 'lead', null, `Bulk updated ${lead_ids.length} leads to ${validStage}`, req.ip);

        res.json({
            success: true,
            message: `Successfully updated ${lead_ids.length} leads to ${stageMeta.name}`
        });
    } catch (err) {
        console.error('Bulk status error:', err);
        res.status(500).json({ error: 'Failed to bulk update status' });
    }
});

// ── 6. ACTIVITY TIMELINE & QUICK LOG ─────────────────────────

// POST /api/crm/activity/quick-log — Log call, whatsapp, visit, note
router.post('/activity/quick-log', (req, res) => {
    try {
        const db = getDb();
        const { lead_id, customer_id, activity_type, title, notes, outcome } = req.body;

        if (!title || !activity_type) {
            return res.status(400).json({ error: 'activity_type and title are required' });
        }

        logLeadActivity(db, {
            leadId: lead_id,
            customerId: customer_id,
            userId: req.session.userId,
            userName: req.session.userName,
            type: activity_type,
            title: title.trim(),
            notes: notes || null,
            metadata: { outcome }
        });

        if (lead_id) {
            db.prepare("UPDATE leads SET last_contacted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(lead_id);
        }

        if (isPostgresConfigured()) {
            insertPgActivity({
                lead_id: lead_id || null,
                customer_id: customer_id || null,
                user_id: req.session.userId,
                user_name: req.session.userName,
                activity_type,
                title: title.trim(),
                notes: notes || null,
                metadata: { outcome }
            }).catch(() => {});
        }

        res.status(201).json({ success: true, message: 'Activity logged successfully' });
    } catch (err) {
        console.error('Quick log error:', err);
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

// ── 7. CRM ANALYTICS & REPORTS ───────────────────────────────

// GET /api/crm/analytics — Aggregated CRM KPIs and charts
router.get('/analytics', (req, res) => {
    try {
        const db = getDb();
        const range = req.query.range || '30d';

        let dateFilter = "datetime('now', '-30 days')";
        if (range === 'today') dateFilter = "date('now')";
        else if (range === '7d') dateFilter = "datetime('now', '-7 days')";
        else if (range === 'this_month') dateFilter = "date('now', 'start of month')";
        else if (range === 'all') dateFilter = "'2000-01-01'";

        const isExactDate = range === 'today';
        const dateCond = isExactDate ? "date(l.created_at) = date('now')" : `l.created_at >= ${dateFilter}`;

        const totalLeads = db.prepare(`SELECT count(*) as c FROM leads l WHERE ${dateCond}`).get().c;
        const convertedLeads = db.prepare(`SELECT count(*) as c FROM leads l WHERE ${dateCond} AND l.status = 'converted'`).get().c;
        const siteVisitsDone = db.prepare(`SELECT count(*) as c FROM appointments a WHERE a.status = 'completed' AND a.created_at >= ${dateFilter}`).get().c;
        const activeDeals = db.prepare(`SELECT count(*) as c FROM leads l WHERE l.status IN ('negotiation', 'booking_in_progress', 'interested')`).get().c;

        // Funnel counts by stage
        const funnel = PIPELINE_STAGES.map(s => {
            const count = db.prepare(`SELECT count(*) as c FROM leads WHERE status = ?`).get(s.id).c;
            return {
                id: s.id,
                name: s.name,
                color: s.color,
                count
            };
        });

        // Source breakdown
        const sourceRows = db.prepare(`
            SELECT coalesce(source, 'website') as source_name, count(*) as count
            FROM leads l
            WHERE ${dateCond}
            GROUP BY source_name
            ORDER BY count DESC
        `).all();

        // Agent leaderboard
        const leaderboard = db.prepare(`
            SELECT 
                u.id, u.name,
                count(l.id) as total_handled,
                sum(CASE WHEN l.status = 'converted' THEN 1 ELSE 0 END) as converted_count,
                sum(CASE WHEN l.status IN ('site_visit_scheduled', 'site_visit_completed') THEN 1 ELSE 0 END) as visits_count
            FROM users u
            JOIN leads l ON (l.assigned_to = u.id OR l.assigned_agent_id = u.id)
            WHERE ${dateCond}
            GROUP BY u.id, u.name
            ORDER BY converted_count DESC, total_handled DESC
            LIMIT 5
        `).all();

        const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;

        res.json({
            range,
            kpis: {
                totalLeads,
                convertedLeads,
                conversionRate: Number(conversionRate),
                siteVisitsDone,
                activeDeals
            },
            funnel,
            sources: sourceRows,
            leaderboard
        });
    } catch (err) {
        console.error('CRM analytics error:', err);
        res.status(500).json({ error: 'Failed to generate CRM analytics' });
    }
});


// ── 8. LEAD IMPORT & DUPLICATE DETECTION ─────────────────────

// POST /api/crm/import/csv — Bulk import leads from CSV
router.post('/import/csv', (req, res) => {
    try {
        const db = getDb();
        const { csv_data } = req.body;
        if (!csv_data || typeof csv_data !== 'string') {
            return res.status(400).json({ error: 'csv_data string is required' });
        }

        const lines = csv_data.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) {
            return res.status(400).json({ error: 'CSV data is empty' });
        }

        let startIndex = 0;
        const firstLine = lines[0].toLowerCase();
        if (firstLine.includes('name') || firstLine.includes('phone') || firstLine.includes('customer')) {
            startIndex = 1; // Skip header line
        }

        let imported = 0;
        let skippedDuplicates = 0;

        const insertStmt = db.prepare(`
            INSERT INTO leads (
                lead_code, customer_name, full_name, phone, phone_number,
                email, property_requirement, property_category, budget,
                preferred_location, source, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'other', 'new', datetime('now'), datetime('now'))
        `);

        const checkDupStmt = db.prepare("SELECT id FROM leads WHERE phone = ? OR phone_number = ? LIMIT 1");
        const lastLead = db.prepare("SELECT lead_code FROM leads ORDER BY id DESC LIMIT 1").get();
        let nextNum = 1;
        if (lastLead && lastLead.lead_code) {
            const m = lastLead.lead_code.match(/SV-LEAD-(\d+)/);
            if (m) nextNum = parseInt(m[1]) + 1;
        }

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
            if (cols.length < 2) continue;

            const name = cols[0] || 'Imported Prospect';
            const rawPhone = cols[1] || '';
            const digits = rawPhone.replace(/[^0-9]/g, '');
            const cleanPhone = digits.length >= 10 ? digits.slice(-10) : digits;

            if (cleanPhone.length < 10) continue; // Invalid phone

            // Check duplicate
            const dup = checkDupStmt.get(cleanPhone, cleanPhone);
            if (dup) {
                skippedDuplicates++;
                continue;
            }

            const email = cols[2] && cols[2].includes('@') ? cols[2] : null;
            const requirement = cols[3] || 'Residential Property';
            const budget = cols[4] || 'Market Standard';
            const leadCode = `SV-LEAD-${String(nextNum).padStart(6, '0')}`;
            nextNum++;

            insertStmt.run(
                leadCode, name, name, cleanPhone, cleanPhone,
                email, requirement, requirement, budget,
                'Hyderabad'
            );
            imported++;
        }

        auditLog(db, req.session.userId, req.session.userName, 'csv_import', 'lead', null, `Imported ${imported} leads, skipped ${skippedDuplicates} duplicates`, req.ip);

        res.json({
            success: true,
            imported,
            skippedDuplicates,
            message: `Successfully imported ${imported} leads (${skippedDuplicates} duplicate numbers skipped).`
        });
    } catch (err) {
        console.error('CSV import error:', err);
        res.status(500).json({ error: 'Failed to process CSV import' });
    }
});

// POST /api/crm/leads/check-duplicate — Duplicate lead detection
router.post('/leads/check-duplicate', (req, res) => {
    try {
        const db = getDb();
        const { phone, email } = req.body;
        if (!phone && !email) {
            return res.json({ duplicate: false });
        }

        let dup = null;
        if (phone) {
            const digits = String(phone).replace(/[^0-9]/g, '');
            const clean = digits.length >= 10 ? digits.slice(-10) : digits;
            dup = db.prepare("SELECT id, lead_code, customer_name, phone, status, created_at FROM leads WHERE phone LIKE ? OR phone_number LIKE ? LIMIT 1").get(`%${clean}%`, `%${clean}%`);
        }
        if (!dup && email) {
            dup = db.prepare("SELECT id, lead_code, customer_name, email, status, created_at FROM leads WHERE lower(email) = lower(?) LIMIT 1").get(email.trim());
        }

        if (dup) {
            return res.json({ duplicate: true, lead: dup });
        }
        res.json({ duplicate: false });
    } catch (err) {
        res.status(500).json({ error: 'Error checking duplicate' });
    }
});

module.exports = router;
