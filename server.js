/**
 * SV Real Estates Hyderabad — Main Server
 */
require('dotenv').config();

// Database TLS certificate verification remains enabled in production.
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { initializeDb } = require('./database/db');
const { initializeMySql, isMySqlConfigured } = require('./database/mysql');
const { loadUser } = require('./middleware/auth');

// Initialize database
try {
    initializeDb();
} catch (e) {
    console.warn('DB init notice:', e.message);
}
if (isMySqlConfigured()) {
    try {
        initializeMySql().catch(err => console.warn('MySQL init notice:', err.message));
    } catch (e) {
        console.warn('MySQL init notice:', e.message);
    }
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ── Security ──────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'"],
            frameSrc: ["'self'", "https://www.google.com", "https://maps.google.com"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// ── Rate Limiting ─────────────────────────────────────────
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5000,
    standardHeaders: true,
    legacyHeaders: false
});

const enquiryLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5000,
    message: { error: 'Too many enquiries. Please try again shortly.' }
});

// ── Parsing ───────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// ── Session (SQLite backed via node:sqlite) ───────────────
const Store = session.Store;
class SqliteSessionStore extends Store {
    constructor(database) {
        super();
        this.database = database;
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                sid TEXT PRIMARY KEY,
                sess TEXT NOT NULL,
                expired_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired_at);
        `);
    }

    get(sid, cb) {
        try {
            const row = this.database.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired_at > ?').get(sid, Date.now());
            if (!row) return cb(null, null);
            cb(null, JSON.parse(row.sess));
        } catch (err) {
            cb(err);
        }
    }

    set(sid, sess, cb) {
        try {
            const maxAge = (sess.cookie && sess.cookie.maxAge) ? sess.cookie.maxAge : 86400000;
            const expiredAt = Date.now() + maxAge;
            this.database.prepare(`
                INSERT INTO sessions (sid, sess, expired_at) VALUES (?, ?, ?)
                ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired_at = excluded.expired_at
            `).run(sid, JSON.stringify(sess), expiredAt);
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
        }
    }

    destroy(sid, cb) {
        try {
            this.database.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
        }
    }

    touch(sid, sess, cb) {
        try {
            const maxAge = (sess.cookie && sess.cookie.maxAge) ? sess.cookie.maxAge : 86400000;
            const expiredAt = Date.now() + maxAge;
            this.database.prepare('UPDATE sessions SET expired_at = ? WHERE sid = ?').run(expiredAt, sid);
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
        }
    }
}

const { getDb } = require('./database/db');
const { isPostgresConfigured, getPgPool } = require('./database/postgres');

let sessionStore;
const pgPool = getPgPool();
if (pgPool) {
    try {
        const PgSession = require('connect-pg-simple')(session);
        sessionStore = new PgSession({
            pool: pgPool,
            tableName: 'session',
            createTableIfMissing: true
        });
        console.log('✅ [SESSION] Persistent PostgreSQL/Supabase session store active');
    } catch (pgSessErr) {
        console.warn('⚠️ [SESSION] PgSession fallback to memory:', pgSessErr.message);
        sessionStore = new session.MemoryStore();
    }
} else if (process.env.VERCEL) {
    sessionStore = new session.MemoryStore();
} else {
    try {
        sessionStore = new SqliteSessionStore(getDb());
    } catch (e) {
        sessionStore = new session.MemoryStore();
    }
}

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    },
    name: 'sv.sid'
}));


// ── View Engine ───────────────────────────────────────────
app.set('view engine', 'ejs');
const viewsDir = fs.existsSync(path.join(__dirname, 'views'))
    ? path.join(__dirname, 'views')
    : path.join(process.cwd(), 'views');
app.set('views', viewsDir);

// ── Static Files ──────────────────────────────────────────
const publicDir = fs.existsSync(path.join(__dirname, 'public'))
    ? path.join(__dirname, 'public')
    : path.join(process.cwd(), 'public');
app.use(express.static(publicDir, { maxAge: 0, etag: false }));
if (process.env.VERCEL) {
    app.use('/uploads', express.static('/tmp/uploads', { maxAge: 0, etag: false }));
}

// ── Global Middleware ─────────────────────────────────────
app.use(loadUser);

// Make common data available to all views
app.use((req, res, next) => {
    res.locals.businessName = process.env.BUSINESS_NAME || 'Sri Venkateswara Building Material Traders';
    res.locals.businessTagline = process.env.BUSINESS_TAGLINE || 'Building Construction & Materials Supplier';
    res.locals.businessPhone = process.env.BUSINESS_PHONE || '+91 9346423434';
    res.locals.businessEmail = process.env.BUSINESS_EMAIL || 'info@svbuildingmaterials.com';
    res.locals.businessWhatsapp = process.env.BUSINESS_WHATSAPP || '919346423434';
    res.locals.businessAddress = process.env.BUSINESS_ADDRESS || '# MIG-2/183, 9th Phase, KPHB Colony, Kukatpally, Hyderabad - 500085';
    res.locals.businessInstagram = process.env.BUSINESS_INSTAGRAM || 'https://instagram.com/sv.realestatehyd?cplk=MWtva2tubm11NDB0Ng%3D%3D&utm_source=qr';
    res.locals.path = req.path;
    res.locals.csrfToken = ''; // Placeholder, set per-form as needed

    // Universal reliable date formatters (supports SQLite dates without Invalid Date bugs)
    res.locals.formatDate = (dateVal) => {
        if (!dateVal) return '—';
        try {
            const str = String(dateVal);
            const safe = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') + 'Z' : str;
            const d = new Date(safe);
            if (isNaN(d.getTime())) return str;
            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return String(dateVal);
        }
    };

    res.locals.formatDateTime = (dateVal) => {
        if (!dateVal) return '—';
        try {
            const str = String(dateVal);
            const safe = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') + 'Z' : str;
            const d = new Date(safe);
            if (isNaN(d.getTime())) return str;
            return d.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        } catch {
            return String(dateVal);
        }
    };

    next();
});

// ── Routes ────────────────────────────────────────────────
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const apiPropertyRoutes = require('./routes/api/properties');
const apiLeadRoutes = require('./routes/api/leads');
const apiAppointmentRoutes = require('./routes/api/appointments');
const apiDashboardRoutes = require('./routes/api/dashboard');
const apiNotificationRoutes = require('./routes/api/notifications');

// Apply rate limiters
app.use('/admin/login', loginLimiter);
app.use('/api/', apiLimiter);
app.use('/api/leads/public', enquiryLimiter);
app.use('/api/appointments/public', enquiryLimiter);

// Mount routes
app.use('/', publicRoutes);
app.use('/admin', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api/properties', apiPropertyRoutes);
app.use('/api/leads', apiLeadRoutes);
app.use('/api/appointments', apiAppointmentRoutes);
app.use('/api/dashboard', apiDashboardRoutes);
app.use('/api/notifications', apiNotificationRoutes);

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => {
    try {
        res.status(404).render('public/404', { title: 'Page Not Found' });
    } catch (e) {
        res.status(404).send('<!DOCTYPE html><html><head><title>404 - Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>404 - Page Not Found</h1><p><a href="/">Return to Home</a></p></body></html>');
    }
});

// ── Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    if (req.path.startsWith('/api/')) {
        return res.status(500).json({ error: 'Internal server error' });
    }
    try {
        res.status(500).render('public/error', {
            title: 'Error',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
        });
    } catch (renderErr) {
        res.status(500).send(`<!DOCTYPE html><html><head><title>500 - Server Error</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>500 - Server Error</h1><p>${err.message || 'Something went wrong.'}</p><p><a href="/">Return to Home</a></p></body></html>`);
    }
});

// ── Start (Dual Port Binding: Listen on 3000 and 4000) ────
if (require.main === module && !process.env.VERCEL && process.env.NODE_ENV !== 'test') {
    const PRIMARY_PORT = parseInt(process.env.PORT) || 3000;
    const ALT_PORT = PRIMARY_PORT === 3000 ? 4000 : 3000;

    app.listen(PRIMARY_PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════╗
║   SV Real Estates Hyderabad                      ║
║   Primary Server: http://localhost:${PRIMARY_PORT}        ║
║   Admin Leads:    http://localhost:${PRIMARY_PORT}/admin/leads  ║
╚══════════════════════════════════════════════════╝`);
    });

    try {
        const mirrorServer = app.listen(ALT_PORT, () => {
            console.log(`🚀 Also listening on mirror port: http://localhost:${ALT_PORT}`);
            console.log(`🔑 Mirror Admin: http://localhost:${ALT_PORT}/admin/leads`);
        });
        mirrorServer.on('error', (err) => {
            console.log(`Note: Port ${ALT_PORT} not bound (${err.message}). Primary http://localhost:${PRIMARY_PORT} active.`);
        });
    } catch (e) {
        console.log(`Note: Port ${ALT_PORT} skipped. Primary http://localhost:${PRIMARY_PORT} active.`);
    }
}

module.exports = app;
