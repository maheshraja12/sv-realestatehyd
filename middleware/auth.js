/**
 * Authentication & Authorization Middleware
 */

function getAdminPermissions(db) {
    const perms = {
        dashboard: true,
        properties: true,
        leads: true,
        appointments: true,
        interiors: true,
        cms: false,
        settings: false,
        crm: true,
        pipeline: true,
        customers: true,
        followups: true,
        employees: false,
        reports: true
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
                interiors: true,
                cms: true,
                settings: true,
                crm: true,
                pipeline: true,
                customers: true,
                followups: true,
                employees: true,
                reports: true
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
        const admins = db.prepare("SELECT id FROM users WHERE (role = 'admin' OR role = 'superadmin') AND is_active = 1").all();
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


function getLeadFilterForUser(user) {
    if (!user) return { scoped: false, where: '1=1', params: [] };
    const role = (user.role || '').toLowerCase();
    if (role === 'superadmin' || role === 'admin' || role === 'sales_manager') {
        return { scoped: false, where: '1=1', params: [] };
    }
    if (role === 'sales_executive' || role === 'agent') {
        return {
            scoped: true,
            where: '(l.assigned_agent_id = ? OR l.assigned_to = ?)',
            params: [user.id, user.id]
        };
    }
    // Receptionist sees all leads to coordinate site visits
    return { scoped: false, where: '1=1', params: [] };
}

function logLeadActivity(db, { leadId, customerId, userId, userName, type, title, notes, metadata }) {
    try {
        if (!db || typeof db.prepare !== 'function') return;
        db.prepare(`
            INSERT INTO lead_activities (lead_id, customer_id, user_id, user_name, activity_type, title, notes, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            leadId || null,
            customerId || null,
            userId || null,
            userName || 'System',
            type || 'note',
            title || 'Activity',
            notes || null,
            metadata ? (typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata)) : null
        );
    } catch (e) {
        console.error('Error logging lead activity:', e.message);
    }
}

function requireRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.redirect('/admin/login');
        }
        const userRole = (req.session.userRole || '').toLowerCase();
        if (userRole === 'superadmin' || allowedRoles.includes(userRole)) {
            return next();
        }
        const isApi = req.xhr || (req.originalUrl && req.originalUrl.startsWith('/api/'));
        if (isApi) {
            return res.status(403).json({ error: 'Access denied: Insufficient privileges.' });
        }
        return res.redirect('/admin/dashboard');
    };
}

module.exports = {
    requireAuth,
    requireAdmin,
    requireSuperAdmin,
    requirePermission,
    requireRole,
    getLeadFilterForUser,
    logLeadActivity,
    getAdminPermissions,
    loadUser,
    auditLog,
    createNotification,
    notifyAllAdmins
};
