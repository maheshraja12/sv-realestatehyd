/**
 * Admin Page Routes — Dashboard, Properties, Leads, Appointments, Settings
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { cloudLeadsConfigured, listCloudLeads, listCloudProperties } = require('../database/cloud-leads');
const { enhanceProperty, enhancePropertyList } = require('../database/property-media');
const { requireAuth, requireSuperAdmin, requirePermission, getAdminPermissions } = require('../middleware/auth');
const { 
    isMySqlConfigured, 
    fetchEnquiries, 
    getEnquiryById, 
    getEnquiryStats 
} = require('../database/mysql');
const {
    isPostgresConfigured,
    fetchLeads: fetchPgLeads,
    getLeadById: getPgLeadById,
    getLeadStats: getPgLeadStats,
    fetchAppointments: fetchPgAppointments,
    getAppointmentStats: getPgAppointmentStats
} = require('../database/postgres');

// All admin routes require authentication
router.use(requireAuth);

// GET /admin or /admin/
router.get('/', (req, res) => {
    if (req.session && req.session.userRole === 'superadmin') {
        return res.redirect('/admin/dashboard');
    }
    const db = getDb();
    const perms = res.locals.userPermissions || getAdminPermissions(db);
    return res.redirect(perms.dashboard ? '/admin/dashboard' : '/admin/leads');
});

// GET /admin/dashboard
router.get('/dashboard', requirePermission('dashboard'), async (req, res) => {
    if (process.env.VERCEL && cloudLeadsConfigured()) {
        const [allPropertiesResult, publishedResult, leadResult, recentPropertiesResult] = await Promise.all([
            listCloudProperties({ public: false, limit: 100, offset: 0 }),
            listCloudProperties({ public: true, limit: 100, offset: 0 }),
            listCloudLeads({ limit: 100, offset: 0 }),
            listCloudProperties({ public: false, limit: 5, offset: 0 })
        ]);
        if ([allPropertiesResult, publishedResult, leadResult, recentPropertiesResult].some(r => !r.success)) {
            console.error('[ADMIN DASHBOARD] Could not load all production data');
            return res.status(502).send('Could not load dashboard data from the production database. Please refresh shortly.');
        }
        const allProperties = allPropertiesResult.properties || [];
        const publishedProperties = publishedResult.properties || [];
        const cloudLeads = leadResult.data || [];
        const stats = {
            totalProperties: Number(allPropertiesResult.total || 0),
            publishedProperties: Number(publishedResult.total || 0),
            draftProperties: allProperties.filter(p => p.status === 'draft').length,
            totalLeads: Number(leadResult.count || 0),
            newLeads: cloudLeads.filter(l => String(l.status || 'new').toLowerCase() === 'new').length,
            followUpsDue: 0,
            siteVisitsScheduled: 0,
            closedLeads: cloudLeads.filter(l => String(l.status || '').toLowerCase() === 'converted').length
        };
        const recentLeads = cloudLeads.slice(0, 10).map(e => ({
            id: e.id,
            lead_code: e.lead_code,
            full_name: e.full_name || e.customer_name,
            customer_name: e.customer_name || e.full_name,
            phone_number: e.phone_number || e.phone,
            phone: e.phone || e.phone_number,
            appointment_date: e.appointment_date,
            appointment_time: e.appointment_time,
            property_requirement: e.property_requirement,
            property_category: e.property_category || e.property_requirement,
            status: (e.status || 'new').toLowerCase(),
            created_at: e.created_at,
            property_title: null
        }));
        const recentProperties = enhancePropertyList(recentPropertiesResult.properties || []);
        return res.render('admin/dashboard', {
            title: 'Dashboard — SV Real Estates Admin',
            stats, recentLeads, recentProperties, unreadNotifications: 0
        });
    }
    const db = getDb();
    
    let stats = {
        totalProperties: db.prepare('SELECT COUNT(*) as count FROM properties').get().count,
        publishedProperties: db.prepare("SELECT COUNT(*) as count FROM properties WHERE status = 'published'").get().count,
        draftProperties: db.prepare("SELECT COUNT(*) as count FROM properties WHERE status = 'draft'").get().count,
        totalLeads: db.prepare('SELECT COUNT(*) as count FROM leads').get().count,
        newLeads: db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'new'").get().count,
        followUpsDue: db.prepare("SELECT COUNT(*) as count FROM leads WHERE next_follow_up <= datetime('now') AND status NOT IN ('converted', 'lost', 'spam')").get().count,
        siteVisitsScheduled: db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status IN ('requested', 'confirmed')").get().count,
        closedLeads: db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'converted'").get().count
    };

    let recentLeads = db.prepare(`
        SELECT l.*, p.title as property_title
        FROM leads l
        LEFT JOIN properties p ON l.property_id = p.id
        ORDER BY l.id DESC LIMIT 10
    `).all();



    const recentProperties = db.prepare(`
        SELECT * FROM properties ORDER BY updated_at DESC LIMIT 5
    `).all();

    const unreadNotifications = db.prepare(`
        SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
    `).get(req.session.userId).count;

    res.render('admin/dashboard', {
        title: 'Dashboard — SV Real Estates Admin',
        stats,
        recentLeads,
        recentProperties,
        unreadNotifications
    });
});

// GET /admin/properties
router.get('/properties', requirePermission('properties'), async (req, res) => {
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).send('Production properties database is not configured.');
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const category = req.query.category || '';
        const status = req.query.status || '';
        const result = await listCloudProperties({ public: false, page, limit, offset, search, category, status });
        if (!result.success) return res.status(502).send(result.error || 'Could not load production properties.');
        let properties = (result.properties || []).map(p => ({ ...p, cover_image: p.cover_image || null, lead_count: 0 }));
        properties = enhancePropertyList(properties);
        const total = Number(result.total || 0);
        const totalPages = Math.ceil(total / limit) || 1;
        return res.render('admin/properties', {
            title: 'Properties — SV Real Estates Admin',
            properties, page, totalPages, total, search, category, status,
            unreadNotifications: 0
        });
    }
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const status = req.query.status || '';

    let where = '1=1';
    const params = [];

    if (search) {
        where += ' AND (title LIKE ? OR property_code LIKE ? OR locality LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) {
        where += ' AND category = ?';
        params.push(category);
    }
    if (status) {
        where += ' AND status = ?';
        params.push(status);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM properties WHERE ${where}`).get(...params).count;
    let properties = db.prepare(`
        SELECT p.*, 
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image,
            (SELECT COUNT(*) FROM leads WHERE property_id = p.id) as lead_count
        FROM properties p
        WHERE ${where}
        ORDER BY p.updated_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    properties = enhancePropertyList(properties);

    const totalPages = Math.ceil(total / limit);

    res.render('admin/properties', {
        title: 'Properties — SV Real Estates Admin',
        properties,
        page,
        totalPages,
        total,
        search,
        category,
        status,
        unreadNotifications: 0
    });
});

// GET /admin/properties/new
router.get('/properties/new', requirePermission('properties'), (req, res) => {
    res.render('admin/property-form', {
        title: 'Add New Property — SV Real Estates Admin',
        property: null,
        images: [],
        isEdit: false,
        unreadNotifications: 0
    });
});

// GET /admin/properties/:id/edit
router.get('/properties/:id/edit', requirePermission('properties'), async (req, res) => {
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).send('Production properties database is not configured.');
        const result = await listCloudProperties({ public: false, id: req.params.id, limit: 1, offset: 0 });
        const property = result.success ? result.property : null;
        if (!property) return res.redirect('/admin/properties');
        enhanceProperty(property);
        const images = property.images || [];
        return res.render('admin/property-form', {
            title: `Edit: ${property.title} — SV Real Estates Admin`,
            property, images, isEdit: true, unreadNotifications: 0
        });
    }
    const db = getDb();
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
    
    if (!property) {
        return res.redirect('/admin/properties');
    }

    enhanceProperty(property);
    let images = db.prepare('SELECT * FROM property_images WHERE property_id = ? ORDER BY display_order').all(property.id);
    if (!images || images.length === 0) images = property.images || [];

    res.render('admin/property-form', {
        title: `Edit: ${property.title} — SV Real Estates Admin`,
        property,
        images,
        isEdit: true,
        unreadNotifications: 0
    });
});

// GET /admin/leads
router.get('/leads', requirePermission('leads'), async (req, res) => {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const category = req.query.category || '';

    // Production admin listing reads from the same Supabase database as public enquiries.
    // An empty cloud result is valid and must not fall back to ephemeral SQLite.
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) {
            return res.status(503).send('Production enquiry database is not configured.');
        }

        const cloudResult = await listCloudLeads({ status, search, category, limit, offset });
        if (!cloudResult.success) {
            console.error('[ADMIN LEADS] Supabase listing failed:', cloudResult.error);
            return res.status(502).send('Unable to load enquiries from the production database. Please try again shortly.');
        }

        const leads = (cloudResult.data || []).map(e => ({
            id: e.id,
            lead_code: e.lead_code || `SV-LEAD-${String(e.id).padStart(5, '0')}`,
            full_name: e.full_name || e.customer_name,
            customer_name: e.customer_name || e.full_name,
            phone_number: e.phone_number || e.phone,
            phone: e.phone || e.phone_number,
            email: e.email,
            appointment_date: e.appointment_date,
            appointment_time: e.appointment_time,
            property_requirement: e.property_requirement,
            property_category: e.property_category || e.property_requirement,
            budget: e.budget,
            preferred_location: e.preferred_location,
            message: e.message,
            status: (e.status || 'new').toLowerCase(),
            created_at: e.created_at,
            property_title: null,
            agent_name: 'Unassigned'
        }));
        const total = Number(cloudResult.count || 0);
        const totalPages = Math.ceil(total / limit) || 1;
        const agents = db.prepare("SELECT id, name FROM users WHERE is_active = 1").all();

        return res.render('admin/leads', {
            title: 'Leads — SV Real Estates Admin',
            leads,
            agents,
            page,
            totalPages,
            total,
            search,
            status,
            category,
            unreadNotifications: 0
        });
    }

    // Local SQLite database query (with filters and pagination)
    let where = '1=1';
    const params = [];

    if (search) {
        where += ' AND (l.customer_name LIKE ? OR l.phone LIKE ? OR l.email LIKE ? OR l.lead_code LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
        where += ' AND l.status = ?';
        params.push(status);
    }
    if (category) {
        where += ' AND l.property_category = ?';
        params.push(category);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM leads l WHERE ${where}`).get(...params).count;
    const leads = db.prepare(`
        SELECT l.*, p.title as property_title, p.property_code as property_code,
            u.name as agent_name
        FROM leads l
        LEFT JOIN properties p ON l.property_id = p.id
        LEFT JOIN users u ON l.assigned_agent_id = u.id
        WHERE ${where}
        ORDER BY l.id DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const totalPages = Math.ceil(total / limit) || 1;
    const agents = db.prepare("SELECT id, name FROM users WHERE is_active = 1").all();

    res.render('admin/leads', {
        title: 'Leads — SV Real Estates Admin',
        leads,
        agents,
        page,
        totalPages,
        total,
        search,
        status,
        category,
        unreadNotifications: 0
    });
});

// GET /admin/leads/:id
router.get('/leads/:id', async (req, res) => {
    const db = getDb();
    let lead = db.prepare(`
        SELECT l.*, p.title as property_title, p.property_code, p.price as property_price,
            p.category as property_cat, p.locality as property_locality,
            u.name as agent_name
        FROM leads l
        LEFT JOIN properties p ON l.property_id = p.id
        LEFT JOIN users u ON l.assigned_agent_id = u.id
        WHERE l.id = ?
    `).get(req.params.id);

    if (!lead) {
        return res.redirect('/admin/leads');
    }

    const notes = db.prepare(`
        SELECT n.*, u.name as user_name
        FROM lead_notes n
        LEFT JOIN users u ON n.user_id = u.id
        WHERE n.lead_id = ?
        ORDER BY n.created_at DESC
    `).all(lead.id);

    const statusHistory = db.prepare(`
        SELECT h.*, u.name as changed_by_name
        FROM lead_status_history h
        LEFT JOIN users u ON h.changed_by = u.id
        WHERE h.lead_id = ?
        ORDER BY h.created_at DESC
    `).all(lead.id);

    const appointments = db.prepare(`
        SELECT * FROM appointments WHERE lead_id = ? ORDER BY created_at DESC
    `).all(lead.id);

    const agents = db.prepare("SELECT id, name FROM users WHERE is_active = 1").all();

    res.render('admin/lead-detail', {
        title: `Lead: ${lead.customer_name} — SV Real Estates Admin`,
        lead,
        notes,
        statusHistory,
        appointments,
        agents,
        unreadNotifications: 0
    });
});

// GET /admin/appointments
router.get('/appointments', requirePermission('appointments'), async (req, res) => {
    const db = getDb();
    const status = req.query.status || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const offset = (page - 1) * limit;

    let where = '1=1';
    const params = [];
    if (status) {
        where += ' AND a.status = ?';
        params.push(status);
    }

    // Local SQLite appointments query
    const total = db.prepare(`SELECT COUNT(*) as count FROM appointments a WHERE ${where}`).get(...params).count;
    const appointments = db.prepare(`
        SELECT a.*, p.title as property_title, p.property_code,
            u.name as agent_name
        FROM appointments a
        LEFT JOIN properties p ON a.property_id = p.id
        LEFT JOIN users u ON a.assigned_agent_id = u.id
        WHERE ${where}
        ORDER BY a.id DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const totalPages = Math.ceil(total / limit);
    const agents = db.prepare("SELECT id, name FROM users WHERE is_active = 1").all();

    res.render('admin/appointments', {
        title: 'Site Visits — SV Real Estates Admin',
        appointments,
        agents,
        page,
        totalPages,
        total,
        status,
        unreadNotifications: 0
    });
});

// GET /admin/settings — Super Admin Only
router.get('/settings', requireSuperAdmin, (req, res) => {
    const db = getDb();
    const settings = {};
    const rows = db.prepare('SELECT key, value FROM settings').all();
    rows.forEach(r => { settings[r.key] = r.value; });

    const message = req.query.msg || null;
    const error = req.query.err || null;

    // Load staff admin account and current permissions
    const staffUser = db.prepare("SELECT id, name, email, role, last_login_at FROM users WHERE role = 'admin' LIMIT 1").get() || null;
    const adminPermissions = getAdminPermissions(db);

    res.render('admin/settings', {
        title: 'Settings & Permissions — SV Real Estates Admin',
        settings,
        message,
        error,
        staffUser,
        adminPermissions,
        postgresConfigured: isPostgresConfigured(),
        unreadNotifications: 0
    });
});

// POST /admin/settings — Save business settings (Super Admin Only)
router.post('/settings', requireSuperAdmin, (req, res) => {
    try {
        const db = getDb();
        const allowedKeys = [
            'business_name', 'business_phone', 'business_email',
            'business_whatsapp', 'business_address', 'business_instagram', 'smtp_host',
            'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_configured'
        ];

        const upsert = db.prepare(`
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
        `);

        for (const key of allowedKeys) {
            if (req.body[key] !== undefined) {
                upsert.run(key, String(req.body[key]).trim());
            }
        }

        res.redirect('/admin/settings?msg=Settings+saved+successfully');
    } catch (err) {
        console.error('Settings update error:', err);
        res.redirect('/admin/settings?err=Failed+to+save+settings');
    }
});

// POST /admin/settings/permissions — Manage Normal Admin permissions & account (Super Admin Only)
router.post('/settings/permissions', requireSuperAdmin, async (req, res) => {
    try {
        const db = getDb();
        const bcrypt = require('bcryptjs');

        // 1. Update module visibility & access permissions
        const permsToUpdate = [
            ['admin_perm_dashboard', req.body.perm_dashboard ? '1' : '0'],
            ['admin_perm_properties', req.body.perm_properties ? '1' : '0'],
            ['admin_perm_leads', '1'], // Customer leads always accessible
            ['admin_perm_appointments', req.body.perm_appointments ? '1' : '0']
        ];

        const upsert = db.prepare(`
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
        `);
        for (const [k, v] of permsToUpdate) {
            upsert.run(k, v);
        }

        // 2. Update Normal Admin user credentials if submitted
        const staffName = (req.body.staff_name || '').trim();
        const staffEmail = (req.body.staff_email || '').trim().toLowerCase();
        const staffPassword = (req.body.staff_password || '').trim();

        let normalAdmin = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
        if (normalAdmin && (staffName || staffEmail || staffPassword)) {
            const updates = [];
            const params = [];

            if (staffName) {
                updates.push("name = ?");
                params.push(staffName);
            }
            if (staffEmail) {
                updates.push("email = ?");
                params.push(staffEmail);
            }
            if (staffPassword) {
                if (staffPassword.length < 6) {
                    return res.redirect('/admin/settings?err=Normal+admin+password+must+be+at+least+6+characters');
                }
                const hash = await bcrypt.hash(staffPassword, 10);
                updates.push("password_hash = ?");
                params.push(hash);
            }

            if (updates.length > 0) {
                updates.push("updated_at = datetime('now')");
                params.push(normalAdmin.id);
                db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
            }
        }

        res.redirect('/admin/settings?msg=Normal+admin+permissions+and+account+updated+successfully');
    } catch (err) {
        console.error('Permission update error:', err);
        res.redirect('/admin/settings?err=Failed+to+update+permissions');
    }
});

// POST /admin/settings/password — Change password
router.post('/settings/password', async (req, res) => {
    try {
        const bcrypt = require('bcryptjs');
        const db = getDb();
        const { current_password, new_password, confirm_password } = req.body;

        if (!current_password || !new_password || !confirm_password) {
            return res.redirect('/admin/settings?err=All+password+fields+are+required');
        }

        if (new_password !== confirm_password) {
            return res.redirect('/admin/settings?err=New+passwords+do+not+match');
        }

        if (new_password.length < 8) {
            return res.redirect('/admin/settings?err=New+password+must+be+at+least+8+characters');
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
        if (!user) {
            return res.redirect('/admin/settings?err=User+not+found');
        }

        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) {
            return res.redirect('/admin/settings?err=Current+password+is+incorrect');
        }

        const salt = await bcrypt.genSalt(12);
        const hash = await bcrypt.hash(new_password, salt);

        db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
            .run(hash, req.session.userId);

        res.redirect('/admin/settings?msg=Password+updated+successfully');
    } catch (err) {
        console.error('Password change error:', err);
        res.redirect('/admin/settings?err=Failed+to+change+password');
    }
});

// Fallback: any other unmatched /admin/* route redirects directly to appropriate admin landing page
router.use((req, res) => {
    const cleanUrl = (req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '');
    if (req.session && req.session.userRole === 'superadmin') {
        if (cleanUrl === '/admin/dashboard') return res.status(404).render('public/404', { title: 'Page Not Found' });
        return res.redirect('/admin/dashboard');
    }
    const db = getDb();
    const perms = res.locals.userPermissions || getAdminPermissions(db);
    const target = perms.dashboard ? '/admin/dashboard' : '/admin/leads';
    if (cleanUrl === target) {
        return res.status(404).render('public/404', { title: 'Page Not Found' });
    }
    return res.redirect(target);
});

module.exports = router;

