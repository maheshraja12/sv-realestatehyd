/**
 * Authentication Routes — Login / Logout
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDb } = require('../database/db');
const { auditLog, getAdminPermissions } = require('../middleware/auth');
const { sanitize } = require('../middleware/validation');

function getLandingPage(userRole, db) {
    if (userRole === 'superadmin') {
        return '/admin/dashboard';
    }
    const perms = getAdminPermissions(db);
    return perms.dashboard ? '/admin/dashboard' : '/admin/leads';
}

// GET /admin or /admin/
router.get('/', (req, res) => {
    if (req.session && req.session.userId) {
        const db = getDb();
        return res.redirect(getLandingPage(req.session.userRole, db));
    }
    return res.redirect('/admin/login');
});

// GET /admin/login
router.get('/login', (req, res) => {
    if (req.session && req.session.userId) {
        const db = getDb();
        return res.redirect(getLandingPage(req.session.userRole, db));
    }
    res.render('admin/login', {
        title: 'Admin Login — SV Real Estates',
        error: null,
        returnTo: req.query.returnTo || '',
        layout: false
    });
});

// POST /admin/login
router.post('/login', async (req, res) => {
    const returnTo = req.query.returnTo || req.body.returnTo || '';
    try {
        const email = sanitize(req.body.email || '').toLowerCase();
        const password = req.body.password || '';

        if (!email || !password) {
            return res.render('admin/login', {
                title: 'Admin Login — SV Real Estates',
                error: 'Email and password are required',
                returnTo,
                layout: false
            });
        }

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);

        if (!user) {
            return res.render('admin/login', {
                title: 'Admin Login — SV Real Estates',
                error: 'Invalid email or password',
                returnTo,
                layout: false
            });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            auditLog(db, null, email, 'login_failed', 'user', null, 'Invalid password', req.ip);
            return res.render('admin/login', {
                title: 'Admin Login — SV Real Estates',
                error: 'Invalid email or password',
                returnTo,
                layout: false
            });
        }

        // Set session
        req.session.userId = user.id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;
        req.session.userRole = user.role;

        // Update last login
        db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
        auditLog(db, user.id, user.name, 'login', 'user', user.id, 'Successful login', req.ip);

        // Determine destination based on role and permissions
        const defaultLanding = getLandingPage(user.role, db);
        let targetUrl = defaultLanding;
        if (returnTo && returnTo.startsWith('/admin') && !returnTo.startsWith('//')) {
            const cleanTarget = returnTo.split('?')[0].replace(/\/+$/, '');
            if (cleanTarget !== '/admin' && cleanTarget !== '/admin/login' && cleanTarget !== '/admin/logout') {
                if (user.role === 'superadmin') {
                    targetUrl = returnTo;
                } else {
                    const perms = getAdminPermissions(db);
                    if (cleanTarget.startsWith('/admin/dashboard') && perms.dashboard) targetUrl = returnTo;
                    else if (cleanTarget.startsWith('/admin/properties') && perms.properties) targetUrl = returnTo;
                    else if (cleanTarget.startsWith('/admin/leads') && perms.leads) targetUrl = returnTo;
                    else if (cleanTarget.startsWith('/admin/appointments') && perms.appointments) targetUrl = returnTo;
                    else targetUrl = defaultLanding;
                }
            }
        }

        // Save session explicitly before redirecting
        req.session.save((saveErr) => {
            if (saveErr) console.error('Session save error:', saveErr);
            return res.redirect(targetUrl);
        });
    } catch (err) {
        console.error('Login error:', err);
        res.render('admin/login', {
            title: 'Admin Login — SV Real Estates',
            error: 'An error occurred. Please try again.',
            returnTo,
            layout: false
        });
    }
});

// GET /admin/logout
router.get('/logout', (req, res) => {
    if (req.session && req.session.userId) {
        const db = getDb();
        auditLog(db, req.session.userId, req.session.userName, 'logout', 'user', req.session.userId, null, req.ip);
    }
    req.session.destroy(() => {
        res.clearCookie('sv.sid');
        res.redirect('/admin/login');
    });
});

module.exports = router;
