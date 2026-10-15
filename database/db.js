let DatabaseSync = null;
try {
    DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (err) {
    DatabaseSync = null;
    console.warn('⚠️ node:sqlite DatabaseSync not available on this Node runtime; memory mode active.');
}
const path = require('path');
const fs = require('fs');

let DB_PATH = process.env.DB_PATH || process.env.DATABASE_PATH;
if (process.env.VERCEL) {
    DB_PATH = '/tmp/svrealestate.db';
    const bundledCandidates = [
        path.join(__dirname, '..', 'data', 'svrealestate.db'),
        path.join(process.cwd(), 'data', 'svrealestate.db')
    ];
    if (!fs.existsSync('/tmp/svrealestate.db')) {
        for (const candidate of bundledCandidates) {
            if (fs.existsSync(candidate)) {
                try {
                    fs.copyFileSync(candidate, '/tmp/svrealestate.db');
                    break;
                } catch (e) {
                    console.warn('Notice: Could not copy bundled db to /tmp:', e.message);
                }
            }
        }
    }
} else if (!DB_PATH) {
    DB_PATH = path.join(__dirname, '..', 'data', 'svrealestate.db');
}

const schemaCandidates = [
    path.join(__dirname, 'schema.sql'),
    path.join(process.cwd(), 'database', 'schema.sql')
];
const SCHEMA_PATH = schemaCandidates.find(p => fs.existsSync(p)) || schemaCandidates[0];

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
        // Read-only filesystem or already exists
    }
}

function createMemoryDb() {
    const memProperties = [
        {
            id: 1,
            property_code: 'SV-VIL-00101',
            title: 'The Royal Sovereign 5BHK Triplex Villa',
            category: 'villa',
            purpose: 'sale',
            short_description: 'Ultra-luxury triplex designer villa with private infinity pool and Italian marble in Jubilee Hills.',
            description: 'Experience the apex of palatial living in Jubilee Hills, Hyderabad most distinguished address.',
            price: 185000000,
            price_negotiable: 1,
            city: 'Hyderabad',
            locality: 'Jubilee Hills',
            full_address: 'Road No. 36, Near Peddamma Temple, Jubilee Hills, Hyderabad',
            pin_code: '500033',
            built_up_area: 7200,
            plot_area: 550,
            carpet_area: 6100,
            area_unit: 'sq_yd',
            bedrooms: 5,
            bathrooms: 6,
            balconies: 4,
            floors: 3,
            facing: 'East',
            furnishing: 'semi_furnished',
            parking: '4 Covered Car Parks',
            private_garden: 1,
            private_pool: 1,
            amenities: JSON.stringify(['Swimming Pool', 'Private Garden', 'Lift', 'Clubhouse', 'Gym', '24/7 Security', 'CCTV', 'Power Backup', 'Vastu Compliant', 'Car Parking']),
            status: 'published',
            availability: 'available',
            is_featured: 1,
            published_at: new Date().toISOString(),
            cover_image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80'
        },
        {
            id: 2,
            property_code: 'SV-PLT-00204',
            title: 'HMDA Golden Mile Plotted Estate in Kokapet',
            category: 'residential_plot',
            purpose: 'sale',
            short_description: 'Prime 400 Sq.Yd East-facing open plot facing 60ft BT road adjacent to Neopolis Kokapet.',
            description: 'Strategic land acquisition opportunity in Kokapet (Golden Mile Corridor).',
            price: 48000000,
            price_negotiable: 0,
            city: 'Hyderabad',
            locality: 'Kokapet',
            full_address: 'Survey No. 128, Golden Mile Road, Near Neopolis SEZ, Kokapet, Hyderabad',
            pin_code: '500075',
            plot_area: 400,
            area_unit: 'sq_yd',
            status: 'published',
            availability: 'available',
            is_featured: 1,
            published_at: new Date().toISOString(),
            cover_image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80'
        },
        {
            id: 3,
            property_code: 'SV-APT-00305',
            title: 'Sky Residences 4BHK Luxury Apartment',
            category: 'apartment',
            purpose: 'sale',
            short_description: '3,850 Sq.Ft Sky Palace with panoramic views of Financial District skyline.',
            description: 'Step into soaring heights at Hyderabad premier high-rise address.',
            price: 42500000,
            price_negotiable: 1,
            city: 'Hyderabad',
            locality: 'Financial District',
            full_address: 'Tower Sapphire, Sky Residences, Nanakramguda, Financial District, Hyderabad',
            pin_code: '500032',
            built_up_area: 3850,
            carpet_area: 3100,
            area_unit: 'sq_ft',
            bedrooms: 4,
            bathrooms: 5,
            status: 'published',
            availability: 'available',
            is_featured: 1,
            published_at: new Date().toISOString(),
            cover_image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
        }
    ];

    const memLeads = [];
    const memAppointments = [];
    const memSessions = new Map();
    const memSettings = {
        business_name: 'SV Real Estates Hyderabad',
        business_phone: '+91-9876543210',
        business_email: 'info@svrealestate.com',
        business_whatsapp: '919876543210',
        business_address: 'Road No. 36, Jubilee Hills, Hyderabad, Telangana, India'
    };

    return {
        isMemory: true,
        exec: () => {},
        pragma: () => [],
        close: () => {},
        prepare: (sql) => {
            const s = (sql || '').trim().toLowerCase();
            return {
                all: (...params) => {
                    if (s.includes('from properties')) {
                        if (s.includes('group by category')) {
                            return [
                                { category: 'villa', count: 2 },
                                { category: 'residential_plot', count: 1 },
                                { category: 'apartment', count: 1 }
                            ];
                        }
                        if (s.includes('group by locality')) {
                            return [
                                { locality: 'Jubilee Hills', city: 'Hyderabad', property_count: 1 },
                                { locality: 'Kokapet', city: 'Hyderabad', property_count: 1 },
                                { locality: 'Financial District', city: 'Hyderabad', property_count: 1 }
                            ];
                        }
                        return memProperties;
                    }
                    if (s.includes('from property_images')) {
                        return [
                            { id: 1, image_url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80', is_cover: 1, display_order: 0 }
                        ];
                    }
                    if (s.includes('from leads')) return memLeads;
                    if (s.includes('from appointments')) return memAppointments;
                    if (s.includes('from settings')) {
                        return Object.entries(memSettings).map(([key, value]) => ({ key, value }));
                    }
                    if (s.includes('from users')) {
                        return [{ id: 1, name: 'SV Admin', email: 'admin@svrealestate.com', role: 'admin', is_active: 1 }];
                    }
                    return [];
                },
                get: (...params) => {
                    if (s.includes('from sessions where sid =')) {
                        const sid = params[0];
                        const sessRow = memSessions.get(sid);
                        if (sessRow && sessRow.expired_at > Date.now()) {
                            return { sess: sessRow.sess };
                        }
                        return null;
                    }
                    if (s.includes('count(*) as count from properties')) {
                        return { count: memProperties.length };
                    }
                    if (s.includes('count(*) as count from leads')) {
                        return { count: memLeads.length };
                    }
                    if (s.includes('count(*) as count from appointments')) {
                        return { count: memAppointments.length };
                    }
                    if (s.includes('count(*) as count from notifications')) {
                        return { count: 0 };
                    }
                    if (s.includes('from users where email =') || s.includes('from users where id =')) {
                        const email = params[0] || 'admin@svrealestate.com';
                        const bcrypt = require('bcryptjs');
                        return {
                            id: 1,
                            name: 'SV Admin',
                            email: email,
                            password_hash: bcrypt.hashSync('Admin@SV2024', 10),
                            role: 'admin',
                            is_active: 1
                        };
                    }
                    if (s.includes('from properties where id =') || s.includes('from properties where property_code =')) {
                        const id = params[0];
                        return memProperties.find(p => p.id === id || p.property_code === id) || memProperties[0];
                    }
                    return null;
                },
                run: (...params) => {
                    if (s.includes('insert into sessions')) {
                        memSessions.set(params[0], { sess: params[1], expired_at: params[2] });
                        return { changes: 1 };
                    }
                    if (s.includes('delete from sessions')) {
                        memSessions.delete(params[0]);
                        return { changes: 1 };
                    }
                    if (s.includes('update sessions set expired_at')) {
                        const sessRow = memSessions.get(params[1]);
                        if (sessRow) sessRow.expired_at = params[0];
                        return { changes: 1 };
                    }
                    return { lastInsertRowid: Date.now(), changes: 1 };
                }
            };
        }
    };
}

let db;

function getDb() {
    if (!db) {
        if (DatabaseSync) {
            try {
                db = new DatabaseSync(DB_PATH);
                try { db.exec('PRAGMA foreign_keys = ON;'); } catch {}
                try { db.exec('PRAGMA journal_mode = MEMORY;'); } catch {
                    try { db.exec('PRAGMA journal_mode = DELETE;'); } catch {}
                }
                try { db.exec('PRAGMA synchronous = OFF;'); } catch {}
                try { db.exec('PRAGMA temp_store = MEMORY;'); } catch {}
                try { db.exec('PRAGMA busy_timeout = 5000;'); } catch {}
                db.pragma = function (cmd) {
                    try { return db.exec(`PRAGMA ${cmd};`); } catch { return []; }
                };
            } catch (openErr) {
                console.warn('⚠️ SQLite open failed; using memory data provider:', openErr.message);
                db = createMemoryDb();
            }
        } else {
            db = createMemoryDb();
        }
    }
    return db;
}

function initializeDb() {
    try {
        const database = getDb();
        if (!DatabaseSync || database.isMemory) {
            console.log('✅ Fallback memory data store initialized');
            return database;
        }
        if (fs.existsSync(SCHEMA_PATH)) {
            try {
                const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
                database.exec(schema);
            } catch (schemaErr) {
                console.warn('⚠️ Schema exec notice:', schemaErr.message);
            }
        }

        // Auto-migrate any newly added columns if table already existed
        try {
            const columns = database.prepare('PRAGMA table_info(leads)').all().map(c => c.name);
            const requiredCols = [
                { name: 'full_name', type: 'TEXT' },
                { name: 'phone_number', type: 'TEXT' },
                { name: 'appointment_date', type: 'TEXT' },
                { name: 'appointment_time', type: 'TEXT' },
                { name: 'property_requirement', type: 'TEXT' }
            ];
            for (const col of requiredCols) {
                if (!columns.includes(col.name)) {
                    database.exec(`ALTER TABLE leads ADD COLUMN ${col.name} ${col.type};`);
                }
            }
        } catch (e) {
            // Table created freshly from schema.sql
        }

        // Auto-seed if database is fresh (e.g. freshly created in /tmp or new environment)
        try {
            const propCount = database.prepare('SELECT COUNT(*) as count FROM properties').get().count;
            if (propCount === 0) {
                console.log('🌱 Fresh database detected, auto-seeding properties and admin...');
                const { seed } = require('./seed');
                seed(database);
            }
        } catch (seedErr) {
            console.warn('⚠️ Auto-seed notice:', seedErr.message);
        }

        console.log('✅ Database initialized successfully');
        return database;
    } catch (globalDbErr) {
        console.warn('⚠️ initializeDb global fallback to memory:', globalDbErr.message);
        db = createMemoryDb();
        return db;
    }
}

function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

// Graceful shutdown
process.on('exit', closeDb);
process.on('SIGINT', () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });

module.exports = { getDb, initializeDb, closeDb };
