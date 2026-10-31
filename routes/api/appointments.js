/**
 * Appointments (Site Visits) API
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../../database/db');
const { requireAuth, auditLog, notifyAllAdmins } = require('../../middleware/auth');
const { sanitizeObject, validatePhone } = require('../../middleware/validation');
const {
    cloudLeadsConfigured,
    submitCloudAppointment,
    listCloudAppointments,
    updateCloudAppointment
} = require('../../database/cloud-leads');
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
        const match = last.appointment_code.match(/SV-VISIT-(\\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
    }
    return `SV-VISIT-${String(nextNum).padStart(5, '0')}`;
}

// POST /api/appointments/public — Request site visit (public)
router.post('/public', async (req, res) => {
    try {
        const data = sanitizeObject(req.body);
        const customerName = String(data.customer_name || data.full_name || data.name || '').trim();
        const rawPhone = String(data.phone || data.phone_number || '').trim();
        const requestedDate = String(data.requested_date || data.preferred_date || data.appointment_date || '').trim();
        const requestedTime = String(data.requested_time || data.preferred_time || data.appointment_time || '').trim();

        if (!customerName || customerName.length < 2 || !rawPhone || !requestedDate) {
            return res.status(400).json({ error: 'Name, phone, and preferred date are required' });
        }
        if (!validatePhone(rawPhone)) return res.status(400).json({ error: 'Invalid phone number' });

        const digits = rawPhone.replace(/\\D/g, '');
        const phone = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.slice(-10);
        const appointmentCode = `SV-VISIT-${Date.now().toString(36).toUpperCase()}`;
        const payload = {
            appointment_code: appointmentCode,
            customer_name: customerName,
            phone,
            notes: data.notes || null,
            requested_date: requestedDate,
            requested_time: requestedTime || null,
            property_id: data.property_id ? Number(data.property_id) : null,
            lead_id: data.lead_id ? Number(data.lead_id) : null,
            status: 'requested'
        };

        if (process.env.VERCEL) {
            if (!cloudLeadsConfigured()) return res.status(503).json({ error: 'The site-visit service is temporarily unavailable.' });
            const saved = await submitCloudAppointment(payload);
            if (!saved.success || !saved.data) {
                console.error('[APPOINTMENT] Supabase did not confirm persistence:', saved.error || 'No saved row returned');
                return res.status(503).json({ error: 'We could not confirm that your site visit request was saved. Please try again or call our office.' });
            }
            return res.status(201).json({
                message: 'Site visit request submitted. Our team will confirm your visit shortly.',
                appointment_code: saved.data.appointment_code || appointmentCode
            });
        }

        const db = getDb();
        let propertyId = null;
        if (payload.property_id) {
            const found = db.prepare('SELECT id FROM properties WHERE id = ?').get(payload.property_id);
            if (found) propertyId = payload.property_id;
        }
        let leadId = null;
        if (payload.lead_id) {
            const found = db.prepare('SELECT id FROM leads WHERE id = ?').get(payload.lead_id);
            if (found) leadId = payload.lead_id;
        }

        if (isPostgresConfigured()) {
            const cloudResult = await insertPgAppointment({ ...payload, property_id: propertyId, lead_id: leadId });
            if (!cloudResult.success && !cloudResult.notConfigured) {
                return res.status(503).json({ error: 'Could not save the site visit request. Please try again.' });
            }
        }

        const result = db.prepare(`
            INSERT INTO appointments (
                appointment_code, lead_id, property_id, customer_name, phone,
                notes, requested_date, requested_time, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested')
        `).run(appointmentCode, leadId, propertyId, customerName, phone, data.notes || null, requestedDate, requestedTime || null);

        const propertyTitle = propertyId
            ? db.prepare('SELECT title FROM properties WHERE id = ?').get(propertyId)?.title
            : 'General';
        notifyAllAdmins(db, 'appointment', 'New Site Visit Request',
            `${customerName} requested a site visit for ${propertyTitle} on ${requestedDate}. Ref: ${appointmentCode}`,
            '/admin/appointments');
        return res.status(201).json({
            message: 'Site visit request submitted. Our team will confirm your visit shortly.',
            appointment_code: appointmentCode,
            id: result.lastInsertRowid
        });
    } catch (err) {
        console.error('Create appointment error:', err);
        return res.status(500).json({ error: 'Failed to submit site visit request' });
    }
});

// GET /api/appointments — List appointments (admin)
router.get('/', requireAuth, async (req, res) => {
    const status = req.query.status || '';
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).json({ error: 'Production appointments database is not configured.' });
        const result = await listCloudAppointments({ status, limit: 100, offset: 0 });
        if (!result.success) return res.status(502).json({ error: result.error || 'Could not load site visits.' });
        return res.json({ appointments: result.data || [], total: Number(result.count || 0) });
    }

    const db = getDb();
    if (isPostgresConfigured()) {
        try {
            const pgResult = await fetchPgAppointments({ status });
            if (pgResult.success) return res.json({ appointments: pgResult.data || [] });
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
    return res.json({ appointments });
});

// PATCH /api/appointments/:id — Update appointment
router.patch('/:id', requireAuth, async (req, res) => {
    const { status, confirmed_date, confirmed_time, assigned_agent_id, result_notes, notes } = req.body || {};
    const patch = {};
    if (status !== undefined) patch.status = status;
    if (confirmed_date !== undefined) patch.confirmed_date = confirmed_date;
    if (confirmed_time !== undefined) patch.confirmed_time = confirmed_time;
    if (assigned_agent_id !== undefined) patch.assigned_agent_id = assigned_agent_id;
    if (result_notes !== undefined) patch.notes = result_notes;
    if (notes !== undefined) patch.notes = notes;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'No updates provided' });

    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).json({ error: 'Production appointments database is not configured.' });
        const result = await updateCloudAppointment(req.params.id, patch);
        if (!result.success) return res.status(502).json({ error: result.error || 'Could not update site visit.' });
        return res.json({ message: 'Appointment updated' });
    }

    const db = getDb();
    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    const updates = [];
    const params = [];
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (confirmed_date !== undefined) { updates.push('confirmed_date = ?'); params.push(confirmed_date); }
    if (confirmed_time !== undefined) { updates.push('confirmed_time = ?'); params.push(confirmed_time); }
    if (assigned_agent_id !== undefined) { updates.push('assigned_agent_id = ?'); params.push(assigned_agent_id); }
    if (result_notes !== undefined || notes !== undefined) { updates.push('notes = ?'); params.push(notes !== undefined ? notes : result_notes); }
    if (!updates.length) return res.status(400).json({ error: 'No updates provided' });
    updates.push("updated_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    auditLog(db, req.session.userId, req.session.userName, 'update', 'appointment', req.params.id,
        `Status: ${status || appointment.status}`, req.ip);
    return res.json({ message: 'Appointment updated' });
});

module.exports = router;
