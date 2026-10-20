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
            property_code: 'SV-APT-BCP-001',
            title: 'Serene Oaks 2BHK Smart Home in Bachupally',
            category: 'apartment',
            purpose: 'sale',
            short_description: 'Vaastu-compliant 1,210 Sq.Ft 2BHK flat near Silver Oaks and Oakridge International School.',
            description: 'Experience affordable premium living in Bachupally, Hyderabad prime education corridor.',
            price: 7000000,
            price_negotiable: 1,
            city: 'Hyderabad',
            locality: 'Bachupally',
            full_address: 'Near Silver Oaks School, Mallampet Road, Bachupally, Hyderabad',
            pin_code: '500090',
            built_up_area: 1210,
            carpet_area: 980,
            area_unit: 'sq_ft',
            bedrooms: 2,
            bathrooms: 2,
            balconies: 1,
            floors: 10,
            facing: 'East',
            furnishing: 'unfurnished',
            parking: '1 Covered Car Park',
            status: 'published',
            availability: 'available',
            is_featured: 1,
            published_at: new Date().toISOString(),
            cover_image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
        },
        {
            id: 2,
            property_code: 'SV-APT-TLP-001',
            title: 'Greenwood Heights 2BHK Gated Apartment in Tellapur',
            category: 'apartment',
            purpose: 'sale',
            short_description: 'Contemporary 1,240 Sq.Ft 2BHK gated flat near Citizen Hospital and Gaudium School.',
            description: 'Located in Tellapur, West Hyderabad highest appreciating residential enclave.',
            price: 7800000,
            price_negotiable: 1,
            city: 'Hyderabad',
            locality: 'Tellapur',
            full_address: 'Tellapur Main Road, Near Citizen Hospital, Tellapur, Hyderabad',
            pin_code: '502032',
            built_up_area: 1240,
            carpet_area: 1005,
            area_unit: 'sq_ft',
            bedrooms: 2,
            bathrooms: 2,
            balconies: 2,
            floors: 14,
            facing: 'East',
            furnishing: 'unfurnished',
            parking: '1 Reserved Covered Park',
            status: 'published',
            availability: 'available',
            is_featured: 1,
            published_at: new Date().toISOString(),
            cover_image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'
        },
        {
            id: 3,
            property_code: 'SV-PLT-SHP-001',
            title: 'Premium DTCP Highway Facing Plot in Shankarpally',
            category: 'residential_plot',
            purpose: 'sale',
            short_description: '250 Sq.Yd clear title plot with immediate construction permissions near IIT Hyderabad.',
            description: 'Outstanding capital growth parcel situated in Shankarpally - Mokila development corridor.',
            price: 7500000,
            price_negotiable: 0,
            city: 'Hyderabad',
            locality: 'Shankarpally',
            full_address: 'Shankarpally Main Road, Shankarpally, Telangana',
            pin_code: '501203',
            plot_area: 250,
            area_unit: 'sq_yd',
            status: 'published',
            availability: 'available',
            is_featured: 1,
            published_at: new Date().toISOString(),
            cover_image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80'
        },
        {
            id: 4,
            property_code: 'SV-APT-FND-001',
            title: 'One Financial 3BHK Premium High-Rise',
            category: 'apartment',
            purpose: 'sale',
            short_description: '2,300 Sq.Ft 3BHK luxury home right opposite Amazon Campus in Nanakramguda.',
            description: 'Live across the street from global tech headquarters in Nanakramguda Financial District.',
            price: 23500000,
            price_negotiable: 1,
            city: 'Hyderabad',
            locality: 'Financial District',
            full_address: 'Opposite Amazon Campus, Nanakramguda, Financial District, Hyderabad',
            pin_code: '500032',
            built_up_area: 2300,
            carpet_area: 1850,
            area_unit: 'sq_ft',
            bedrooms: 3,
            bathrooms: 3,
            status: 'published',
            availability: 'available',
            is_featured: 1,
            published_at: new Date().toISOString(),
            cover_image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
        },
        {
            id: 5,
            property_code: 'SV-APT-FND-002',
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
        },
        {
            id: 6,
            property_code: 'SV-VIL-TLP-001',
            title: 'Meadowlands Gated Community 4BHK Villa in Tellapur',
            category: 'villa',
            purpose: 'sale',
            short_description: 'Sprawling 4BHK independent villa with landscaped garden in a pristine 40-acre gated township.',
            description: 'Features 4 grand master suites with ensuite bathrooms, home theatre lounge, and private courtyard.',
            price: 45000000,
            price_negotiable: 1,
            city: 'Hyderabad',
            locality: 'Tellapur',
            full_address: 'Meadowlands Phase II, Tellapur, Hyderabad',
            pin_code: '502032',
            built_up_area: 4200,
            plot_area: 320,
            area_unit: 'sq_yd',
            bedrooms: 4,
            bathrooms: 5,
            status: 'published',
            availability: 'available',
            is_featured: 1,
            published_at: new Date().toISOString(),
            cover_image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'
        },
        {
            id: 7,
            property_code: 'SV-PLT-KKP-001',
            title: 'HMDA Golden Mile Plotted Estate in Kokapet',
            category: 'residential_plot',
            purpose: 'sale',
            short_description: 'Prime 400 Sq.Yd East-facing open plot facing 60ft BT road adjacent to Neopolis Kokapet.',
            description: 'Strategic land acquisition opportunity in Kokapet (Golden Mile Corridor).',
            price: 48000000,
            price_negotiable: 0,
            city: 'Hyderabad',
            locality: 'Kokapet',
            full_address: 'Golden Mile Road, Near Neopolis SEZ, Kokapet, Hyderabad',
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
            id: 8,
            property_code: 'SV-VIL-JBH-001',
            title: 'The Royal Sovereign 5BHK Triplex Villa in Jubilee Hills',
            category: 'villa',
            purpose: 'sale',
            short_description: 'Ultra-luxury triplex designer villa with private infinity pool and Italian marble in Jubilee Hills.',
            description: 'Experience the apex of palatial living in Jubilee Hills, Hyderabad most distinguished address.',
            price: 185000000,
            price_negotiable: 1,
            city: 'Hyderabad',
            locality: 'Jubilee Hills',
            full_address: 'Road No. 36, Jubilee Hills, Hyderabad',
            pin_code: '500033',
            built_up_area: 7200,
            plot_area: 550,
            carpet_area: 6100,
            area_unit: 'sq_yd',
            bedrooms: 5,
            bathrooms: 6,
            status: 'published',
            availability: 'available',
            is_featured: 1,
            published_at: new Date().toISOString(),
            cover_image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80'
        },
        {
            id: 9,
            property_code: 'SV-COM-GCB-001',
            title: 'Prime Grade-A Commercial Showroom Space in Gachibowli',
            category: 'commercial',
            purpose: 'sale',
            short_description: '5,200 Sq.Ft road-facing retail showroom on Gachibowli main road with high footfall.',
            description: 'Exceptional commercial asset suitable for high-end retail, corporate office, or healthcare clinic.',
            price: 78000000,
            price_negotiable: 1,
            city: 'Hyderabad',
            locality: 'Gachibowli',
            full_address: 'Main Commercial Arterial Road, Gachibowli, Hyderabad',
            pin_code: '500081',
            built_up_area: 5200,
            area_unit: 'sq_ft',
            status: 'published',
            availability: 'available',
            is_featured: 1,
            published_at: new Date().toISOString(),
            cover_image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80'
        }
    ];

    const memLeads = [];
    const memAppointments = [];
    const memSessions = new Map();
    const memSettings = {
        business_name: 'Sri Venkateswara Real Estates & Building Materials',
        business_tagline: 'Luxury Properties, Gated Communities & Building Construction',
        business_phone: '+91 9346423434',
        business_email: 'svsrivenkateswara99@gmail.com',
        business_whatsapp: '919346423434',
        business_address: '# MIG-2/183, 9th Phase, KPHB Colony, Kukatpally, Hyderabad - 500085',
        business_instagram: 'https://instagram.com/sv.realestatehyd?cplk=MWtva2tubm11NDB0Ng%3D%3D&utm_source=qr',
        admin_perm_dashboard: '0',
        admin_perm_properties: '0',
        admin_perm_leads: '1',
        admin_perm_appointments: '0'
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
                        return [
                            { id: 1, name: 'SV Super Admin', email: 'superadmin@svrealestate.com', role: 'superadmin', is_active: 1 },
                            { id: 2, name: 'SV Staff Admin', email: 'admin@svrealestate.com', role: 'admin', is_active: 1 }
                        ];
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
                        const param = String(params[0] || '').toLowerCase();
                        const bcrypt = require('bcryptjs');
                        if (param === 'superadmin@svrealestate.com' || param === '1') {
                            return {
                                id: 1,
                                name: 'SV Super Admin',
                                email: 'superadmin@svrealestate.com',
                                password_hash: bcrypt.hashSync('SuperAdmin@SV2024', 10),
                                role: 'superadmin',
                                is_active: 1
                            };
                        }
                        return {
                            id: 2,
                            name: 'SV Staff Admin',
                            email: 'admin@svrealestate.com',
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

        // Migrate users table role check constraint if needed to permit 'superadmin'
        try {
            const userTableInfo = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
            if (userTableInfo && userTableInfo.sql && !userTableInfo.sql.includes("'superadmin'")) {
                database.exec(`
                    PRAGMA foreign_keys = OFF;
                    CREATE TABLE users_migrated (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL,
                        role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('superadmin', 'admin', 'agent')),
                        is_active INTEGER NOT NULL DEFAULT 1,
                        last_login_at TEXT,
                        created_at TEXT NOT NULL DEFAULT (datetime('now')),
                        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                    );
                    INSERT OR IGNORE INTO users_migrated (id, name, email, password_hash, role, is_active, last_login_at, created_at, updated_at)
                        SELECT id, name, email, password_hash, role, is_active, last_login_at, created_at, updated_at FROM users;
                    DROP TABLE users;
                    ALTER TABLE users_migrated RENAME TO users;
                    PRAGMA foreign_keys = ON;
                `);
                console.log('✅ [MIGRATION] users table upgraded with superadmin role constraint');
            }
        } catch (migErr) {
            console.warn('⚠️ Users table migration notice:', migErr.message);
        }

        // Seed or verify Super Admin, Normal Admin, and default permissions
        try {
            const bcrypt = require('bcryptjs');
            const superEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@svrealestate.com').toLowerCase().trim();
            const superPass = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@SV2024';
            const superName = process.env.SUPERADMIN_NAME || 'SV Super Admin';

            let superUser = database.prepare('SELECT id, role FROM users WHERE email = ?').get(superEmail);
            if (!superUser) {
                const hash = bcrypt.hashSync(superPass, 10);
                database.prepare(`
                    INSERT INTO users (name, email, password_hash, role, is_active)
                    VALUES (?, ?, ?, 'superadmin', 1)
                `).run(superName, superEmail, hash);
                console.log(`✅ Super Admin user verified: ${superEmail}`);
            } else if (superUser.role !== 'superadmin') {
                database.prepare("UPDATE users SET role = 'superadmin' WHERE id = ?").run(superUser.id);
            }

            const adminEmail = (process.env.ADMIN_EMAIL || 'admin@svrealestate.com').toLowerCase().trim();
            const adminPass = process.env.ADMIN_PASSWORD || 'Admin@SV2024';
            const adminName = process.env.ADMIN_NAME || 'SV Staff Admin';

            let normalAdmin = database.prepare('SELECT id, role FROM users WHERE email = ?').get(adminEmail);
            if (!normalAdmin) {
                const hash = bcrypt.hashSync(adminPass, 10);
                database.prepare(`
                    INSERT INTO users (name, email, password_hash, role, is_active)
                    VALUES (?, ?, ?, 'admin', 1)
                `).run(adminName, adminEmail, hash);
                console.log(`✅ Normal Admin user verified: ${adminEmail}`);
            }

            // Default permissions for normal admin
            const defaultPerms = [
                ['admin_perm_dashboard', '0'],
                ['admin_perm_properties', '0'],
                ['admin_perm_leads', '1'],
                ['admin_perm_appointments', '0']
            ];
            const permStmt = database.prepare(`
                INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
            `);
            for (const [k, v] of defaultPerms) {
                permStmt.run(k, v);
            }
        } catch (adminInitErr) {
            console.warn('⚠️ Admin init notice:', adminInitErr.message);
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
