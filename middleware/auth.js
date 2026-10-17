/**
 * Authentication & Authorization Middleware
 */

function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    const isApi = req.xhr || 
        (req.originalUrl && req.originalUrl.startsWith('/api/')) || 
        (req.baseUrl && req.baseUrl.startsWith('/api/')) || 
        req.path.startsWith('/api/');
    if (isApi) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/admin/login');
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.userId && req.session.userRole === 'admin') {
        return next();
    }
    const isApi = req.xhr || 
        (req.originalUrl && req.originalUrl.startsWith('/api/')) || 
        (req.baseUrl && req.baseUrl.startsWith('/api/')) || 
        req.path.startsWith('/api/');
    if (isApi) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    return res.redirect('/admin/login');
}

function loadUser(req, res, next) {
    if (req.session && req.session.userId) {
        res.locals.currentUser = {
            id: req.session.userId,
            name: req.session.userName,
            email: req.session.userEmail,
            role: req.session.userRole
        };
    } else {
        res.locals.currentUser = null;
    }
    next();
}

function auditLog(db, userId, userName, action, entityType, entityId, details, ip) {
    try {
        db.prepare(`
            INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, userName, action, entityType, entityId, details || null, ip || null);
    } catch (err) {
        console.error('Audit log error:', err.message);
    }
}

function createNotification(db, userId, type, title, message, link) {
    try {
        db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, link)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, type, title, message, link || null);
    } catch (err) {
        console.error('Notification error:', err.message);
    }
}

function notifyAllAdmins(db, type, title, message, link) {
    try {
        const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND is_active = 1").all();
        const stmt = db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, link)
            VALUES (?, ?, ?, ?, ?)
        `);
        for (const admin of admins) {
            stmt.run(admin.id, type, title, message, link || null);
        }
    } catch (err) {
        console.error('Notify admins error:', err.message);
    }
}

module.exports = {
    requireAuth,
    requireAdmin,
    loadUser,
    auditLog,
    createNotification,
    notifyAllAdmins
};
