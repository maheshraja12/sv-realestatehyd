/**
 * Authentication & Authorization Middleware
 */

function getAdminPermissions(db) {
    const perms = {
        dashboard: false,
        properties: false,
        leads: true,
        appointments: false,
        settings: false
    };
    try {
        if (db && typeof db.prepare === 'function') {
            const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'admin_perm_%'").all();
            rows.forEach(r => {
                const feature = r.key.replace('admin_perm_', '');
                if (feature !== 'leads') {
                    perms[feature] = (r.value === '1' || r.value === 'true');
                }
            });
        }
    } catch (e) {}
    // Leads & enquiries is the foundational permission and is ALWAYS guaranteed true
    perms.leads = true;
    return perms;
}

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
    const url = req.originalUrl || req.url || '';
    const cleanUrl = url.split('?')[0].replace(/\/+$/, '');
    if (cleanUrl === '/admin/login') {
        return next();
    }
    const returnToParam = (url && cleanUrl !== '/admin' && cleanUrl !== '/admin/login' && cleanUrl !== '/admin/logout')
        ? `?returnTo=${encodeURIComponent(url)}`
        : '';
    return res.redirect(`/admin/login${returnToParam}`);
}

function requireSuperAdmin(req, res, next) {
    if (req.session && req.session.userId && req.session.userRole === 'superadmin') {
        return next();
    }
    const isApi = req.xhr || 
        (req.originalUrl && req.originalUrl.startsWith('/api/')) || 
        (req.baseUrl && req.baseUrl.startsWith('/api/')) || 
        req.path.startsWith('/api/');
    if (isApi) {
        return res.status(403).json({ error: 'Super Admin access required' });
    }
    if (!req.session || !req.session.userId) {
        return res.redirect('/admin/login');
    }
    const cleanUrl = (req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '');
    if (cleanUrl === '/admin/leads') {
        return next();
    }
    // Normal admin is redirected safely to their allowed area
    return res.redirect('/admin/leads');
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.userId && (req.session.userRole === 'admin' || req.session.userRole === 'superadmin')) {
        return next();
    }
    const isApi = req.xhr || 
        (req.originalUrl && req.originalUrl.startsWith('/api/')) || 
        (req.baseUrl && req.baseUrl.startsWith('/api/')) || 
        req.path.startsWith('/api/');
    if (isApi) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    const url = req.originalUrl || req.url || '';
    const cleanUrl = url.split('?')[0].replace(/\/+$/, '');
    if (cleanUrl === '/admin/login') {
        return next();
    }
    const returnToParam = (url && cleanUrl !== '/admin' && cleanUrl !== '/admin/login' && cleanUrl !== '/admin/logout')
        ? `?returnTo=${encodeURIComponent(url)}`
        : '';
    return res.redirect(`/admin/login${returnToParam}`);
}

function requirePermission(feature) {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return requireAuth(req, res, next);
        }
        // Superadmin and leads access are always permitted
        if (req.session.userRole === 'superadmin' || feature === 'leads') {
            return next();
        }
        const { getDb } = require('../database/db');
        const perms = res.locals.userPermissions || getAdminPermissions(getDb());
        if (perms[feature]) {
            return next();
        }
        const isApi = req.xhr || 
            (req.originalUrl && req.originalUrl.startsWith('/api/')) || 
            (req.baseUrl && req.baseUrl.startsWith('/api/')) || 
            req.path.startsWith('/api/');
        if (isApi) {
            return res.status(403).json({ error: `Access denied: ${feature} is restricted by Super Admin.` });
        }
        const cleanUrl = (req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '');
        if (cleanUrl === '/admin/leads') {
            return next(); // Never loop redirect to /admin/leads from /admin/leads!
        }
        return res.redirect('/admin/leads');
    };
}

function loadUser(req, res, next) {
    if (req.session && req.session.userId) {
        const isSuperAdmin = req.session.userRole === 'superadmin';
        res.locals.currentUser = {
            id: req.session.userId,
            name: req.session.userName,
            email: req.session.userEmail,
            role: req.session.userRole,
            isSuperAdmin: isSuperAdmin
        };
        if (isSuperAdmin) {
            res.locals.userPermissions = {
                dashboard: true,
                properties: true,
                leads: true,
                appointments: true,
                settings: true
            };
        } else {
            const { getDb } = require('../database/db');
            res.locals.userPermissions = getAdminPermissions(getDb());
        }
    } else {
        res.locals.currentUser = null;
        res.locals.userPermissions = null;
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
    requireSuperAdmin,
    requirePermission,
    getAdminPermissions,
    loadUser,
    auditLog,
    createNotification,
    notifyAllAdmins
};
