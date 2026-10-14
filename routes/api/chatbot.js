/**
 * AI Chatbot API — Property search & enquiry via chatbot
 * This provides endpoints the chatbot widget uses to search properties
 * and submit enquiries through the same backend as the website.
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../../database/db');
const { sanitize, validatePhone } = require('../../middleware/validation');

// POST /api/chatbot/search — Search properties by criteria
router.post('/search', (req, res) => {
    try {
        const db = getDb();
        const { query, category, min_budget, max_budget, bedrooms, location } = req.body;

        let where = "status = 'published'";
        const params = [];

        if (query) {
            const stopWords = new Set(['in', 'at', 'near', 'the', 'for', 'a', 'an', 'and', 'or', 'with', 'to', 'of', 'i', 'want', 'looking', 'need', 'show', 'find']);
            const words = sanitize(query)
                .split(/\s+/)
                .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
                .filter(w => w.length > 1 && !stopWords.has(w.toLowerCase()));

            if (words.length > 0) {
                const keywordClauses = words.map(() => '(title LIKE ? OR locality LIKE ? OR city LIKE ? OR description LIKE ? OR category LIKE ?)');
                where += ' AND (' + keywordClauses.join(' OR ') + ')';
                words.forEach(w => {
                    const q = `%${w}%`;
                    params.push(q, q, q, q, q);
                });
            }
        }
        if (category) { where += ' AND category = ?'; params.push(sanitize(category)); }
        if (min_budget) { where += ' AND price >= ?'; params.push(parseFloat(min_budget)); }
        if (max_budget) { where += ' AND price <= ?'; params.push(parseFloat(max_budget)); }
        if (bedrooms) { where += ' AND bedrooms >= ?'; params.push(parseInt(bedrooms)); }
        if (location) {
            where += ' AND (locality LIKE ? OR city LIKE ?)';
            params.push(`%${sanitize(location)}%`, `%${sanitize(location)}%`);
        }

        const properties = db.prepare(`
            SELECT p.id, p.property_code, p.title, p.category, p.purpose,
                p.price, p.city, p.locality, p.bedrooms, p.bathrooms,
                p.plot_area, p.built_up_area, p.area_unit, p.short_description,
                (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image
            FROM properties p
            WHERE ${where}
            ORDER BY p.is_featured DESC, p.published_at DESC
            LIMIT 10
        `).all(...params);

        res.json({
            count: properties.length,
            properties,
            message: properties.length > 0
                ? `I found ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} matching your criteria.`
                : 'No properties found matching your criteria. Would you like to modify your search or speak with an agent?'
        });
    } catch (err) {
        console.error('Chatbot search error:', err);
        res.status(500).json({ error: 'Search failed', properties: [] });
    }
});

// POST /api/chatbot/enquiry — Submit enquiry via chatbot
router.post('/enquiry', (req, res) => {
    try {
        const db = getDb();
        const { customer_name, phone, property_id, message, budget, preferred_location } = req.body;

        if (!customer_name || !phone) {
            return res.status(400).json({ error: 'Name and phone number are required to submit an enquiry.' });
        }
        if (!validatePhone(phone)) {
            return res.status(400).json({ error: 'Please provide a valid phone number.' });
        }

        // Generate lead code
        const lastLead = db.prepare("SELECT lead_code FROM leads ORDER BY id DESC LIMIT 1").get();
        let nextNum = 1;
        if (lastLead && lastLead.lead_code) {
            const match = lastLead.lead_code.match(/SV-LEAD-(\d+)/);
            if (match) nextNum = parseInt(match[1]) + 1;
        }
        const leadCode = `SV-LEAD-${String(nextNum).padStart(6, '0')}`;

        // Get property category
        let propertyCategory = null;
        if (property_id) {
            const prop = db.prepare('SELECT category FROM properties WHERE id = ?').get(property_id);
            if (prop) propertyCategory = prop.category;
        }

        const result = db.prepare(`
            INSERT INTO leads (
                lead_code, customer_name, phone, property_id, property_category,
                budget, preferred_location, message, contact_preference, consent, source, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'any', 1, 'chatbot', 'new')
        `).run(
            leadCode, sanitize(customer_name), sanitize(phone),
            property_id ? parseInt(property_id) : null, propertyCategory,
            budget || null, preferred_location || null,
            message ? sanitize(message) : 'Enquiry via AI chatbot'
        );

        // Status history
        db.prepare(`
            INSERT INTO lead_status_history (lead_id, old_status, new_status) VALUES (?, NULL, 'new')
        `).run(result.lastInsertRowid);

        // Notify admins
        const { notifyAllAdmins } = require('../../middleware/auth');
        notifyAllAdmins(db, 'lead',
            'New Chatbot Enquiry',
            `${customer_name} submitted an enquiry via chatbot. Ref: ${leadCode}`,
            `/admin/leads/${result.lastInsertRowid}`
        );

        res.status(201).json({
            success: true,
            lead_code: leadCode,
            message: `Your enquiry has been submitted successfully! Reference: ${leadCode}. Our team will contact you shortly.`
        });
    } catch (err) {
        console.error('Chatbot enquiry error:', err);
        res.status(500).json({ error: 'Failed to submit enquiry. Please try calling us directly.' });
    }
});

// POST /api/chatbot/site-visit — Request site visit via chatbot
router.post('/site-visit', (req, res) => {
    try {
        const db = getDb();
        const { customer_name, phone, property_id, preferred_date, preferred_time, notes } = req.body;

        if (!customer_name || !phone || !preferred_date) {
            return res.status(400).json({ error: 'Name, phone, and preferred date are required.' });
        }

        // Generate appointment code
        const last = db.prepare("SELECT appointment_code FROM appointments ORDER BY id DESC LIMIT 1").get();
        let nextNum = 1;
        if (last && last.appointment_code) {
            const match = last.appointment_code.match(/SV-VISIT-(\d+)/);
            if (match) nextNum = parseInt(match[1]) + 1;
        }
        const code = `SV-VISIT-${String(nextNum).padStart(5, '0')}`;

        db.prepare(`
            INSERT INTO appointments (appointment_code, property_id, customer_name, phone, notes, requested_date, requested_time, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'requested')
        `).run(code, property_id ? parseInt(property_id) : null, sanitize(customer_name), sanitize(phone),
            notes ? sanitize(notes) : 'Requested via chatbot', preferred_date, preferred_time || null);

        const { notifyAllAdmins } = require('../../middleware/auth');
        notifyAllAdmins(db, 'appointment', 'New Chatbot Site Visit',
            `${customer_name} requested a site visit via chatbot on ${preferred_date}. Ref: ${code}`,
            '/admin/appointments');

        res.status(201).json({
            success: true,
            appointment_code: code,
            message: `Site visit request submitted! Reference: ${code}. Our team will confirm your visit shortly.`
        });
    } catch (err) {
        console.error('Chatbot site visit error:', err);
        res.status(500).json({ error: 'Failed to schedule site visit.' });
    }
});

// GET /api/chatbot/property/:id — Get property details for chatbot
router.get('/property/:id', (req, res) => {
    const db = getDb();
    const property = db.prepare(`
        SELECT id, property_code, title, category, purpose, short_description, description,
            price, price_negotiable, city, locality, plot_area, built_up_area, carpet_area,
            area_unit, bedrooms, bathrooms, balconies, floors, facing, furnishing, parking,
            amenities, availability,
            (SELECT image_url FROM property_images WHERE property_id = properties.id AND is_cover = 1 LIMIT 1) as cover_image
        FROM properties
        WHERE id = ? AND status = 'published'
    `).get(req.params.id);

    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.json({ property });
});

module.exports = router;
