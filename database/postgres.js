/**
 * SV Real Estates Hyderabad — PostgreSQL / Supabase / Vercel Postgres Database Client
 * Provides persistent cloud storage for Leads, Appointments, and Sessions across ephemeral Vercel Serverless instances.
 * Seamlessly supports both direct PostgreSQL connection pooling (pg) and Supabase REST API (@supabase/supabase-js).
 */
require('dotenv').config();

// Keep Node.js TLS certificate verification enabled. Never disable TLS verification globally in production.
const { Pool } = require('pg');
let createClient;
try {
    createClient = require('@supabase/supabase-js').createClient;
} catch (e) {
    createClient = null;
}

const rawConnectionString = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.SUPABASE_DB_URL ||
    ''
).trim();

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

function isSupabaseConfigured() {
    return !!(
        createClient &&
        supabaseUrl &&
        supabaseKey &&
        (supabaseUrl.startsWith('https://') || supabaseUrl.startsWith('http://')) &&
        !supabaseUrl.includes('your-project')
    );
}

function isDirectPostgresConfigured() {
    if (rawConnectionString && (rawConnectionString.startsWith('postgres://') || rawConnectionString.startsWith('postgresql://'))) {
        return true;
    }
    if (process.env.PGHOST && process.env.PGHOST.trim() !== '') {
        return true;
    }
    return false;
}

function isPostgresConfigured() {
    return isDirectPostgresConfigured() || isSupabaseConfigured();
}

let pool = null;
let supabaseClient = null;
let tablesInitialized = false;

function getSupabaseClient() {
    if (!supabaseClient && isSupabaseConfigured()) {
        try {
            supabaseClient = createClient(supabaseUrl, supabaseKey, {
                auth: { persistSession: false }
            });
            console.log(`✅ [SUPABASE] REST API client connected to: ${supabaseUrl}`);
        } catch (err) {
            console.error('❌ [SUPABASE] Client init error:', err.message);
        }
    }
    return supabaseClient;
}

function getPoolConfig() {
    if (rawConnectionString) {
        try {
            const parsed = new URL(rawConnectionString);
            const isCloudHost = parsed.hostname.includes('supabase') ||
                                parsed.hostname.includes('neon.tech') ||
                                parsed.hostname.includes('vercel-storage.com') ||
                                parsed.hostname.includes('render.com') ||
                                parsed.hostname.includes('railway.app') ||
                                parsed.hostname.includes('aivencloud.com') ||
                                parsed.hostname.includes('amazonaws.com') ||
                                process.env.PGSSLMODE === 'require' ||
                                process.env.NODE_ENV === 'production' ||
                                process.env.VERCEL;

            return {
                host: parsed.hostname,
                port: parseInt(parsed.port, 10) || 5432,
                user: decodeURIComponent(parsed.username || 'postgres'),
                password: decodeURIComponent(parsed.password || ''),
                database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'postgres',
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000,
                ssl: isCloudHost ? { rejectUnauthorized: true } : undefined
            };
        } catch (err) {
            // Fallback if URL parsing failed: strip query params that conflict with pg SSL
            const cleanConnectionString = rawConnectionString
                .replace(/[?&]sslmode=[^&]+/g, '')
                .replace(/[?&]ssl=[^&]+/g, '');

            return {
                connectionString: cleanConnectionString,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000,
                ssl: { rejectUnauthorized: true }
            };
        }
    }

    const host = process.env.PGHOST || 'localhost';
    const port = parseInt(process.env.PGPORT, 10) || 5432;
    const user = process.env.PGUSER || 'postgres';
    const password = process.env.PGPASSWORD || '';
    const database = process.env.PGDATABASE || 'postgres';

    const isCloudHost = host.includes('supabase') ||
                        host.includes('neon.tech') ||
                        host.includes('vercel-storage.com') ||
                        process.env.NODE_ENV === 'production' ||
                        process.env.VERCEL;

    return {
        host,
        port,
        user,
        password,
        database,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: isCloudHost ? { rejectUnauthorized: true } : undefined
    };
}

function getPgPool() {
    if (!pool && isDirectPostgresConfigured()) {
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
    if (tablesInitialized || !isDirectPostgresConfigured()) return;
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
 * Insert a lead/enquiry into PostgreSQL or Supabase REST
 */
async function insertLead(lead) {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true };

    const leadPayload = {
        lead_code: lead.lead_code || `SV-LEAD-${Date.now().toString().slice(-6)}`,
        customer_name: lead.customer_name || lead.full_name || 'Enquiry Client',
        full_name: lead.full_name || lead.customer_name || 'Enquiry Client',
        phone: lead.phone || lead.phone_number || '',
        phone_number: lead.phone_number || lead.phone || '',
        email: lead.email || null,
        property_id: lead.property_id ? parseInt(lead.property_id, 10) : null,
        property_category: lead.property_category || lead.property_requirement || 'Residential Plot',
        property_requirement: lead.property_requirement || lead.property_category || 'Residential Plot',
        budget: lead.budget || 'Consult / Market Price',
        preferred_location: lead.preferred_location || 'Hyderabad',
        message: lead.message || null,
        contact_preference: lead.contact_preference || 'phone',
        preferred_visit_date: lead.preferred_visit_date || lead.appointment_date || null,
        appointment_date: lead.appointment_date || lead.preferred_visit_date || null,
        appointment_time: lead.appointment_time || '10:00 AM - 12:00 PM',
        consent: lead.consent !== undefined ? (lead.consent ? 1 : 0) : 1,
        source: lead.source || 'website',
        status: lead.status || 'new'
    };

    // 1. Direct PostgreSQL pool if configured
    const p = getPgPool();
    if (p) {
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
                leadPayload.lead_code, leadPayload.customer_name, leadPayload.full_name,
                leadPayload.phone, leadPayload.phone_number, leadPayload.email,
                leadPayload.property_id, leadPayload.property_category, leadPayload.property_requirement,
                leadPayload.budget, leadPayload.preferred_location, leadPayload.message,
                leadPayload.contact_preference, leadPayload.preferred_visit_date,
                leadPayload.appointment_date, leadPayload.appointment_time,
                leadPayload.consent, leadPayload.source, leadPayload.status
            ];

            const res = await p.query(query, values);
            return { success: true, data: res.rows[0] };
        } catch (err) {
            console.error('❌ [POSTGRES] insertLead pool error:', err.message);
        }
    }

    // 2. Supabase REST fallback
    const sb = getSupabaseClient();
    if (sb) {
        try {
            const { data, error } = await sb.from('leads').insert([leadPayload]).select();
            if (!error && data && data.length > 0) {
                return { success: true, data: data[0] };
            }
            // Try enquiries table if leads table is not present
            const enqPayload = {
                lead_code: leadPayload.lead_code,
                full_name: leadPayload.full_name,
                phone_number: leadPayload.phone_number,
                appointment_date: leadPayload.appointment_date || new Date().toISOString().slice(0, 10),
                appointment_time: leadPayload.appointment_time,
                property_requirement: leadPayload.property_requirement,
                email: leadPayload.email,
                message: leadPayload.message,
                status: 'New'
            };
            const { data: enqData, error: enqErr } = await sb.from('enquiries').insert([enqPayload]).select();
            if (!enqErr && enqData && enqData.length > 0) {
                return { success: true, data: enqData[0] };
            }
            if (error || enqErr) {
                console.error('❌ [SUPABASE] insert error:', (error || enqErr).message);
                return { success: false, error: (error || enqErr).message };
            }
        } catch (sbErr) {
            console.error('❌ [SUPABASE] insert exception:', sbErr.message);
            return { success: false, error: sbErr.message };
        }
    }

    return { success: false, notConfigured: true };
}

/**
 * Fetch leads from PostgreSQL or Supabase
 */
async function fetchLeads(options = {}) {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true, data: [], count: 0 };

    const p = getPgPool();
    if (p) {
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
            console.error('❌ [POSTGRES] fetchLeads pool error:', err.message);
        }
    }

    const sb = getSupabaseClient();
    if (sb) {
        try {
            let query = sb.from('leads').select('*', { count: 'exact' });
            if (options.status) query = query.ilike('status', options.status);
            if (options.search) {
                const s = `%${options.search}%`;
                query = query.or(`customer_name.ilike.${s},phone.ilike.${s},email.ilike.${s}`);
            }
            query = query.order('id', { ascending: false });
            if (options.limit) {
                const from = options.offset || 0;
                const to = from + options.limit - 1;
                query = query.range(from, to);
            }
            const { data, count, error } = await query;
            if (!error && data) {
                return { success: true, data, count: count || data.length };
            }

            // Fallback to enquiries table
            const { data: enqData, count: enqCount, error: enqErr } = await sb.from('enquiries').select('*', { count: 'exact' }).order('id', { ascending: false });
            if (!enqErr && enqData) {
                const mapped = enqData.map(e => ({
                    id: e.id,
                    lead_code: e.lead_code || `SV-ENQ-${String(e.id).padStart(5, '0')}`,
                    full_name: e.full_name,
                    customer_name: e.full_name,
                    phone: e.phone_number,
                    phone_number: e.phone_number,
                    appointment_date: e.appointment_date,
                    appointment_time: e.appointment_time,
                    property_requirement: e.property_requirement,
                    property_category: e.property_requirement,
                    status: (e.status || 'New').toLowerCase(),
                    created_at: e.created_at,
                    email: e.email,
                    message: e.message
                }));
                return { success: true, data: mapped, count: enqCount || mapped.length };
            }
        } catch (sbErr) {
            console.error('❌ [SUPABASE] fetchLeads error:', sbErr.message);
        }
    }

    return { success: false, notConfigured: true, data: [], count: 0 };
}

/**
 * Get aggregated lead stats
 */
async function getLeadStats() {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true };

    const p = getPgPool();
    if (p) {
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
        }
    }

    const sb = getSupabaseClient();
    if (sb) {
        try {
            const { count: total } = await sb.from('leads').select('*', { count: 'exact', head: true });
            const { count: newCount } = await sb.from('leads').select('*', { count: 'exact', head: true }).ilike('status', 'new');
            return { success: true, total: total || 0, newCount: newCount || 0, convertedCount: 0 };
        } catch (sbErr) {
            return { success: false, error: sbErr.message };
        }
    }

    return { success: false, notConfigured: true };
}

/**
 * Get single lead by ID
 */
async function getLeadById(id) {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true, data: null };

    const p = getPgPool();
    if (p) {
        try {
            const res = await p.query('SELECT * FROM leads WHERE id = $1', [id]);
            return { success: true, data: res.rows[0] || null };
        } catch (err) {
            console.error('❌ [POSTGRES] getLeadById error:', err.message);
        }
    }

    const sb = getSupabaseClient();
    if (sb) {
        try {
            const { data, error } = await sb.from('leads').select('*').eq('id', id).single();
            if (!error && data) return { success: true, data };
            const { data: enqData } = await sb.from('enquiries').select('*').eq('id', id).single();
            if (enqData) {
                return {
                    success: true,
                    data: {
                        id: enqData.id,
                        lead_code: enqData.lead_code || `SV-ENQ-${String(enqData.id).padStart(5, '0')}`,
                        full_name: enqData.full_name,
                        customer_name: enqData.full_name,
                        phone: enqData.phone_number,
                        phone_number: enqData.phone_number,
                        appointment_date: enqData.appointment_date,
                        appointment_time: enqData.appointment_time,
                        property_requirement: enqData.property_requirement,
                        status: (enqData.status || 'New').toLowerCase(),
                        created_at: enqData.created_at,
                        email: enqData.email,
                        message: enqData.message
                    }
                };
            }
        } catch (sbErr) {
            return { success: false, error: sbErr.message, data: null };
        }
    }

    return { success: false, notConfigured: true, data: null };
}

/**
 * Update lead status
 */
async function updateLeadStatus(id, status) {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true };

    const p = getPgPool();
    if (p) {
        try {
            const res = await p.query(
                'UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                [status, id]
            );
            return { success: true, data: res.rows[0] };
        } catch (err) {
            console.error('❌ [POSTGRES] updateLeadStatus error:', err.message);
        }
    }

    const sb = getSupabaseClient();
    if (sb) {
        try {
            const { data } = await sb.from('leads').update({ status }).eq('id', id).select();
            if (data && data.length > 0) return { success: true, data: data[0] };
            const { data: enqData } = await sb.from('enquiries').update({ status }).eq('id', id).select();
            if (enqData && enqData.length > 0) return { success: true, data: enqData[0] };
        } catch (sbErr) {
            return { success: false, error: sbErr.message };
        }
    }

    return { success: false, notConfigured: true };
}

/**
 * Insert an appointment into PostgreSQL or Supabase
 */
async function insertAppointment(apt) {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true };

    const payload = {
        appointment_code: apt.appointment_code || `SV-VISIT-${Date.now().toString().slice(-5)}`,
        lead_id: apt.lead_id ? parseInt(apt.lead_id, 10) : null,
        property_id: apt.property_id ? parseInt(apt.property_id, 10) : null,
        customer_name: apt.customer_name || 'Site Visit Visitor',
        phone: apt.phone,
        notes: apt.notes || null,
        requested_date: apt.requested_date,
        requested_time: apt.requested_time || null,
        status: apt.status || 'requested'
    };

    const p = getPgPool();
    if (p) {
        try {
            const query = `
                INSERT INTO appointments (
                    appointment_code, lead_id, property_id, customer_name, phone,
                    notes, requested_date, requested_time, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;
            const values = [
                payload.appointment_code, payload.lead_id, payload.property_id,
                payload.customer_name, payload.phone, payload.notes,
                payload.requested_date, payload.requested_time, payload.status
            ];
            const res = await p.query(query, values);
            return { success: true, data: res.rows[0] };
        } catch (err) {
            console.error('❌ [POSTGRES] insertAppointment error:', err.message);
        }
    }

    const sb = getSupabaseClient();
    if (sb) {
        try {
            const { data, error } = await sb.from('appointments').insert([payload]).select();
            if (!error && data && data.length > 0) {
                return { success: true, data: data[0] };
            }
        } catch (sbErr) {
            return { success: false, error: sbErr.message };
        }
    }

    return { success: false, notConfigured: true };
}

/**
 * Fetch appointments from PostgreSQL or Supabase
 */
async function fetchAppointments(options = {}) {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true, data: [], count: 0 };

    const p = getPgPool();
    if (p) {
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
        }
    }

    const sb = getSupabaseClient();
    if (sb) {
        try {
            let query = sb.from('appointments').select('*', { count: 'exact' });
            if (options.status) query = query.ilike('status', options.status);
            query = query.order('id', { ascending: false });
            const { data, count, error } = await query;
            if (!error && data) return { success: true, data, count: count || data.length };
        } catch (sbErr) {
            return { success: false, error: sbErr.message, data: [], count: 0 };
        }
    }

    return { success: false, notConfigured: true, data: [], count: 0 };
}

/**
 * Get appointment stats
 */
async function getAppointmentStats() {
    if (!isPostgresConfigured()) return { success: false, notConfigured: true };

    const p = getPgPool();
    if (p) {
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

    const sb = getSupabaseClient();
    if (sb) {
        try {
            const { count: total } = await sb.from('appointments').select('*', { count: 'exact', head: true });
            const { count: pendingCount } = await sb.from('appointments').select('*', { count: 'exact', head: true }).in('status', ['requested', 'confirmed']);
            return { success: true, total: total || 0, pendingCount: pendingCount || 0 };
        } catch (sbErr) {
            return { success: false, error: sbErr.message };
        }
    }

    return { success: false, notConfigured: true };
}

/**
 * Test connectivity
 */
async function testConnection() {
    if (isDirectPostgresConfigured()) {
        const p = getPgPool();
        if (p) {
            try {
                const client = await p.connect();
                try {
                    const res = await client.query('SELECT NOW() as now, current_database() as db');
                    return {
                        connected: true,
                        type: 'postgresql',
                        database: res.rows[0]?.db,
                        serverTime: res.rows[0]?.now
                    };
                } finally {
                    client.release();
                }
            } catch (err) {
                return { connected: false, type: 'postgresql', error: err.message };
            }
        }
    }

    if (isSupabaseConfigured()) {
        const sb = getSupabaseClient();
        if (sb) {
            try {
                const { data, error } = await sb.from('leads').select('id').limit(1);
                if (!error) return { connected: true, type: 'supabase_rest', table: 'leads' };
                const { error: enqErr } = await sb.from('enquiries').select('id').limit(1);
                if (!enqErr) return { connected: true, type: 'supabase_rest', table: 'enquiries' };
                return { connected: false, type: 'supabase_rest', error: (error || enqErr).message };
            } catch (sbErr) {
                return { connected: false, type: 'supabase_rest', error: sbErr.message };
            }
        }
    }

    return {
        connected: false,
        message: 'Neither PostgreSQL connection string nor Supabase API keys are configured in environment variables'
    };
}

module.exports = {
    isPostgresConfigured,
    isDirectPostgresConfigured,
    isSupabaseConfigured,
    getPgPool,
    getSupabaseClient,
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
