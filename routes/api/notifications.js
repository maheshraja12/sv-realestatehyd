/**
 * Notifications API
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../../database/db');
const { requireAuth } = require('../../middleware/auth');

router.use(requireAuth);

// GET /api/notifications
router.get('/', (req, res) => {
    const db = getDb();
    const notifications = db.prepare(`
        SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    `).all(req.session.userId);

    const unreadCount = db.prepare(`
        SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0
    `).get(req.session.userId).c;

    res.json({ notifications, unreadCount });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', (req, res) => {
    const db = getDb();
    db.prepare("UPDATE notifications SET is_read = 1, read_at = datetime('now') WHERE id = ? AND user_id = ?")
        .run(req.params.id, req.session.userId);
    res.json({ message: 'Marked as read' });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', (req, res) => {
    const db = getDb();
    db.prepare("UPDATE notifications SET is_read = 1, read_at = datetime('now') WHERE user_id = ? AND is_read = 0")
        .run(req.session.userId);
    res.json({ message: 'All marked as read' });
});

module.exports = router;
