/**
 * SV Real Estates Hyderabad — MySQL Database Client & Connection Pool
 * Supports local MySQL, XAMPP, and Cloud MySQL (TiDB Serverless, Aiven, Railway, AWS RDS)
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const mysqlUrl = (process.env.MYSQL_URL || process.env.DATABASE_URL || '').trim();
const host = process.env.MYSQL_HOST || 'localhost';
const port = parseInt(process.env.MYSQL_PORT, 10) || 3306;
const user = process.env.MYSQL_USER || 'root';
const password = process.env.MYSQL_PASSWORD || '';
const database = process.env.MYSQL_DATABASE || 'sv_realestate';

function isMySqlConfigured() {
    if (mysqlUrl && (mysqlUrl.startsWith('mysql://') || mysqlUrl.startsWith('mysqls://'))) return true;
    if (process.env.MYSQL_HOST && process.env.MYSQL_HOST.trim() !== '') return true;
    return false;
}

let pool = null;

function getPoolConfig() {
    // If a full connection URL is provided (e.g. mysql://user:pass@host:port/db)
    if (mysqlUrl) {
        const isCloudHost = mysqlUrl.includes('tidbcloud') || 
                            mysqlUrl.includes('aivencloud') || 
                            mysqlUrl.includes('railway') || 
                            mysqlUrl.includes('clever-cloud') ||
                            mysqlUrl.includes('rds.amazonaws.com') ||
                            process.env.MYSQL_SSL === 'true';

        return {
            uri: mysqlUrl,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000,
            ssl: isCloudHost ? { rejectUnauthorized: false } : undefined
        };
    }

    // Individual config variables
    const isCloudHost = host.includes('tidbcloud') || 
                        host.includes('aivencloud') || 
                        host.includes('railway') || 
                        host.includes('clever-cloud') ||
                        host.includes('rds.amazonaws.com') ||
                        process.env.MYSQL_SSL === 'true';

    return {
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        ssl: isCloudHost ? { rejectUnauthorized: false } : undefined
    };
}

function getPool() {
    if (!pool && isMySqlConfigured()) {
        try {
            pool = mysql.createPool(getPoolConfig());
            console.log(`✅ [MYSQL] Connection pool initialized for: ${mysqlUrl ? 'Cloud MySQL URL' : `${user}@${host}:${port}/${database}`}`);
        } catch (err) {
            console.error('❌ [MYSQL] Pool initialization failed:', err.message);
        }
    }
    return pool;
}

/**
 * Execute a query with parameters
 */
async function query(sql, params = []) {
    const p = getPool();
    if (!p) throw new Error('MySQL is not configured in .env');
    const [rows] = await p.execute(sql, params);
    return rows;
}

/**
 * Initialize MySQL Schema and Tables
 */
async function initializeMySql() {
    if (!isMySqlConfigured()) {
        console.log('ℹ️ [MYSQL] No MySQL credentials configured in .env; skipping remote schema check.');
        return false;
    }

    try {
        const p = getPool();
        const schemaPath = path.join(__dirname, 'mysql_schema.sql');
        if (!fs.existsSync(schemaPath)) return false;

        const rawSql = fs.readFileSync(schemaPath, 'utf8');
        const statements = rawSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const stmt of statements) {
            await p.query(stmt);
        }

        console.log('✅ [MYSQL] Database schema & tables verified successfully');

        // Auto-seed default admin if table is empty
        try {
            const [users] = await p.query('SELECT COUNT(*) as count FROM users');
            if (users[0].count === 0) {
                const bcrypt = require('bcryptjs');
                const adminEmail = process.env.ADMIN_EMAIL || 'admin@svrealestate.com';
                const adminPass = process.env.ADMIN_PASSWORD || 'Admin@SV2024';
                const adminHash = bcrypt.hashSync(adminPass, 10);
                await p.query(
                    'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, "admin", 1)',
                    ['SV Admin', adminEmail, adminHash]
                );
                console.log(`✅ [MYSQL] Default admin created: ${adminEmail}`);
            }
        } catch (seedErr) {
            console.warn('⚠️ [MYSQL] Admin seed notice:', seedErr.message);
        }

        return true;
    } catch (err) {
        console.error('❌ [MYSQL] Schema initialization error:', err.message);
        return false;
    }
}

/**
 * Insert customer enquiry into MySQL
 */
async function insertEnquiry(enquiry) {
    if (!isMySqlConfigured()) {
        return { success: false, notConfigured: true, error: 'MySQL is not configured in .env' };
    }

    try {
        const fullName = String(enquiry.full_name || enquiry.customer_name || '').trim();
        const phone = String(enquiry.phone_number || enquiry.phone || '').trim();
        const appointmentDate = String(enquiry.appointment_date || enquiry.preferred_visit_date || '').trim();
        const appointmentTime = String(enquiry.appointment_time || '10:00 AM - 12:00 PM').trim();
        const requirement = String(enquiry.property_requirement || enquiry.property_category || 'Residential Plot').trim();
        const status = enquiry.status || 'New';
        const email = enquiry.email || null;
        const message = enquiry.message || null;

        const p = getPool();
        const [result] = await p.execute(
            `INSERT INTO enquiries 
                (full_name, phone_number, email, appointment_date, appointment_time, property_requirement, message, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [fullName, phone, email, appointmentDate, appointmentTime, requirement, message, status]
        );

        const id = result.insertId;
        const leadCode = `SV-ENQ-${String(id).padStart(5, '0')}`;
        await p.execute('UPDATE enquiries SET lead_code = ? WHERE id = ?', [leadCode, id]);

        console.log(`✅ [MYSQL INSERT SUCCESS]: Enquiry #${id} (${leadCode}) for ${fullName}`);
        return { 
            success: true, 
            data: { id, lead_code: leadCode, full_name: fullName, phone_number: phone, status, created_at: new Date() } 
        };
    } catch (err) {
        console.error('❌ [MYSQL INSERT ERROR]:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Fetch enquiries with filters & pagination from MySQL
 */
async function fetchEnquiries(options = {}) {
    if (!isMySqlConfigured()) {
        return { success: false, notConfigured: true, data: [], count: 0 };
    }

    try {
        const p = getPool();
        let where = '1=1';
        const params = [];

        if (options.status) {
            where += ' AND LOWER(status) = LOWER(?)';
            params.push(options.status);
        }

        if (options.search) {
            where += ' AND (full_name LIKE ? OR phone_number LIKE ? OR property_requirement LIKE ? OR lead_code LIKE ?)';
            const s = `%${options.search}%`;
            params.push(s, s, s, s);
        }

        // Get total count
        const [countRows] = await p.query(`SELECT COUNT(*) as count FROM enquiries WHERE ${where}`, params);
        const total = countRows[0].count;

        // Fetch paginated data
        const limit = parseInt(options.limit, 10) || 25;
        const offset = parseInt(options.offset, 10) || 0;

        const [rows] = await p.query(
            `SELECT * FROM enquiries WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return { success: true, data: rows, count: total };
    } catch (err) {
        console.error('❌ [MYSQL FETCH ERROR]:', err.message);
        return { success: false, error: err.message, data: [], count: 0 };
    }
}

/**
 * Get Enquiry by ID from MySQL
 */
async function getEnquiryById(id) {
    if (!isMySqlConfigured()) {
        return { success: false, notConfigured: true, data: null };
    }

    try {
        const p = getPool();
        const [rows] = await p.execute('SELECT * FROM enquiries WHERE id = ?', [id]);
        if (!rows || rows.length === 0) {
            return { success: false, data: null };
        }
        return { success: true, data: rows[0] };
    } catch (err) {
        return { success: false, error: err.message, data: null };
    }
}

/**
 * Get aggregate enquiry statistics from MySQL
 */
async function getEnquiryStats() {
    if (!isMySqlConfigured()) {
        return { success: false, notConfigured: true };
    }

    try {
        const p = getPool();
        const [totalRows] = await p.query('SELECT COUNT(*) as total FROM enquiries');
        const [newRows] = await p.query("SELECT COUNT(*) as newCount FROM enquiries WHERE LOWER(status) = 'new'");

        return {
            success: true,
            total: totalRows[0].total,
            newCount: newRows[0].newCount
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Update enquiry status in MySQL
 */
async function updateEnquiryStatus(id, status) {
    if (!isMySqlConfigured()) {
        return { success: false, notConfigured: true };
    }

    try {
        const p = getPool();
        await p.execute('UPDATE enquiries SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Test connectivity to MySQL
 */
async function testConnection() {
    if (!isMySqlConfigured()) {
        return { connected: false, message: 'MySQL is not configured in .env' };
    }

    try {
        const p = getPool();
        await p.query('SELECT 1');
        return { connected: true, message: 'Successfully connected to MySQL database!' };
    } catch (err) {
        return { connected: false, error: err.message };
    }
}

module.exports = {
    getPool,
    query,
    isMySqlConfigured,
    initializeMySql,
    insertEnquiry,
    fetchEnquiries,
    getEnquiryById,
    getEnquiryStats,
    updateEnquiryStatus,
    testConnection
};
