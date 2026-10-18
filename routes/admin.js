/**
 * Admin Page Routes — Dashboard, Properties, Leads, Appointments, Settings
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { cloudLeadsConfigured, listCloudLeads, listCloudProperties } = require('../database/cloud-leads');
const { enhanceProperty, enhancePropertyList } = require('../database/property-media');
const { requireAuth } = require('../middleware/auth');
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

// GET /admin/dashboard
router.get('/dashboard', async (req, res) => {
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
        const recentProperties = recentPropertiesResult.properties || [];
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

    // If PostgreSQL / Supabase is configured, fetch live stats and recent leads from PostgreSQL
    if (isPostgresConfigured()) {
        try {
            const pgStats = await getPgLeadStats();
            if (pgStats.success && pgStats.total > 0) {
                stats.totalLeads = pgStats.total;
                stats.newLeads = pgStats.newCount;
            }

            const pgAptStats = await getPgAppointmentStats();
            if (pgAptStats.success && (pgAptStats.total > 0 || pgAptStats.pendingCount > 0)) {
                stats.siteVisitsScheduled = pgAptStats.pendingCount;
            }

            const pgRecent = await fetchPgLeads({ limit: 10 });
            if (pgRecent.success && pgRecent.data.length > 0) {
                recentLeads = pgRecent.data.map(e => ({
                    id: e.id,
                    lead_code: e.lead_code || `SV-LEAD-${String(e.id).padStart(5, '0')}`,
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
            }
        } catch (pgErr) {
            console.error('Error fetching PostgreSQL dashboard data:', pgErr);
        }
    } else if (isMySqlConfigured()) {
        try {
            const sqlStats = await getEnquiryStats();
            if (sqlStats.success && sqlStats.total > 0) {
                stats.totalLeads = sqlStats.total;
                stats.newLeads = sqlStats.newCount;
            }

            const sqlRecent = await fetchEnquiries({ limit: 10 });
            if (sqlRecent.success && sqlRecent.data.length > 0) {
                recentLeads = sqlRecent.data.map(e => ({
                    id: e.id,
                    lead_code: e.lead_code || `SV-ENQ-${String(e.id).padStart(5, '0')}`,
                    full_name: e.full_name,
                    customer_name: e.full_name,
                    phone_number: e.phone_number,
                    phone: e.phone_number,
                    appointment_date: e.appointment_date,
                    appointment_time: e.appointment_time,
                    property_requirement: e.property_requirement,
                    property_category: e.property_requirement,
                    status: (e.status || 'New').toLowerCase(),
                    created_at: e.created_at,
                    property_title: null
                }));
            }
        } catch (sqlErr) {
            console.error('Error fetching MySQL dashboard data:', sqlErr);
        }
    }

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
router.get('/properties', async (req, res) => {
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
router.get('/properties/new', (req, res) => {
    res.render('admin/property-form', {
        title: 'Add New Property — SV Real Estates Admin',
        property: null,
        images: [],
        isEdit: false,
        unreadNotifications: 0
    });
});

// GET /admin/properties/:id/edit
router.get('/properties/:id/edit', async (req, res) => {
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
router.get('/leads', async (req, res) => {
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

    let leads = [];
    let total = 0;

    if (isPostgresConfigured()) {
        try {
            const pgResult = await fetchPgLeads({
                status,
                search,
                category,
                limit,
                offset
            });
            if (pgResult.success && pgResult.data.length > 0) {
                total = pgResult.count;
                leads = pgResult.data.map(e => ({
                    id: e.id,
                    lead_code: e.lead_code || `SV-LEAD-${String(e.id).padStart(5, '0')}`,
                    full_name: e.full_name || e.customer_name,
                    customer_name: e.customer_name || e.full_name,
                    phone_number: e.phone_number || e.phone,
                    phone: e.phone || e.phone_number,
                    appointment_date: e.appointment_date,
                    appointment_time: e.appointment_time,
                    property_requirement: e.property_requirement,
                    property_category: e.property_category || e.property_requirement,
                    budget: e.budget,
                    preferred_location: e.preferred_location,
                    status: (e.status || 'new').toLowerCase(),
                    created_at: e.created_at,
                    property_title: null,
                    agent_name: 'Unassigned'
                }));
            }
        } catch (pgErr) {
            console.error('Error fetching leads from PostgreSQL:', pgErr);
        }
    } else if (isMySqlConfigured()) {
        try {
            const sqlResult = await fetchEnquiries({
                status,
                search,
                limit,
                offset
            });
            if (sqlResult.success) {
                total = sqlResult.count;
                leads = sqlResult.data.map(e => ({
                    id: e.id,
                    lead_code: e.lead_code || `SV-ENQ-${String(e.id).padStart(5, '0')}`,
                    full_name: e.full_name,
                    customer_name: e.full_name,
                    phone_number: e.phone_number,
                    phone: e.phone_number,
                    appointment_date: e.appointment_date,
                    appointment_time: e.appointment_time,
                    property_requirement: e.property_requirement,
                    property_category: e.property_requirement,
                    status: (e.status || 'New').toLowerCase(),
                    created_at: e.created_at,
                    property_title: null,
                    agent_name: 'Unassigned'
                }));
            }
        } catch (sqlErr) {
            console.error('Error fetching leads from MySQL:', sqlErr);
        }
    }

    // Fallback to local DB if cloud DB not configured or returns empty
    if ((!isPostgresConfigured() && !isMySqlConfigured()) || leads.length === 0) {
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

        const localTotal = db.prepare(`SELECT COUNT(*) as count FROM leads l WHERE ${where}`).get(...params).count;
        const localLeads = db.prepare(`
            SELECT l.*, p.title as property_title, p.property_code as property_code,
                u.name as agent_name
            FROM leads l
            LEFT JOIN properties p ON l.property_id = p.id
            LEFT JOIN users u ON l.assigned_agent_id = u.id
            WHERE ${where}
            ORDER BY l.id DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        if (!isMySqlConfigured() || leads.length === 0) {
            total = localTotal;
            leads = localLeads;
        }
    }

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

    if (isPostgresConfigured()) {
        try {
            const pgResult = await getPgLeadById(req.params.id);
            if (pgResult.success && pgResult.data) {
                const e = pgResult.data;
                lead = {
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
                    status: (e.status || 'new').toLowerCase(),
                    created_at: e.created_at,
                    source: e.source || 'website',
                    message: e.message || `Requirement: ${e.property_requirement}`,
                    property_title: null,
                    agent_name: 'Unassigned'
                };
            }
        } catch (pgErr) {
            console.error('Error fetching lead detail from PostgreSQL:', pgErr);
        }
    } else if (isMySqlConfigured()) {
        try {
            const sqlResult = await getEnquiryById(req.params.id);
            if (sqlResult.success && sqlResult.data) {
                const e = sqlResult.data;
                lead = {
                    id: e.id,
                    lead_code: e.lead_code || `SV-ENQ-${String(e.id).padStart(5, '0')}`,
                    full_name: e.full_name,
                    customer_name: e.full_name,
                    phone_number: e.phone_number,
                    phone: e.phone_number,
                    email: e.email || null,
                    appointment_date: e.appointment_date,
                    appointment_time: e.appointment_time,
                    property_requirement: e.property_requirement,
                    property_category: e.property_requirement,
                    status: (e.status || 'New').toLowerCase(),
                    created_at: e.created_at,
                    source: e.source || 'website',
                    message: e.message || `Requirement: ${e.property_requirement}`,
                    property_title: null,
                    property_code: null,
                    property_price: null,
                    property_cat: null,
                    property_locality: null,
                    agent_name: 'Unassigned'
                };
            }
        } catch (sqlErr) {
            console.error('Error fetching lead detail from MySQL:', sqlErr);
        }
    }

    if (!lead) {
        lead = db.prepare(`
            SELECT l.*, p.title as property_title, p.property_code, p.price as property_price,
                p.category as property_cat, p.locality as property_locality,
                u.name as agent_name
            FROM leads l
            LEFT JOIN properties p ON l.property_id = p.id
            LEFT JOIN users u ON l.assigned_agent_id = u.id
            WHERE l.id = ?
        `).get(req.params.id);
    }

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
router.get('/appointments', async (req, res) => {
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

    let total = 0;
    let appointments = [];

    if (isPostgresConfigured()) {
        try {
            const pgResult = await fetchPgAppointments({ status, limit, offset });
            if (pgResult.success && pgResult.data.length > 0) {
                total = pgResult.count;
                appointments = pgResult.data.map(a => ({
                    id: a.id,
                    appointment_code: a.appointment_code,
                    customer_name: a.customer_name,
                    phone: a.phone,
                    requested_date: a.requested_date,
                    requested_time: a.requested_time,
                    confirmed_date: a.confirmed_date,
                    confirmed_time: a.confirmed_time,
                    status: a.status,
                    notes: a.notes,
                    property_title: 'Direct Enquiry',
                    property_code: 'SV-DIRECT',
                    agent_name: 'Unassigned'
                }));
            }
        } catch (pgErr) {
            console.error('Error fetching appointments from PostgreSQL:', pgErr);
        }
    }

    if (!isPostgresConfigured() || appointments.length === 0) {
        total = db.prepare(`SELECT COUNT(*) as count FROM appointments a WHERE ${where}`).get(...params).count;
        appointments = db.prepare(`
            SELECT a.*, p.title as property_title, p.property_code,
                u.name as agent_name
            FROM appointments a
            LEFT JOIN properties p ON a.property_id = p.id
            LEFT JOIN users u ON a.assigned_agent_id = u.id
            WHERE ${where}
            ORDER BY a.requested_date ASC, a.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);
    }

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

// GET /admin/settings
router.get('/settings', (req, res) => {
    const db = getDb();
    const settings = {};
    const rows = db.prepare('SELECT key, value FROM settings').all();
    rows.forEach(r => { settings[r.key] = r.value; });

    const message = req.query.msg || null;
    const error = req.query.err || null;

    res.render('admin/settings', {
        title: 'Settings — SV Real Estates Admin',
        settings,
        message,
        error,
        postgresConfigured: isPostgresConfigured(),
        unreadNotifications: 0
    });
});

// POST /admin/settings — Save settings
router.post('/settings', (req, res) => {
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

module.exports = router;

