/**
 * Appointments (Site Visits) API
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../../database/db');
const { requireAuth, auditLog, notifyAllAdmins, logLeadActivity } = require('../../middleware/auth');
const { sanitizeObject, validatePhone } = require('../../middleware/validation');
const {
    isPostgresConfigured,
    insertAppointment: insertPgAppointment,
    fetchAppointments: fetchPgAppointments
} = require('../../database/postgres');

function generateAppointmentCode() {
    const db = getDb();
    const last = db.prepare("SELECT appointment_code FROM appointments ORDER BY id DESC LIMIT 1").get();
    let nextNum = 1;
    if (last && last.appointment_code) {
        const match = last.appointment_code.match(/SV-VISIT-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
    }
    return `SV-VISIT-${String(nextNum).padStart(5, '0')}`;
}

// POST /api/appointments/public — Request site visit (public)
router.post('/public', async (req, res) => {
    try {
        const db = getDb();
        const data = sanitizeObject(req.body);
        const customerName = (data.customer_name || data.full_name || data.name || '').trim();
        const phone = (data.phone || data.phone_number || '').trim();
        const requestedDate = (data.requested_date || data.preferred_date || data.appointment_date || '').trim();
        const requestedTime = (data.requested_time || data.preferred_time || data.appointment_time || '10:00 AM - 12:00 PM').trim();

        if (!customerName || !phone || !requestedDate) {
            return res.status(400).json({ error: 'Name, phone, and preferred date are required' });
        }
        if (!validatePhone(phone)) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        const appointmentCode = generateAppointmentCode();

        let propertyId = null;
        if (data.property_id) {
            const pid = parseInt(data.property_id, 10);
            if (!isNaN(pid)) {
                const found = db.prepare('SELECT id FROM properties WHERE id = ?').get(pid);
                if (found) propertyId = pid;
            }
        }

        let leadId = null;
        if (data.lead_id) {
            const lid = parseInt(data.lead_id, 10);
            if (!isNaN(lid)) {
                const found = db.prepare('SELECT id FROM leads WHERE id = ?').get(lid);
                if (found) leadId = lid;
            }
        }

        // ── PostgreSQL / Supabase Cloud Database Persistence ──────
        if (isPostgresConfigured()) {
            try {
                await insertPgAppointment({
                    appointment_code: appointmentCode,
                    lead_id: leadId,
                    property_id: propertyId,
                    customer_name: customerName,
                    phone: phone,
                    notes: data.notes || null,
                    requested_date: requestedDate,
                    requested_time: requestedTime,
                    status: 'requested'
                });
                console.log(`✅ [POSTGRES] Stored appointment ${appointmentCode} in cloud DB`);
            } catch (pgErr) {
                console.error('❌ [POSTGRES] insertAppointment error:', pgErr.message);
            }
        }

        const result = db.prepare(`
            INSERT INTO appointments (
                appointment_code, lead_id, property_id, customer_name, phone,
                notes, requested_date, requested_time, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested')
        `).run(
            appointmentCode,
            leadId,
            propertyId,
            customerName,
            phone,
            data.notes || null,
            requestedDate,
            requestedTime
        );

        // Notify admins
        const propertyTitle = data.property_id
            ? db.prepare('SELECT title FROM properties WHERE id = ?').get(data.property_id)?.title
            : 'General';

        notifyAllAdmins(db, 'appointment',
            'New Site Visit Request',
            `${data.customer_name} requested a site visit for ${propertyTitle} on ${data.requested_date}. Ref: ${appointmentCode}`,
            '/admin/appointments'
        );

        res.status(201).json({
            message: 'Site visit request submitted. Our team will confirm your visit shortly.',
            appointment_code: appointmentCode
        });
    } catch (err) {
        console.error('Create appointment error:', err);
        res.status(500).json({ error: 'Failed to submit site visit request' });
    }
});

// GET /api/appointments — List appointments (admin)
router.get('/', requireAuth, async (req, res) => {
    const db = getDb();
    const status = req.query.status || '';

    if (isPostgresConfigured()) {
        try {
            const pgResult = await fetchPgAppointments({ status });
            if (pgResult.success && pgResult.data.length > 0) {
                const appointments = pgResult.data.map(a => ({
                    id: a.id,
                    appointment_code: a.appointment_code,
                    customer_name: a.customer_name,
                    phone: a.phone,
                    requested_date: a.requested_date,
                    requested_time: a.requested_time,
                    confirmed_date: a.confirmed_date,
                    confirmed_time: a.confirmed_time,
                    status: a.status,
                    notes: a.notes,
                    property_title: 'Direct Enquiry',
                    agent_name: 'Unassigned'
                }));
                return res.json({ appointments });
            }
        } catch (pgErr) {
            console.error('Error fetching appointments from PostgreSQL in API:', pgErr);
        }
    }

    let where = '1=1';
    const params = [];
    if (status) { where += ' AND a.status = ?'; params.push(status); }

    const appointments = db.prepare(`
        SELECT a.*, p.title as property_title, u.name as agent_name
        FROM appointments a
        LEFT JOIN properties p ON a.property_id = p.id
        LEFT JOIN users u ON a.assigned_agent_id = u.id
        WHERE ${where}
        ORDER BY a.requested_date ASC
    `).all(...params);

    res.json({ appointments });
});

// PATCH /api/appointments/:id — Update appointment
router.patch('/:id', requireAuth, (req, res) => {
    const db = getDb();
    const { status, confirmed_date, confirmed_time, assigned_agent_id, result_notes, feedback_rating, feedback_notes, customer_id } = req.body;

    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    const updates = [];
    const params = [];

    if (status) { updates.push('status = ?'); params.push(status); }
    if (confirmed_date !== undefined) { updates.push('confirmed_date = ?'); params.push(confirmed_date); }
    if (confirmed_time !== undefined) { updates.push('confirmed_time = ?'); params.push(confirmed_time); }
    if (assigned_agent_id !== undefined) { updates.push('assigned_agent_id = ?'); params.push(assigned_agent_id); }
    if (result_notes !== undefined) { updates.push('result_notes = ?'); params.push(result_notes); }
    if (feedback_rating !== undefined) { updates.push('feedback_rating = ?'); params.push(feedback_rating); }
    if (feedback_notes !== undefined) { updates.push('feedback_notes = ?'); params.push(feedback_notes); }
    if (customer_id !== undefined) { updates.push('customer_id = ?'); params.push(customer_id); }

    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    updates.push("updated_at = datetime('now')");
    params.push(req.params.id);

    db.prepare(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Sync to persistent cloud database (Supabase / PostgreSQL)
    if (isPostgresConfigured()) {
        try {
            const { updateAppointment } = require('../../database/postgres');
            updateAppointment(req.params.id, {
                status, confirmed_date, confirmed_time, assigned_agent_id, result_notes, feedback_rating, feedback_notes, customer_id
            }).catch(e => console.error('Cloud appointment update error:', e));
        } catch (pgErr) {
            console.error('PostgreSQL appointment update error:', pgErr);
        }
    }

    // Activity timeline & CRM lead synchronization
    const leadId = appointment.lead_id || (appointment.phone ? db.prepare('SELECT id FROM leads WHERE phone_number = ? OR phone = ? ORDER BY id DESC LIMIT 1').get(appointment.phone, appointment.phone)?.id : null);
    const resolvedCustomerId = appointment.customer_id || customer_id || (leadId ? db.prepare('SELECT customer_id FROM leads WHERE id = ?').get(leadId)?.customer_id : null);

    if (leadId || resolvedCustomerId) {
        const newStatus = status || appointment.status;
        const noteText = result_notes || feedback_notes || `Site visit (${appointment.appointment_code}) status changed to ${newStatus}`;
        logLeadActivity(db, {
            lead_id: leadId,
            customer_id: resolvedCustomerId,
            user_id: req.session.userId,
            user_name: req.session.userName,
            activity_type: 'site_visit',
            title: `Site Visit: ${newStatus.replace('_', ' ').toUpperCase()} (${appointment.appointment_code})`,
            notes: noteText,
            metadata: {
                appointment_id: appointment.id,
                appointment_code: appointment.appointment_code,
                status: newStatus,
                date: confirmed_date || appointment.confirmed_date || appointment.requested_date,
                notes: result_notes
            }
        });

        // Auto-progress lead pipeline stage if applicable
        if (leadId && status === 'completed') {
            const lead = db.prepare('SELECT status FROM leads WHERE id = ?').get(leadId);
            if (lead && ['new', 'not_contacted', 'contacted', 'qualified', 'interested', 'site_visit_scheduled'].includes(lead.status)) {
                db.prepare("UPDATE leads SET status = 'site_visit_completed', updated_at = datetime('now') WHERE id = ?").run(leadId);
                logLeadActivity(db, {
                    lead_id: leadId,
                    customer_id: resolvedCustomerId,
                    user_id: req.session.userId,
                    user_name: req.session.userName,
                    activity_type: 'status_change',
                    title: 'Lead Pipeline Auto-Progressed: Site Visit Completed',
                    notes: `Lead automatically updated to site_visit_completed upon completion of visit ${appointment.appointment_code}`
                });
            }
        } else if (leadId && status === 'confirmed') {
            const lead = db.prepare('SELECT status FROM leads WHERE id = ?').get(leadId);
            if (lead && ['new', 'not_contacted', 'contacted', 'qualified', 'interested'].includes(lead.status)) {
                db.prepare("UPDATE leads SET status = 'site_visit_scheduled', updated_at = datetime('now') WHERE id = ?").run(leadId);
                logLeadActivity(db, {
                    lead_id: leadId,
                    customer_id: resolvedCustomerId,
                    user_id: req.session.userId,
                    user_name: req.session.userName,
                    activity_type: 'status_change',
                    title: 'Lead Pipeline Auto-Progressed: Site Visit Scheduled',
                    notes: `Lead updated to site_visit_scheduled upon confirmation of visit ${appointment.appointment_code}`
                });
            }
        }
    }

    auditLog(db, req.session.userId, req.session.userName, 'update', 'appointment', req.params.id,
        `Status: ${status || appointment.status}`, req.ip);

    res.json({ message: 'Appointment updated' });
});

module.exports = router;
