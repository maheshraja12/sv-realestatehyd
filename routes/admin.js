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
    let lead = null;
    try {
        lead = db.prepare(`
            SELECT l.*, p.title as property_title, p.property_code, p.price as property_price,
                p.category as property_cat, p.locality as property_locality,
                u.name as agent_name
            FROM leads l
            LEFT JOIN properties p ON l.property_id = p.id
            LEFT JOIN users u ON l.assigned_agent_id = u.id
            WHERE l.id = ?
        `).get(req.params.id);
    } catch (e) {}

    // Check Cloud (Supabase / PostgreSQL) if not found in local SQLite
    if (!lead && (process.env.VERCEL || isPostgresConfigured())) {
        try {
            const pgResult = await getPgLeadById(req.params.id);
            if (pgResult && pgResult.success && pgResult.data) {
                const e = pgResult.data;
                lead = {
                    id: e.id,
                    lead_code: e.lead_code || `SV-LEAD-${String(e.id).padStart(5, '0')}`,
                    customer_name: e.customer_name || e.full_name || 'Interested Buyer',
                    full_name: e.full_name || e.customer_name || 'Interested Buyer',
                    phone: e.phone || e.phone_number,
                    phone_number: e.phone_number || e.phone,
                    email: e.email,
                    property_id: e.property_id,
                    property_requirement: e.property_requirement || e.property_category || 'General Enquiry',
                    property_category: e.property_category || e.property_requirement || 'General Enquiry',
                    budget: e.budget,
                    preferred_location: e.preferred_location,
                    message: e.message || `Requirement: ${e.property_requirement || 'Property Enquiry'}`,
                    contact_preference: e.contact_preference || 'phone',
                    appointment_date: e.appointment_date || e.preferred_visit_date,
                    appointment_time: e.appointment_time,
                    status: (e.status || 'new').toLowerCase(),
                    created_at: e.created_at,
                    property_title: null,
                    property_code: null,
                    property_price: null,
                    property_cat: null,
                    property_locality: null,
                    agent_name: 'Unassigned'
                };
            }
        } catch (cloudErr) {
            console.error('[ADMIN LEAD DETAIL] Cloud fetch error:', cloudErr.message);
        }
    }

    if (!lead) {
        return res.redirect('/admin/leads');
    }

    let notes = [];
    try {
        notes = db.prepare(`
            SELECT n.*, u.name as user_name
            FROM lead_notes n
            LEFT JOIN users u ON n.user_id = u.id
            WHERE n.lead_id = ?
            ORDER BY n.created_at DESC
        `).all(lead.id);
    } catch (e) {}

    let statusHistory = [];
    try {
        statusHistory = db.prepare(`
            SELECT h.*, u.name as changed_by_name
            FROM lead_status_history h
            LEFT JOIN users u ON h.changed_by = u.id
            WHERE h.lead_id = ?
            ORDER BY h.created_at DESC
        `).all(lead.id);
    } catch (e) {}

    let appointments = [];
    try {
        appointments = db.prepare(`
            SELECT * FROM appointments WHERE lead_id = ? ORDER BY created_at DESC
        `).all(lead.id);
    } catch (e) {}

    let agents = [];
    try {
        agents = db.prepare("SELECT id, name FROM users WHERE is_active = 1").all();
    } catch (e) {}

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

    // Check PostgreSQL / Supabase cloud first when on Vercel or configured
    if (process.env.VERCEL || isPostgresConfigured()) {
        try {
            const pgResult = await fetchPgAppointments({ status });
            if (pgResult && pgResult.success && pgResult.data) {
                const total = pgResult.data.length;
                const totalPages = Math.ceil(total / limit) || 1;
                const paged = pgResult.data.slice(offset, offset + limit).map(a => ({
                    id: a.id,
                    appointment_code: a.appointment_code || `SV-VISIT-${String(a.id).padStart(5, '0')}`,
                    customer_name: a.customer_name || 'Visitor',
                    phone: a.phone,
                    requested_date: a.requested_date,
                    requested_time: a.requested_time,
                    confirmed_date: a.confirmed_date,
                    confirmed_time: a.confirmed_time,
                    status: a.status || 'requested',
                    notes: a.notes,
                    property_title: 'Direct Enquiry',
                    property_code: null,
                    agent_name: 'Unassigned'
                }));
                let agents = [];
                try { agents = db.prepare("SELECT id, name FROM users WHERE is_active = 1").all(); } catch (e) {}
                return res.render('admin/appointments', {
                    title: 'Site Visits — SV Real Estates Admin',
                    appointments: paged,
                    agents,
                    page,
                    totalPages,
                    total,
                    status,
                    unreadNotifications: 0
                });
            }
        } catch (cloudAptErr) {
            console.error('[ADMIN APPOINTMENTS] Cloud fetch notice:', cloudAptErr.message);
        }
    }

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


// ==============================================================
// WEBSITE CONTROL CENTER (SUPER ADMIN CMS)
// ==============================================================

// GET /admin/cms — Central Website CMS Dashboard
router.get('/cms', requireSuperAdmin, (req, res) => {
    const db = getDb();
    const settings = {};
    const rows = db.prepare('SELECT key, value FROM settings').all();
    rows.forEach(r => { settings[r.key] = r.value; });

    let leadership = [];
    try {
        leadership = db.prepare('SELECT * FROM leadership_profiles ORDER BY display_order ASC, id ASC').all();
    } catch (e) {}

    let auditLogs = [];
    try {
        auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 30').all();
    } catch (e) {}

    let interiorServices = [];
    try {
        interiorServices = db.prepare('SELECT * FROM interior_services ORDER BY display_order ASC, id ASC').all();
    } catch (e) {}

    const message = req.query.msg || null;
    const error = req.query.err || null;

    res.render('admin/cms', {
        title: 'Website Control Center — SV Real Estates Super Admin',
        settings,
        leadership,
        interiorServices,
        auditLogs,
        message,
        error,
        unreadNotifications: 0
    });
});

// POST /admin/cms/services — Update Service Details & Visibility
router.post('/cms/services', requireSuperAdmin, (req, res) => {
    try {
        const db = getDb();
        const { service_id, starting_price, is_active } = req.body;
        if (service_id) {
            db.prepare("UPDATE interior_services SET starting_price = COALESCE(?, starting_price), is_active = ?, updated_at = datetime('now') WHERE id = ?")
                .run(starting_price || null, is_active ? 1 : 0, parseInt(service_id, 10));
            const { auditLog } = require('../middleware/auth');
            auditLog(db, req.session.userId, req.session.userName, 'update', 'service', parseInt(service_id, 10), `Updated service #${service_id}`, req.ip);
        }
        res.redirect('/admin/cms?msg=Service+settings+updated+successfully');
    } catch (err) {
        console.error('Error updating CMS service:', err);
        res.redirect('/admin/cms?err=Failed+to+update+service+settings');
    }
});

// POST /admin/cms/company — Save Business Identity & Contact Info
router.post('/cms/company', requireSuperAdmin, (req, res) => {
    try {
        const db = getDb();
        const allowed = [
            'business_name', 'business_tagline', 'business_phone', 'business_whatsapp',
            'business_email', 'business_address', 'business_instagram', 'business_hours'
        ];
        const upsert = db.prepare(`
            INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
        `);
        for (const k of allowed) {
            if (req.body[k] !== undefined) upsert.run(k, String(req.body[k]).trim());
        }
        auditLog(db, req.session.userId, req.session.userName, 'update_company_profile', 'settings', null, 'Company profile details updated', req.ip);
        res.redirect('/admin/cms?msg=Company+profile+saved+successfully');
    } catch (e) {
        res.redirect('/admin/cms?err=Failed+to+save+company+profile');
    }
});

// POST /admin/cms/leadership — Add New Leadership Profile
router.post('/cms/leadership', requireSuperAdmin, (req, res) => {
    try {
        const db = getDb();
        const { name, designation, role_type, bio, experience_years, photo_url, linkedin_url, show_on_about, show_on_home, is_active } = req.body;
        db.prepare(`
            INSERT INTO leadership_profiles (name, designation, role_type, bio, experience_years, photo_url, linkedin_url, show_on_about, show_on_home, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            (name || '').trim(),
            (designation || '').trim(),
            role_type || 'director',
            (bio || '').trim(),
            parseInt(experience_years, 10) || 15,
            photo_url ? photo_url.trim() : null,
            linkedin_url ? linkedin_url.trim() : null,
            show_on_about ? 1 : 0,
            show_on_home ? 1 : 0,
            is_active ? 1 : 0
        );
        auditLog(db, req.session.userId, req.session.userName, 'create_leader', 'leadership_profiles', null, `Added leadership profile for ${name}`, req.ip);
        res.redirect('/admin/cms?msg=Leadership+profile+added+successfully');
    } catch (e) {
        res.redirect('/admin/cms?err=Failed+to+add+leadership+profile');
    }
});

// POST /admin/cms/leadership/:id/delete — Delete Leadership Profile
router.post('/cms/leadership/:id/delete', requireSuperAdmin, (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM leadership_profiles WHERE id = ?').run(req.params.id);
        auditLog(db, req.session.userId, req.session.userName, 'delete_leader', 'leadership_profiles', req.params.id, 'Deleted leadership profile', req.ip);
        res.redirect('/admin/cms?msg=Leadership+profile+deleted');
    } catch (e) {
        res.redirect('/admin/cms?err=Failed+to+delete+leadership+profile');
    }
});

// POST /admin/cms/homepage — Save Homepage Copy & Statistics
router.post('/cms/homepage', requireSuperAdmin, (req, res) => {
    try {
        const db = getDb();
        const allowed = ['hero_headline', 'hero_subheading', 'stat_years', 'stat_acres', 'stat_titles', 'stat_clients'];
        const upsert = db.prepare(`
            INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
        `);
        for (const k of allowed) {
            if (req.body[k] !== undefined) upsert.run(k, String(req.body[k]).trim());
        }
        auditLog(db, req.session.userId, req.session.userName, 'update_homepage_copy', 'settings', null, 'Homepage hero copy and statistics updated', req.ip);
        res.redirect('/admin/cms?msg=Homepage+content+saved+successfully');
    } catch (e) {
        res.redirect('/admin/cms?err=Failed+to+save+homepage+content');
    }
});

// POST /admin/cms/seo — Save Search Engine Meta
router.post('/cms/seo', requireSuperAdmin, (req, res) => {
    try {
        const db = getDb();
        const allowed = ['seo_default_title', 'seo_default_desc', 'seo_keywords'];
        const upsert = db.prepare(`
            INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
        `);
        for (const k of allowed) {
            if (req.body[k] !== undefined) upsert.run(k, String(req.body[k]).trim());
        }
        auditLog(db, req.session.userId, req.session.userName, 'update_seo', 'settings', null, 'SEO defaults updated', req.ip);
        res.redirect('/admin/cms?msg=SEO+defaults+saved+successfully');
    } catch (e) {
        res.redirect('/admin/cms?err=Failed+to+save+SEO+defaults');
    }
});

// POST /admin/cms/branding — Save Theme & WhatsApp Toggle
router.post('/cms/branding', requireSuperAdmin, (req, res) => {
    try {
        const db = getDb();
        const upsert = db.prepare(`
            INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
        `);
        if (req.body.theme_accent_gold) upsert.run('theme_accent_gold', req.body.theme_accent_gold.trim());
        if (req.body.theme_primary_color) upsert.run('theme_primary_color', req.body.theme_primary_color.trim());
        upsert.run('whatsapp_floating_enabled', req.body.whatsapp_floating_enabled ? '1' : '0');
        upsert.run('announcement_bar_enabled', req.body.announcement_bar_enabled ? '1' : '0');
        if (req.body.announcement_text !== undefined) upsert.run('announcement_text', req.body.announcement_text.trim());

        auditLog(db, req.session.userId, req.session.userName, 'update_branding', 'settings', null, 'Branding settings updated', req.ip);
        res.redirect('/admin/cms?msg=Branding+settings+updated+successfully');
    } catch (e) {
        res.redirect('/admin/cms?err=Failed+to+save+branding+settings');
    }
});

// ==============================================================
// HOME INTERIORS MANAGEMENT ROUTES
// ==============================================================

// GET /admin/interiors — List All Interior Projects
router.get('/interiors', requirePermission('interiors'), (req, res) => {
    const db = getDb();
    let projects = [];
    try {
        projects = db.prepare('SELECT * FROM interior_projects ORDER BY is_featured DESC, id DESC').all();
    } catch (e) {}
    const message = req.query.msg || null;
    res.render('admin/interiors', {
        title: 'Home Interiors Management — SV Real Estates Admin',
        projects,
        message,
        unreadNotifications: 0
    });
});

// GET /admin/interiors/new — Form for New Interior Project
router.get('/interiors/new', requirePermission('interiors'), (req, res) => {
    res.render('admin/interior-form', {
        title: 'Add New Interior Project — SV Real Estates Admin',
        project: null,
        unreadNotifications: 0
    });
});

// GET /admin/interiors/:id/edit — Edit Existing Interior Project
router.get('/interiors/:id/edit', requirePermission('interiors'), (req, res) => {
    const db = getDb();
    let project = null;
    try {
        project = db.prepare('SELECT * FROM interior_projects WHERE id = ?').get(req.params.id);
    } catch (e) {}
    if (!project) return res.redirect('/admin/interiors');
    const bImg = db.prepare("SELECT image_url FROM interior_project_images WHERE project_id = ? AND image_type = 'before' LIMIT 1").get(project.id);
    const aImg = db.prepare("SELECT image_url FROM interior_project_images WHERE project_id = ? AND image_type = 'after' LIMIT 1").get(project.id);
    project.before_image = bImg ? bImg.image_url : '';
    project.after_image = aImg ? aImg.image_url : '';
    res.render('admin/interior-form', {
        title: `Edit ${project.title} — SV Real Estates Admin`,
        project,
        unreadNotifications: 0
    });
});

// POST /admin/interiors — Create Interior Project
router.post('/interiors', requirePermission('interiors'), (req, res) => {
    try {
        const db = getDb();
        const { title, locality, property_type, bhk_config, design_style, budget_range, cover_image, short_description, description, is_featured, is_published } = req.body;
        const slug = (title || 'interior-project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);
        const code = `SV-INT-${Date.now().toString().slice(-5)}`;
        const result = db.prepare(`
            INSERT INTO interior_projects (
                project_code, title, slug, locality, city, property_type, bhk_config,
                design_style, budget_range, completion_status, short_description, description,
                cover_image, is_featured, is_published
            ) VALUES (?, ?, ?, ?, 'Hyderabad', ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)
        `).run(
            code, (title || '').trim(), slug, (locality || 'Hyderabad').trim(),
            property_type || 'Apartment', bhk_config || '3BHK',
            design_style || 'Contemporary Modern', (budget_range || '').trim(),
            (short_description || '').trim(), (description || '').trim(),
            cover_image ? cover_image.trim() : null,
            is_featured ? 1 : 0, is_published ? 1 : 0
        );
        const newProjId = result.lastInsertRowid;
        if (req.body.before_image) {
            db.prepare("INSERT INTO interior_project_images (project_id, image_url, title, image_type, is_before_after, display_order) VALUES (?, ?, 'Before Construction', 'before', 1, 10)").run(newProjId, req.body.before_image.trim());
        }
        if (req.body.after_image) {
            db.prepare("INSERT INTO interior_project_images (project_id, image_url, title, image_type, is_before_after, display_order) VALUES (?, ?, 'After Completion', 'after', 1, 11)").run(newProjId, req.body.after_image.trim());
        }
        auditLog(db, req.session.userId, req.session.userName, 'create_interior_project', 'interior_projects', newProjId, `Created interior project: ${title}`, req.ip);
        res.redirect('/admin/interiors?msg=Interior+project+created+successfully');
    } catch (e) {
        res.redirect('/admin/interiors?err=Failed+to+create+interior+project');
    }
});

// POST /admin/interiors/:id — Update Interior Project
router.post('/interiors/:id', requirePermission('interiors'), (req, res) => {
    try {
        const db = getDb();
        const { title, locality, property_type, bhk_config, design_style, budget_range, cover_image, short_description, description, is_featured, is_published } = req.body;
        db.prepare(`
            UPDATE interior_projects SET
                title = ?, locality = ?, property_type = ?, bhk_config = ?, design_style = ?,
                budget_range = ?, cover_image = ?, short_description = ?, description = ?,
                is_featured = ?, is_published = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(
            (title || '').trim(), (locality || 'Hyderabad').trim(),
            property_type || 'Apartment', bhk_config || '3BHK',
            design_style || 'Contemporary Modern', (budget_range || '').trim(),
            cover_image ? cover_image.trim() : null,
            (short_description || '').trim(), (description || '').trim(),
            is_featured ? 1 : 0, is_published ? 1 : 0,
            req.params.id
        );
        const updProjId = parseInt(req.params.id, 10);
        if (req.body.before_image) {
            db.prepare("DELETE FROM interior_project_images WHERE project_id = ? AND image_type = 'before'").run(updProjId);
            db.prepare("INSERT INTO interior_project_images (project_id, image_url, title, image_type, is_before_after, display_order) VALUES (?, ?, 'Before Construction', 'before', 1, 10)").run(updProjId, req.body.before_image.trim());
        }
        if (req.body.after_image) {
            db.prepare("DELETE FROM interior_project_images WHERE project_id = ? AND image_type = 'after'").run(updProjId);
            db.prepare("INSERT INTO interior_project_images (project_id, image_url, title, image_type, is_before_after, display_order) VALUES (?, ?, 'After Completion', 'after', 1, 11)").run(updProjId, req.body.after_image.trim());
        }
        auditLog(db, req.session.userId, req.session.userName, 'update_interior_project', 'interior_projects', req.params.id, `Updated interior project #${req.params.id}`, req.ip);
        res.redirect('/admin/interiors?msg=Interior+project+updated+successfully');
    } catch (e) {
        res.redirect('/admin/interiors?err=Failed+to+update+interior+project');
    }
});

// POST /admin/interiors/:id/delete — Delete Interior Project
router.post('/interiors/:id/delete', requirePermission('interiors'), (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM interior_projects WHERE id = ?').run(req.params.id);
        auditLog(db, req.session.userId, req.session.userName, 'delete_interior_project', 'interior_projects', req.params.id, 'Deleted interior project', req.ip);
        res.redirect('/admin/interiors?msg=Interior+project+deleted');
    } catch (e) {
        res.redirect('/admin/interiors?err=Failed+to+delete+interior+project');
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

