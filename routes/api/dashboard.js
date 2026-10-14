/**
 * Dashboard Statistics API
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../../database/db');
const { requireAuth } = require('../../middleware/auth');

router.use(requireAuth);

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
    const db = getDb();

    const stats = {
        totalProperties: db.prepare('SELECT COUNT(*) as c FROM properties').get().c,
        publishedProperties: db.prepare("SELECT COUNT(*) as c FROM properties WHERE status = 'published'").get().c,
        draftProperties: db.prepare("SELECT COUNT(*) as c FROM properties WHERE status = 'draft'").get().c,
        totalLeads: db.prepare('SELECT COUNT(*) as c FROM leads').get().c,
        newLeads: db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'new'").get().c,
        followUpsDue: db.prepare("SELECT COUNT(*) as c FROM leads WHERE next_follow_up <= datetime('now') AND status NOT IN ('converted', 'lost', 'spam')").get().c,
        siteVisitsScheduled: db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status IN ('requested', 'confirmed')").get().c,
        closedLeads: db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'converted'").get().c
    };

    res.json(stats);
});

// GET /api/dashboard/charts/leads-over-time
router.get('/charts/leads-over-time', (req, res) => {
    const db = getDb();
    const data = db.prepare(`
        SELECT date(created_at) as date, COUNT(*) as count
        FROM leads
        WHERE created_at >= date('now', '-30 days')
        GROUP BY date(created_at)
        ORDER BY date
    `).all();
    res.json(data);
});

// GET /api/dashboard/charts/leads-by-category
router.get('/charts/leads-by-category', (req, res) => {
    const db = getDb();
    const data = db.prepare(`
        SELECT COALESCE(property_category, 'uncategorized') as category, COUNT(*) as count
        FROM leads
        GROUP BY property_category
        ORDER BY count DESC
    `).all();
    res.json(data);
});

// GET /api/dashboard/charts/lead-status
router.get('/charts/lead-status', (req, res) => {
    const db = getDb();
    const data = db.prepare(`
        SELECT status, COUNT(*) as count
        FROM leads
        GROUP BY status
        ORDER BY count DESC
    `).all();
    res.json(data);
});

// GET /api/dashboard/charts/properties-by-category
router.get('/charts/properties-by-category', (req, res) => {
    const db = getDb();
    const data = db.prepare(`
        SELECT category, COUNT(*) as count,
            SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
        FROM properties
        GROUP BY category
        ORDER BY count DESC
    `).all();
    res.json(data);
});

module.exports = router;
