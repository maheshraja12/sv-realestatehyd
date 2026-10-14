/**
 * Migration runner — initializes or updates the database schema
 * Run: npm run migrate
 */
require('dotenv').config();
const { initializeDb, getDb, closeDb } = require('./db');

try {
    initializeDb();
    const db = getDb();

    // Check leads table columns
    const columns = db.prepare('PRAGMA table_info(leads)').all().map(c => c.name);
    console.log('Current leads table columns:', columns);

    const requiredCols = [
        { name: 'full_name', type: 'TEXT' },
        { name: 'phone_number', type: 'TEXT' },
        { name: 'appointment_date', type: 'TEXT' },
        { name: 'appointment_time', type: 'TEXT' },
        { name: 'property_requirement', type: 'TEXT' }
    ];

    for (const col of requiredCols) {
        if (!columns.includes(col.name)) {
            console.log(`Adding missing column: ${col.name} (${col.type})`);
            db.exec(`ALTER TABLE leads ADD COLUMN ${col.name} ${col.type};`);
        }
    }

    // Backfill data so both aliases are always populated
    db.exec(`
        UPDATE leads 
        SET 
            full_name = COALESCE(full_name, customer_name),
            phone_number = COALESCE(phone_number, phone),
            appointment_date = COALESCE(appointment_date, preferred_visit_date),
            property_requirement = COALESCE(property_requirement, property_category, 'General Enquiry')
        WHERE full_name IS NULL OR phone_number IS NULL OR appointment_date IS NULL OR property_requirement IS NULL;
    `);

    console.log('✅ Migration complete and leads table verified');
    closeDb();
} catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
}

