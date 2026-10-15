/**
 * SV Real Estates Hyderabad — PostgreSQL / Supabase / Vercel Postgres Database Client
 * Provides persistent cloud storage for Leads, Appointments, and Sessions across ephemeral Vercel Serverless instances.
 */
require('dotenv').config();
const { Pool } = require('pg');

const rawConnectionString = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.SUPABASE_DB_URL ||
    ''
).trim();

function isPostgresConfigured() {
    if (rawConnectionString && (rawConnectionString.startsWith('postgres://') || rawConnectionString.startsWith('postgresql://'))) {
        return true;
    }
    if (process.env.PGHOST && process.env.PGHOST.trim() !== '') {
        return true;
    }
    return false;
}

let pool = null;
let tablesInitialized = false;

function getPoolConfig() {
    if (rawConnectionString) {
        const isCloudHost = rawConnectionString.includes('supabase.co') ||
                            rawConnectionString.includes('neon.tech') ||
                            rawConnectionString.includes('vercel-storage.com') ||
                            rawConnectionString.includes('render.com') ||
                            rawConnectionString.includes('railway.app') ||
                            rawConnectionString.includes('aivencloud.com') ||
                            rawConnectionString.includes('amazonaws.com') ||
                            process.env.PGSSLMODE === 'require' ||
                            process.env.NODE_ENV === 'production';

        return {
            connectionString: rawConnectionString,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            ssl: isCloudHost ? { rejectUnauthorized: false } : undefined
        };
    }

    const host = process.env.PGHOST || 'localhost';
    const port = parseInt(process.env.PGPORT, 10) || 5432;
    const user = process.env.PGUSER || 'postgres';
    const password = process.env.PGPASSWORD || '';
    const database = process.env.PGDATABASE || 'postgres';

    const isCloudHost = host.includes('supabase.co') ||
                        host.includes('neon.tech') ||
                        host.includes('vercel-storage.com') ||
                        process.env.NODE_ENV === 'production';

    return {
        host,
        port,
        user,
        password,
        database,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: isCloudHost ? { rejectUnauthorized: false } : undefined
    };
}

function getPgPool() {
    if (!pool && isPostgresConfigured()) {
        try {
            pool = new Pool(getPoolConfig());
            pool.on('error', (err) => {
                console.error('⚠️ [POSTGRES] Unexpected idle client error:', err.message);
            });
            console.log('✅ [POSTGRES] Connection pool initialized for cloud database');
            // Auto-initialize required tables in the background
            initializePostgresTables().catch(err => {
                console.warn('⚠️ [POSTGRES] Background table init notice:', err.message);
            });
        } catch (err) {
            console.error('❌ [POSTGRES] Pool creation failed:', err.message);
        }
    }
    return pool;
}

/**
 * Automatically creates leads, appointments, and session tables if they do not exist
 */
async function initializePostgresTables() {
    if (tablesInitialized || !isPostgresConfigured()) return;
    const p = getPgPool();
    if (!p) return;

    try {
        const client = await p.connect();
        try {
            // 1. Session table for connect-pg-simple
            await client.query(`
                CREATE TABLE IF NOT EXISTS "session" (
                    "sid" varchar NOT NULL COLLATE "default",
                    "sess" json NOT NULL,
                    "expire" timestamp(6) NOT NULL,
                    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
                );
                CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
            `);

            // 2. Leads / Enquiries table
            await client.query(`
                CREATE TABLE IF NOT EXISTS leads (
                    id SERIAL PRIMARY KEY,
                    lead_code VARCHAR(50) UNIQUE,
                    customer_name VARCHAR(200) NOT NULL,
                    full_name VARCHAR(200),
                    phone VARCHAR(50) NOT NULL,
                    phone_number VARCHAR(50),
                    email VARCHAR(200),
                    property_id INT,
                    property_category VARCHAR(100),
                    property_requirement VARCHAR(200),
                    budget VARCHAR(100),
                    preferred_location VARCHAR(200),
                    message TEXT,
                    contact_preference VARCHAR(50) DEFAULT 'phone',
                    preferred_visit_date VARCHAR(50),
                    appointment_date VARCHAR(50),
                    appointment_time VARCHAR(50),
                    consent INT DEFAULT 1,
                    source VARCHAR(50) DEFAULT 'website',
                    status VARCHAR(50) DEFAULT 'new',
                    assigned_agent_id INT,
                    next_follow_up VARCHAR(50),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
                CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
                CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
            `);

            // 3. Appointments / Site Visits table
            await client.query(`
                CREATE TABLE IF NOT EXISTS appointments (
                    id SERIAL PRIMARY KEY,
                    appointment_code VARCHAR(50) UNIQUE,
                    lead_id INT,
                    property_id INT,
                    customer_name VARCHAR(200) NOT NULL,
                    phone VARCHAR(50) NOT NULL,
                    notes TEXT,
                    requested_date VARCHAR(50) NOT NULL,
                    requested_time VARCHAR(50),
                    confirmed_date VARCHAR(50),
                    confirmed_time VARCHAR(50),
                    status VARCHAR(50) DEFAULT 'requested',
                    assigned_agent_id INT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
                CREATE INDEX IF NOT EXISTS idx_appointments_created ON appointments(created_at DESC);
            `);

            // 4. Settings table
            await client.query(`
                CREATE TABLE IF NOT EXISTS settings (
                    key VARCHAR(100) PRIMARY KEY,
                    value TEXT,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);

            tablesInitialized = true;
            console.log('✅ [POSTGRES] Core cloud tables ("session", "leads", "appointments", "settings") verified & ready');
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('❌ [POSTGRES] Table initialization error:', err.message);
    }
}

/**
 * Insert a lead/enquiry into PostgreSQL
 */
async function insertLead(lead) {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true };
    const p = getPgPool();
    if (!p) return { success: false, notConfigured: true };

    try {
        const query = `
            INSERT INTO leads (
                lead_code, customer_name, full_name, phone, phone_number, email,
                property_id, property_category, property_requirement, budget, preferred_location,
                message, contact_preference, preferred_visit_date, appointment_date, appointment_time,
                consent, source, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
        `;

        const values = [
            lead.lead_code || `SV-LEAD-${Date.now().toString().slice(-6)}`,
            lead.customer_name || lead.full_name || 'Enquiry Client',
            lead.full_name || lead.customer_name || 'Enquiry Client',
            lead.phone || lead.phone_number || '',
            lead.phone_number || lead.phone || '',
            lead.email || null,
            lead.property_id ? parseInt(lead.property_id, 10) : null,
            lead.property_category || lead.property_requirement || 'Residential Plot',
            lead.property_requirement || lead.property_category || 'Residential Plot',
            lead.budget || 'Consult / Market Price',
            lead.preferred_location || 'Hyderabad',
            lead.message || null,
            lead.contact_preference || 'phone',
            lead.preferred_visit_date || lead.appointment_date || null,
            lead.appointment_date || lead.preferred_visit_date || null,
            lead.appointment_time || '10:00 AM - 12:00 PM',
            lead.consent !== undefined ? (lead.consent ? 1 : 0) : 1,
            lead.source || 'website',
            lead.status || 'new'
        ];

        const res = await p.query(query, values);
        return { success: true, data: res.rows[0] };
    } catch (err) {
        console.error('❌ [POSTGRES] insertLead error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Fetch leads from PostgreSQL with pagination and filters
 */
async function fetchLeads(options = {}) {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true, data: [], count: 0 };
    const p = getPgPool();
    if (!p) return { success: false, notConfigured: true, data: [], count: 0 };

    try {
        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (options.status) {
            conditions.push(`LOWER(status) = LOWER($${paramIdx++})`);
            params.push(options.status);
        }

        if (options.category) {
            conditions.push(`LOWER(property_category) = LOWER($${paramIdx++})`);
            params.push(options.category);
        }

        if (options.search) {
            const s = `%${options.search}%`;
            conditions.push(`(customer_name ILIKE $${paramIdx} OR phone ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR lead_code ILIKE $${paramIdx})`);
            paramIdx++;
            params.push(s);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Get total count
        const countRes = await p.query(`SELECT COUNT(*) as count FROM leads ${whereClause}`, params);
        const total = parseInt(countRes.rows[0]?.count || 0, 10);

        // Fetch paginated rows
        let query = `SELECT * FROM leads ${whereClause} ORDER BY id DESC`;
        if (options.limit) {
            query += ` LIMIT $${paramIdx++}`;
            params.push(parseInt(options.limit, 10));
        }
        if (options.offset) {
            query += ` OFFSET $${paramIdx++}`;
            params.push(parseInt(options.offset, 10));
        }

        const rowsRes = await p.query(query, params);
        return { success: true, data: rowsRes.rows, count: total };
    } catch (err) {
        console.error('❌ [POSTGRES] fetchLeads error:', err.message);
        return { success: false, error: err.message, data: [], count: 0 };
    }
}

/**
 * Get aggregated lead stats from PostgreSQL
 */
async function getLeadStats() {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true };
    const p = getPgPool();
    if (!p) return { success: false, notConfigured: true };

    try {
        const res = await p.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE LOWER(status) = 'new') as new_count,
                COUNT(*) FILTER (WHERE LOWER(status) = 'converted') as converted_count
            FROM leads
        `);
        const row = res.rows[0] || {};
        return {
            success: true,
            total: parseInt(row.total || 0, 10),
            newCount: parseInt(row.new_count || 0, 10),
            convertedCount: parseInt(row.converted_count || 0, 10)
        };
    } catch (err) {
        console.error('❌ [POSTGRES] getLeadStats error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Get single lead by ID
 */
async function getLeadById(id) {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true, data: null };
    const p = getPgPool();
    if (!p) return { success: false, notConfigured: true, data: null };

    try {
        const res = await p.query('SELECT * FROM leads WHERE id = $1', [id]);
        return { success: true, data: res.rows[0] || null };
    } catch (err) {
        return { success: false, error: err.message, data: null };
    }
}

/**
 * Update lead status
 */
async function updateLeadStatus(id, status) {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true };
    const p = getPgPool();
    if (!p) return { success: false, notConfigured: true };

    try {
        const res = await p.query(
            'UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, id]
        );
        return { success: true, data: res.rows[0] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Insert an appointment into PostgreSQL
 */
async function insertAppointment(apt) {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true };
    const p = getPgPool();
    if (!p) return { success: false, notConfigured: true };

    try {
        const query = `
            INSERT INTO appointments (
                appointment_code, lead_id, property_id, customer_name, phone,
                notes, requested_date, requested_time, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;
        const values = [
            apt.appointment_code || `SV-VISIT-${Date.now().toString().slice(-5)}`,
            apt.lead_id ? parseInt(apt.lead_id, 10) : null,
            apt.property_id ? parseInt(apt.property_id, 10) : null,
            apt.customer_name || 'Site Visit Visitor',
            apt.phone,
            apt.notes || null,
            apt.requested_date,
            apt.requested_time || null,
            apt.status || 'requested'
        ];
        const res = await p.query(query, values);
        return { success: true, data: res.rows[0] };
    } catch (err) {
        console.error('❌ [POSTGRES] insertAppointment error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Fetch appointments from PostgreSQL
 */
async function fetchAppointments(options = {}) {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true, data: [], count: 0 };
    const p = getPgPool();
    if (!p) return { success: false, notConfigured: true, data: [], count: 0 };

    try {
        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (options.status) {
            conditions.push(`LOWER(status) = LOWER($${paramIdx++})`);
            params.push(options.status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countRes = await p.query(`SELECT COUNT(*) as count FROM appointments ${whereClause}`, params);
        const total = parseInt(countRes.rows[0]?.count || 0, 10);

        let query = `SELECT * FROM appointments ${whereClause} ORDER BY requested_date ASC, id DESC`;
        if (options.limit) {
            query += ` LIMIT $${paramIdx++}`;
            params.push(parseInt(options.limit, 10));
        }
        if (options.offset) {
            query += ` OFFSET $${paramIdx++}`;
            params.push(parseInt(options.offset, 10));
        }

        const rowsRes = await p.query(query, params);
        return { success: true, data: rowsRes.rows, count: total };
    } catch (err) {
        console.error('❌ [POSTGRES] fetchAppointments error:', err.message);
        return { success: false, error: err.message, data: [], count: 0 };
    }
}

/**
 * Get appointment stats from PostgreSQL
 */
async function getAppointmentStats() {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true };
    const p = getPgPool();
    if (!p) return { success: false, notConfigured: true };

    try {
        const res = await p.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE LOWER(status) IN ('requested', 'confirmed')) as pending_count
            FROM appointments
        `);
        const row = res.rows[0] || {};
        return {
            success: true,
            total: parseInt(row.total || 0, 10),
            pendingCount: parseInt(row.pending_count || 0, 10)
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Test connectivity to PostgreSQL
 */
async function testConnection() {
    if (!isPostgresConfigured()) {
        return {
            connected: false,
            message: 'PostgreSQL/Supabase DATABASE_URL not configured'
        };
    }
    const p = getPgPool();
    if (!p) return { connected: false, message: 'Could not create connection pool' };

    try {
        const client = await p.connect();
        try {
            const res = await client.query('SELECT NOW() as now, current_database() as db');
            return {
                connected: true,
                database: res.rows[0]?.db,
                serverTime: res.rows[0]?.now
            };
        } finally {
            client.release();
        }
    } catch (err) {
        return { connected: false, error: err.message };
    }
}

module.exports = {
    isPostgresConfigured,
    getPgPool,
    initializePostgresTables,
    insertLead,
    fetchLeads,
    getLeadStats,
    getLeadById,
    updateLeadStatus,
    insertAppointment,
    fetchAppointments,
    getAppointmentStats,
    testConnection
};
