/**
 * Admin Page Routes — Dashboard, Properties, Leads, Appointments, Settings
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { 
    isSupabaseConfigured, 
    fetchEnquiries, 
    getEnquiryById, 
    getEnquiryStats 
} = require('../database/supabase');

// All admin routes require authentication
router.use(requireAuth);

// GET /admin/dashboard
router.get('/dashboard', async (req, res) => {
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

    // If Supabase is configured, fetch live stats and recent enquiries from Supabase PostgreSQL
    if (isSupabaseConfigured()) {
        try {
            const sbStats = await getEnquiryStats();
            if (sbStats.success) {
                stats.totalLeads = sbStats.total;
                stats.newLeads = sbStats.newCount;
            }

            const sbRecent = await fetchEnquiries({ limit: 10 });
            if (sbRecent.success && sbRecent.data.length > 0) {
                recentLeads = sbRecent.data.map(e => ({
                    id: e.id,
                    lead_code: `SV-ENQ-${String(e.id).padStart(5, '0')}`,
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
        } catch (sbErr) {
            console.error('Error fetching Supabase dashboard data:', sbErr);
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
router.get('/properties', (req, res) => {
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
    const properties = db.prepare(`
        SELECT p.*, 
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image,
            (SELECT COUNT(*) FROM leads WHERE property_id = p.id) as lead_count
        FROM properties p
        WHERE ${where}
        ORDER BY p.updated_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

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
router.get('/properties/:id/edit', (req, res) => {
    const db = getDb();
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
    
    if (!property) {
        return res.redirect('/admin/properties');
    }

    const images = db.prepare('SELECT * FROM property_images WHERE property_id = ? ORDER BY display_order').all(property.id);

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

    let leads = [];
    let total = 0;

    if (isSupabaseConfigured()) {
        try {
            const sbResult = await fetchEnquiries({
                status,
                search,
                limit,
                offset
            });
            if (sbResult.success) {
                total = sbResult.count;
                leads = sbResult.data.map(e => ({
                    id: e.id,
                    lead_code: `SV-ENQ-${String(e.id).padStart(5, '0')}`,
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
        } catch (sbErr) {
            console.error('Error fetching leads from Supabase:', sbErr);
        }
    }

    // Fallback to local DB if Supabase not configured or returns empty on default view
    if (!isSupabaseConfigured() || (leads.length === 0 && !search && !status && !category)) {
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

        if (!isSupabaseConfigured() || leads.length === 0) {
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

    if (isSupabaseConfigured()) {
        try {
            const sbResult = await getEnquiryById(req.params.id);
            if (sbResult.success && sbResult.data) {
                const e = sbResult.data;
                lead = {
                    id: e.id,
                    lead_code: `SV-ENQ-${String(e.id).padStart(5, '0')}`,
                    full_name: e.full_name,
                    customer_name: e.full_name,
                    phone_number: e.phone_number,
                    phone: e.phone_number,
                    email: null,
                    appointment_date: e.appointment_date,
                    appointment_time: e.appointment_time,
                    property_requirement: e.property_requirement,
                    property_category: e.property_requirement,
                    status: (e.status || 'New').toLowerCase(),
                    created_at: e.created_at,
                    source: 'website',
                    message: `Requirement: ${e.property_requirement}`,
                    property_title: null,
                    property_code: null,
                    property_price: null,
                    property_cat: null,
                    property_locality: null,
                    agent_name: 'Unassigned'
                };
            }
        } catch (sbErr) {
            console.error('Error fetching lead detail from Supabase:', sbErr);
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
router.get('/appointments', (req, res) => {
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

    const total = db.prepare(`SELECT COUNT(*) as count FROM appointments a WHERE ${where}`).get(...params).count;
    const appointments = db.prepare(`
        SELECT a.*, p.title as property_title, p.property_code,
            u.name as agent_name
        FROM appointments a
        LEFT JOIN properties p ON a.property_id = p.id
        LEFT JOIN users u ON a.assigned_agent_id = u.id
        WHERE ${where}
        ORDER BY a.requested_date ASC, a.created_at DESC
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
        unreadNotifications: 0
    });
});

// POST /admin/settings — Save settings
router.post('/settings', (req, res) => {
    try {
        const db = getDb();
        const allowedKeys = [
            'business_name', 'business_phone', 'business_email',
            'business_whatsapp', 'business_address', 'smtp_host',
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

