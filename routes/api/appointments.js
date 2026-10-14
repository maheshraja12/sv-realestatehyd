/**
 * Appointments (Site Visits) API
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../../database/db');
const { requireAuth, auditLog, notifyAllAdmins } = require('../../middleware/auth');
const { sanitizeObject, validatePhone } = require('../../middleware/validation');

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
router.post('/public', (req, res) => {
    try {
        const db = getDb();
        const data = sanitizeObject(req.body);

        if (!data.customer_name || !data.phone || !data.requested_date) {
            return res.status(400).json({ error: 'Name, phone, and preferred date are required' });
        }
        if (!validatePhone(data.phone)) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        const appointmentCode = generateAppointmentCode();

        const result = db.prepare(`
            INSERT INTO appointments (
                appointment_code, lead_id, property_id, customer_name, phone,
                notes, requested_date, requested_time, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested')
        `).run(
            appointmentCode,
            data.lead_id ? parseInt(data.lead_id) : null,
            data.property_id ? parseInt(data.property_id) : null,
            data.customer_name,
            data.phone,
            data.notes || null,
            data.requested_date,
            data.requested_time || null
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
router.get('/', requireAuth, (req, res) => {
    const db = getDb();
    const status = req.query.status || '';
    
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
    const { status, confirmed_date, confirmed_time, assigned_agent_id, result_notes } = req.body;

    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    const updates = [];
    const params = [];

    if (status) { updates.push('status = ?'); params.push(status); }
    if (confirmed_date !== undefined) { updates.push('confirmed_date = ?'); params.push(confirmed_date); }
    if (confirmed_time !== undefined) { updates.push('confirmed_time = ?'); params.push(confirmed_time); }
    if (assigned_agent_id !== undefined) { updates.push('assigned_agent_id = ?'); params.push(assigned_agent_id); }
    if (result_notes !== undefined) { updates.push('result_notes = ?'); params.push(result_notes); }

    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    updates.push("updated_at = datetime('now')");
    params.push(req.params.id);

    db.prepare(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    auditLog(db, req.session.userId, req.session.userName, 'update', 'appointment', req.params.id,
        `Status: ${status || appointment.status}`, req.ip);

    res.json({ message: 'Appointment updated' });
});

module.exports = router;
