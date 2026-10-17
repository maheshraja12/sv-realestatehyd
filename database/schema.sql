-- SV Real Estates Hyderabad — Database Schema
-- SQLite with WAL mode for concurrent reads

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- USERS (Admin / Agents)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent' CHECK(role IN ('admin', 'agent')),
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- PROPERTIES
-- ============================================================
CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN (
        'villa', 'residential_plot', 'apartment', 'independent_house',
        'commercial', 'agricultural_land', 'rental'
    )),
    purpose TEXT NOT NULL DEFAULT 'sale' CHECK(purpose IN ('sale', 'rent', 'lease')),
    short_description TEXT,
    description TEXT,
    price REAL,
    price_negotiable INTEGER NOT NULL DEFAULT 0,

    -- Location
    state TEXT DEFAULT 'Telangana',
    city TEXT DEFAULT 'Hyderabad',
    locality TEXT,
    full_address TEXT,
    pin_code TEXT,
    map_link TEXT,
    latitude REAL,
    longitude REAL,

    -- Property Details
    plot_area REAL,
    built_up_area REAL,
    carpet_area REAL,
    area_unit TEXT DEFAULT 'sq_ft' CHECK(area_unit IN ('sq_ft', 'sq_yd', 'acres', 'guntas', 'cents')),
    bedrooms INTEGER,
    bathrooms INTEGER,
    balconies INTEGER,
    floors INTEGER,
    facing TEXT,
    furnishing TEXT CHECK(furnishing IN ('unfurnished', 'semi_furnished', 'fully_furnished', NULL)),
    parking TEXT,

    -- Plot-specific
    plot_dimensions TEXT,
    road_width TEXT,
    land_use_category TEXT,
    approval_details TEXT,

    -- Villa-specific
    private_garden INTEGER DEFAULT 0,
    private_pool INTEGER DEFAULT 0,

    -- Media
    virtual_tour_link TEXT,
    brochure_url TEXT,

    -- Amenities (JSON array)
    amenities TEXT DEFAULT '[]',

    -- Status & Listing
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
    availability TEXT DEFAULT 'available' CHECK(availability IN ('available', 'sold', 'rented', 'upcoming')),
    is_featured INTEGER NOT NULL DEFAULT 0,
    published_at TEXT,

    -- SEO
    seo_title TEXT,
    seo_description TEXT,

    -- Internal
    admin_notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_purpose ON properties(purpose);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_featured ON properties(is_featured);

-- ============================================================
-- PROPERTY IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS property_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    original_name TEXT,
    is_cover INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_property_images_property ON property_images(property_id);

-- ============================================================
-- LEADS (Customer Enquiries)
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_code TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    full_name TEXT,
    phone TEXT NOT NULL,
    phone_number TEXT,
    email TEXT,
    property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
    property_category TEXT,
    property_requirement TEXT,
    budget TEXT,
    preferred_location TEXT,
    message TEXT,
    contact_preference TEXT DEFAULT 'phone',
    preferred_visit_date TEXT,
    appointment_date TEXT,
    appointment_time TEXT,
    consent INTEGER NOT NULL DEFAULT 1,
    source TEXT DEFAULT 'website',

    -- CRM Fields
    status TEXT NOT NULL DEFAULT 'new',
    assigned_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    next_follow_up TEXT,

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_property ON leads(property_id);
CREATE INDEX IF NOT EXISTS idx_leads_agent ON leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

-- ============================================================
-- LEAD NOTES (Communication Log)
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    note_type TEXT DEFAULT 'note' CHECK(note_type IN ('note', 'call', 'email', 'whatsapp', 'status_change', 'system')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON lead_notes(lead_id);

-- ============================================================
-- LEAD STATUS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead ON lead_status_history(lead_id);

-- ============================================================
-- APPOINTMENTS (Site Visits)
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_code TEXT NOT NULL UNIQUE,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    notes TEXT,
    requested_date TEXT NOT NULL,
    requested_time TEXT,
    confirmed_date TEXT,
    confirmed_time TEXT,
    status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN (
        'requested', 'confirmed', 'rescheduled', 'completed', 'cancelled'
    )),
    assigned_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    result_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(requested_date);
CREATE INDEX IF NOT EXISTS idx_appointments_property ON appointments(property_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'info' CHECK(type IN ('info', 'lead', 'appointment', 'property', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- ============================================================
-- SETTINGS (Key-Value store for app config)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default settings
INSERT OR REPLACE INTO settings (key, value) VALUES
    ('business_name', 'Sri Venkateswara Real Estates & Building Materials'),
    ('business_tagline', 'Luxury Properties, Gated Communities & Building Construction'),
    ('business_phone', '+91 9346423434'),
    ('business_email', 'svsrivenkateswara99@gmail.com'),
    ('business_whatsapp', '919346423434'),
    ('business_address', '# MIG-2/183, 9th Phase, KPHB Colony, Kukatpally, Hyderabad - 500085'),
    ('business_instagram', 'https://instagram.com/sv.realestatehyd?cplk=MWtva2tubm11NDB0Ng%3D%3D&utm_source=qr'),
    ('smtp_configured', '0'),
    ('whatsapp_configured', '0');
