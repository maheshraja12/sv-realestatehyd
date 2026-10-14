require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'svrealestate.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function getDb() {
    if (!db) {
        db = new DatabaseSync(DB_PATH);
        // SQLite pragmas
        db.exec('PRAGMA foreign_keys = ON;');
        db.exec('PRAGMA journal_mode = WAL;');
        db.exec('PRAGMA busy_timeout = 5000;');

        // Polyfill pragma method for any legacy callers
        db.pragma = function (cmd) {
            return db.exec(`PRAGMA ${cmd};`);
        };
    }
    return db;
}

function initializeDb() {
    const database = getDb();
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    database.exec(schema);

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

    console.log('✅ Database initialized successfully');
    return database;
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
