/**
 * Lead Management API
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../../database/db');
const { requireAuth, auditLog, notifyAllAdmins } = require('../../middleware/auth');
const { sanitizeObject, validateEnquiryData } = require('../../middleware/validation');
const { insertEnquiry, fetchEnquiries, getEnquiryById, isMySqlConfigured, updateEnquiryStatus } = require('../../database/mysql');

// Generate unique lead code
function generateLeadCode() {
    const db = getDb();
    const lastLead = db.prepare("SELECT lead_code FROM leads ORDER BY id DESC LIMIT 1").get();
    let nextNum = 1;
    if (lastLead && lastLead.lead_code) {
        const match = lastLead.lead_code.match(/SV-LEAD-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
    }
    return `SV-LEAD-${String(nextNum).padStart(6, '0')}`;
}

// ── Public Endpoint ───────────────────────────────────────

// POST /api/leads/public — Submit enquiry (public)
router.post('/public', async (req, res) => {
    try {
        const db = getDb();
        const data = sanitizeObject(req.body);
        const errors = validateEnquiryData(data);
        if (errors.length > 0) return res.status(400).json({ errors });

        const leadCode = generateLeadCode();

        // Normalize customer name
        const customerName = (data.full_name || data.customer_name || 'Interested Buyer').trim();

        // Normalize phone number (handle +91, spaces, dashes)
        const rawPhone = String(data.phone_number || data.phone || '').trim();
        const digitsOnly = rawPhone.replace(/[^0-9]/g, '');
        const cleanPhone = digitsOnly.length === 12 && digitsOnly.startsWith('91') ? digitsOnly.slice(2) : (digitsOnly.length >= 10 ? digitsOnly.slice(-10) : rawPhone);

        // Normalize appointment date and time
        const appointmentDate = data.appointment_date || data.preferred_visit_date || null;
        const appointmentTime = data.appointment_time || '10:00 AM - 12:00 PM';

        // Normalize property requirement
        const propertyReq = data.property_requirement || data.property_category || 'Residential Plot';

        // Prevent rapid accidental double-clicks (same phone within 2 seconds)
        const recent = db.prepare(`
            SELECT id FROM leads 
            WHERE (phone = ? OR phone_number = ?) AND created_at > datetime('now', '-2 seconds')
        `).get(cleanPhone, cleanPhone);
        if (recent) {
            return res.status(409).json({ 
                error: 'Enquiry received! Our team will contact you shortly.',
                lead_code: null
            });
        }

        // Normalize source to allowed enum values in DB schema
        const validSources = ['website', 'chatbot', 'phone', 'walkin', 'referral', 'other'];
        const source = (data.source && validSources.includes(data.source)) ? data.source : 'website';

        // Normalize contact preference
        const validPrefs = ['phone', 'whatsapp', 'email', 'any'];
        const contactPref = (data.contact_preference && validPrefs.includes(data.contact_preference)) ? data.contact_preference : 'phone';

        console.log(`\n🔔 [NEW ENQUIRY RECEIVED] Code: ${leadCode} | Name: ${customerName} | Phone: ${cleanPhone} | Requirement: ${propertyReq} | Date: ${appointmentDate || 'Immediate'} ${appointmentTime}`);

        // ── MySQL Database Persistence ────────────────────────────
        let mysqlRecord = null;
        if (isMySqlConfigured()) {
            const todayStr = new Date().toISOString().slice(0, 10);
            const sqlResult = await insertEnquiry({
                full_name: customerName,
                phone_number: cleanPhone,
                appointment_date: appointmentDate || todayStr,
                appointment_time: appointmentTime,
                property_requirement: propertyReq,
                email: data.email || null,
                message: data.message || null,
                status: 'New'
            });

            if (!sqlResult.success && !sqlResult.notConfigured) {
                console.error('❌ MySQL insert failed:', sqlResult.error);
                return res.status(500).json({ 
                    error: `Database error: Failed to save enquiry to MySQL (${sqlResult.error})` 
                });
            }
            mysqlRecord = sqlResult.data;
            console.log(`✅ [MYSQL] Successfully stored enquiry #${mysqlRecord ? mysqlRecord.id : 'OK'} for ${customerName}`);
        }

        const result = db.prepare(`
            INSERT INTO leads (
                lead_code, customer_name, full_name, phone, phone_number, email, property_id,
                property_category, property_requirement, budget, preferred_location,
                message, contact_preference, preferred_visit_date, appointment_date, appointment_time,
                consent, source, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'new')
        `).run(
            leadCode,
            customerName,
            customerName,
            cleanPhone,
            cleanPhone,
            data.email || null,
            data.property_id ? parseInt(data.property_id) : null,
            propertyReq,
            propertyReq,
            data.budget || 'Consult / Market Price',
            data.preferred_location || 'Hyderabad',
            data.message || `Requirement: ${propertyReq}`,
            contactPref,
            appointmentDate,
            appointmentDate,
            appointmentTime,
            source
        );

        // Record initial status in history
        db.prepare(`
            INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by)
            VALUES (?, NULL, 'new', NULL)
        `).run(result.lastInsertRowid);

        // If appointment date is provided, create linked site visit appointment record
        if (appointmentDate) {
            try {
                const lastApt = db.prepare("SELECT appointment_code FROM appointments ORDER BY id DESC LIMIT 1").get();
                let aptNum = 1;
                if (lastApt && lastApt.appointment_code) {
                    const match = lastApt.appointment_code.match(/SV-VISIT-(\d+)/);
                    if (match) aptNum = parseInt(match[1]) + 1;
                }
                const aptCode = `SV-VISIT-${String(aptNum).padStart(5, '0')}`;
                db.prepare(`
                    INSERT INTO appointments (
                        appointment_code, lead_id, property_id, customer_name, phone,
                        notes, requested_date, requested_time, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested')
                `).run(
                    aptCode,
                    result.lastInsertRowid,
                    data.property_id ? parseInt(data.property_id) : null,
                    customerName,
                    cleanPhone,
                    `Customer requirement: ${propertyReq}`,
                    appointmentDate,
                    appointmentTime
                );
            } catch (aptErr) {
                console.error('Error creating linked appointment for lead:', aptErr);
            }
        }

        // Notify admins
        const propertyInfo = data.property_id 
            ? db.prepare('SELECT title FROM properties WHERE id = ?').get(data.property_id)
            : null;
        
        const visitText = appointmentDate ? ` · Visit: ${appointmentDate} (${appointmentTime})` : '';
        notifyAllAdmins(db, 'lead',
            `New Enquiry: ${customerName}`,
            `${customerName} (${cleanPhone}) · Looking for: ${propertyReq}${visitText}${propertyInfo ? ` · Prop: ${propertyInfo.title}` : ''}. Ref: ${leadCode}`,
            `/admin/leads/${result.lastInsertRowid}`
        );
        
        res.status(201).json({
            message: `Thank you for contacting SV Real Estates Hyderabad. Your enquiry has been received.`,
            lead_code: leadCode,
            reference: leadCode
        });
    } catch (err) {
        console.error('Create lead error:', err);
        res.status(500).json({ error: 'Failed to submit enquiry. Please try again.' });
    }
});

// ── Admin Endpoints ───────────────────────────────────────

// GET /api/leads — List leads (admin)
router.get('/', requireAuth, async (req, res) => {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    if (isMySqlConfigured()) {
        try {
            const sqlResult = await fetchEnquiries({
                status: req.query.status,
                search: req.query.search,
                limit,
                offset
            });
            if (sqlResult.success && sqlResult.data.length > 0) {
                const leads = sqlResult.data.map(e => ({
                    id: e.id,
                    lead_code: e.lead_code || `SV-ENQ-${String(e.id).padStart(5, '0')}`,
                    full_name: e.full_name,
                    customer_name: e.full_name,
                    phone_number: e.phone_number,
                    phone: e.phone_number,
                    appointment_date: e.appointment_date,
                    appointment_time: e.appointment_time,
                    property_requirement: e.property_requirement,
                    property_category: e.property_requirement,
                    status: (e.status || 'New').toLowerCase(),
                    created_at: e.created_at,
                    property_title: null,
                    agent_name: 'Unassigned'
                }));
                return res.json({ leads, total: sqlResult.count, page, totalPages: Math.ceil(sqlResult.count / limit) });
            }
        } catch (sqlErr) {
            console.error('Error fetching leads from MySQL in API:', sqlErr);
        }
    }

    let where = '1=1';
    const params = [];
    if (req.query.status) { where += ' AND l.status = ?'; params.push(req.query.status); }
    if (req.query.search) {
        where += ' AND (l.customer_name LIKE ? OR l.phone LIKE ? OR l.lead_code LIKE ?)';
        params.push(`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM leads l WHERE ${where}`).get(...params).count;
    const leads = db.prepare(`
        SELECT l.*, p.title as property_title, u.name as agent_name
        FROM leads l
        LEFT JOIN properties p ON l.property_id = p.id
        LEFT JOIN users u ON l.assigned_agent_id = u.id
        WHERE ${where}
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({ leads, total, page, totalPages: Math.ceil(total / limit) });
});

// GET /api/leads/:id — Lead detail (admin)
router.get('/:id', requireAuth, async (req, res) => {
    const db = getDb();
    let lead = null;

    if (isMySqlConfigured()) {
        try {
            const sqlResult = await getEnquiryById(req.params.id);
            if (sqlResult.success && sqlResult.data) {
                const e = sqlResult.data;
                lead = {
                    id: e.id,
                    lead_code: e.lead_code || `SV-ENQ-${String(e.id).padStart(5, '0')}`,
                    full_name: e.full_name,
                    customer_name: e.full_name,
                    phone_number: e.phone_number,
                    phone: e.phone_number,
                    appointment_date: e.appointment_date,
                    appointment_time: e.appointment_time,
                    property_requirement: e.property_requirement,
                    property_category: e.property_requirement,
                    status: (e.status || 'New').toLowerCase(),
                    created_at: e.created_at,
                    source: e.source || 'website',
                    message: e.message || `Requirement: ${e.property_requirement}`,
                    property_title: null,
                    agent_name: 'Unassigned'
                };
                return res.json({ lead, notes: [], statusHistory: [] });
            }
        } catch (sqlErr) {
            console.error('Error fetching lead detail from MySQL in API:', sqlErr);
        }
    }

    lead = db.prepare(`
        SELECT l.*, p.title as property_title, p.property_code, u.name as agent_name
        FROM leads l
        LEFT JOIN properties p ON l.property_id = p.id
        LEFT JOIN users u ON l.assigned_agent_id = u.id
        WHERE l.id = ?
    `).get(req.params.id);

    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const notes = db.prepare(`
        SELECT n.*, u.name as user_name
        FROM lead_notes n LEFT JOIN users u ON n.user_id = u.id
        WHERE n.lead_id = ? ORDER BY n.created_at DESC
    `).all(lead.id);

    const statusHistory = db.prepare(`
        SELECT h.*, u.name as changed_by_name
        FROM lead_status_history h LEFT JOIN users u ON h.changed_by = u.id
        WHERE h.lead_id = ? ORDER BY h.created_at DESC
    `).all(lead.id);

    res.json({ lead, notes, statusHistory });
});

// PATCH or PUT /api/leads/:id/status — Update lead status
const handleStatusUpdate = (req, res) => {
    const db = getDb();
    const { status } = req.body;
    const validStatuses = ['new', 'contacted', 'interested', 'site_visit_scheduled', 'negotiation', 'converted', 'lost', 'spam'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const lead = db.prepare('SELECT status FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    db.prepare("UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);
    db.prepare(`
        INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by)
        VALUES (?, ?, ?, ?)
    `).run(req.params.id, lead.status, status, req.session.userId);

    // Auto-add system note
    db.prepare(`
        INSERT INTO lead_notes (lead_id, user_id, note, note_type)
        VALUES (?, ?, ?, 'status_change')
    `).run(req.params.id, req.session.userId, `Status changed from "${lead.status}" to "${status}"`);

    // Sync to MySQL if configured
    if (isMySqlConfigured()) {
        updateEnquiryStatus(req.params.id, status).catch(sqlErr => {
            console.error('MySQL status update error:', sqlErr);
        });
    }

    auditLog(db, req.session.userId, req.session.userName, 'update_status', 'lead', req.params.id, `${lead.status} → ${status}`, req.ip);
    res.json({ message: 'Status updated' });
};

router.patch('/:id/status', requireAuth, handleStatusUpdate);
router.put('/:id/status', requireAuth, handleStatusUpdate);

// PATCH /api/leads/:id/assign — Assign agent
router.patch('/:id/assign', requireAuth, (req, res) => {
    const db = getDb();
    const { agent_id } = req.body;
    db.prepare("UPDATE leads SET assigned_agent_id = ?, updated_at = datetime('now') WHERE id = ?").run(agent_id || null, req.params.id);
    
    const agentName = agent_id ? db.prepare('SELECT name FROM users WHERE id = ?').get(agent_id)?.name : 'Unassigned';
    db.prepare(`
        INSERT INTO lead_notes (lead_id, user_id, note, note_type)
        VALUES (?, ?, ?, 'system')
    `).run(req.params.id, req.session.userId, `Assigned to ${agentName}`);

    auditLog(db, req.session.userId, req.session.userName, 'assign_agent', 'lead', req.params.id, `Assigned to ${agentName}`, req.ip);
    res.json({ message: 'Agent assigned' });
});

// POST /api/leads/:id/notes — Add note
router.post('/:id/notes', requireAuth, (req, res) => {
    const db = getDb();
    const { note, note_type } = req.body;
    if (!note || !note.trim()) return res.status(400).json({ error: 'Note is required' });

    const result = db.prepare(`
        INSERT INTO lead_notes (lead_id, user_id, note, note_type)
        VALUES (?, ?, ?, ?)
    `).run(req.params.id, req.session.userId, note.trim(), note_type || 'note');

    res.json({ id: result.lastInsertRowid, message: 'Note added' });
});

// PATCH /api/leads/:id/follow-up — Set follow-up date
router.patch('/:id/follow-up', requireAuth, (req, res) => {
    const db = getDb();
    const { next_follow_up } = req.body;
    db.prepare("UPDATE leads SET next_follow_up = ?, updated_at = datetime('now') WHERE id = ?").run(next_follow_up || null, req.params.id);
    res.json({ message: 'Follow-up date updated' });
});

// GET /api/leads/export/csv — Export leads to CSV
router.get('/export/csv', requireAuth, (req, res) => {
    const db = getDb();
    const leads = db.prepare(`
        SELECT l.lead_code, l.customer_name, l.phone, l.email, l.budget,
            l.message, l.status, l.contact_preference, l.created_at,
            p.title as property_title, u.name as agent_name
        FROM leads l
        LEFT JOIN properties p ON l.property_id = p.id
        LEFT JOIN users u ON l.assigned_agent_id = u.id
        ORDER BY l.created_at DESC
    `).all();

    const headers = ['Lead Code', 'Customer Name', 'Phone', 'Email', 'Budget', 'Message', 'Status', 'Contact Preference', 'Property', 'Agent', 'Date'];
    const csv = [
        headers.join(','),
        ...leads.map(l => [
            l.lead_code, `"${l.customer_name}"`, l.phone, l.email || '',
            l.budget || '', `"${(l.message || '').replace(/"/g, '""')}"`,
            l.status, l.contact_preference, `"${l.property_title || ''}"`,
            l.agent_name || '', l.created_at
        ].join(','))
    ].join('\n');

    auditLog(db, req.session.userId, req.session.userName, 'export', 'lead', null, 'CSV export', req.ip);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=sv-leads-${new Date().toISOString().slice(0,10)}.csv`);
    res.send(csv);
});

module.exports = router;
