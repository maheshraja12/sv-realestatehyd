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
    role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('superadmin', 'admin', 'agent')),
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
    ('admin_perm_dashboard', '0'),
    ('admin_perm_properties', '0'),
    ('admin_perm_leads', '1'),
    ('admin_perm_appointments', '0'),
    ('smtp_configured', '0'),
    ('whatsapp_configured', '0');


-- ============================================================
-- LEADERSHIP PROFILES (Dynamic CMS — No Hardcoded Names)
-- ============================================================
CREATE TABLE IF NOT EXISTS leadership_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    designation TEXT NOT NULL,
    role_type TEXT NOT NULL DEFAULT 'director',
    bio TEXT,
    photo_url TEXT,
    experience_years INTEGER DEFAULT 15,
    achievements TEXT,
    linkedin_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    show_on_home INTEGER DEFAULT 0,
    show_on_about INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leadership_active ON leadership_profiles(is_active, display_order);

-- Initial Leadership Seed
INSERT OR IGNORE INTO leadership_profiles (id, name, designation, role_type, bio, experience_years, display_order, is_active, show_on_home, show_on_about)
VALUES
    (1, 'B. Bhuvan Raju', 'Founder', 'founder', 'Visionary founder guiding SV Real Estates with over two decades of land acquisition, development excellence, and trusted property leadership across Hyderabad.', 20, 1, 1, 1, 1),
    (2, 'D. Manikanta', 'Managing Director', 'managing_director', 'Leading executive operations, client advisory, luxury acquisitions, and project delivery with end-to-end transparency and verified compliance.', 15, 2, 1, 1, 1);

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    designation TEXT NOT NULL,
    department TEXT DEFAULT 'Real Estate Advisory',
    photo_url TEXT,
    bio TEXT,
    phone TEXT,
    email TEXT,
    linkedin_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- HOME INTERIOR SERVICES (12 Core Services)
-- ============================================================
CREATE TABLE IF NOT EXISTS interior_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category TEXT DEFAULT 'residential',
    short_description TEXT,
    full_description TEXT,
    icon TEXT DEFAULT 'fa-couch',
    image_url TEXT,
    features TEXT DEFAULT '[]',
    starting_price TEXT,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_interior_services_active ON interior_services(is_active, display_order);

-- 12 Supported Interior Services Seed
INSERT OR IGNORE INTO interior_services (id, title, slug, category, short_description, icon, starting_price, display_order, is_active)
VALUES
    (1, 'Full Home Interiors', 'full-home-interiors', 'turnkey', 'End-to-end interior design and execution with personalized 3D renders, premium woodwork, and turnkey handover.', 'fa-home', '₹8.5 Lakhs', 1, 1),
    (2, '2BHK Interior Design', '2bhk-interior-design', 'package', 'Optimized smart storage, space-maximizing modular kitchen, aesthetic false ceiling, and bespoke wardrobes for 2BHK flats.', 'fa-cubes', '₹5.5 Lakhs', 2, 1),
    (3, '3BHK Interior Design', '3bhk-interior-design', 'package', 'Comprehensive luxury interior solutions for spacious 3BHK homes including designer foyer, living lounge, and master bedroom.', 'fa-couch', '₹8.9 Lakhs', 3, 1),
    (4, '4BHK & Luxury Villa Interiors', '4bhk-luxury-villa-interiors', 'luxury', 'Ultra-premium bespoke villa interiors with imported Italian marble, ambient architectural lighting, and custom walk-in closets.', 'fa-crown', '₹16.5 Lakhs', 4, 1),
    (5, 'Modular Kitchen', 'modular-kitchen', 'specialized', 'Ergonomic German-fitted modular kitchens with anti-scratch acrylic/laminate finishes, quartz countertops, and soft-close hardware.', 'fa-utensils', '₹2.4 Lakhs', 5, 1),
    (6, 'Wardrobes & Storage', 'wardrobes-and-storage', 'specialized', 'Floor-to-ceiling sliding and hinged designer wardrobes with integrated vanity dressers, sensor LED lighting, and internal organizers.', 'fa-door-closed', '₹1.8 Lakhs', 6, 1),
    (7, 'Living Room Design', 'living-room-design', 'room', 'Opulent living spaces featuring TV accent paneling, fluted wall louvers, mood lighting, and customized centerpieces.', 'fa-tv', '₹2.2 Lakhs', 7, 1),
    (8, 'Bedroom Design', 'bedroom-design', 'room', 'Tranquil master & guest bedroom designs with upholstered headboards, acoustic wall treatments, and ambient bedside lighting.', 'fa-bed', '₹1.9 Lakhs', 8, 1),
    (9, 'False Ceiling & Lighting', 'false-ceiling-and-lighting', 'architectural', 'Precision gypsum false ceiling designs with cove lighting, dimmable smart LEDs, magnetic track spots, and chandelier cutouts.', 'fa-lightbulb', '₹95,000', 9, 1),
    (10, 'TV Units & Custom Furniture', 'tv-units-custom-furniture', 'furniture', 'Bespoke floating TV media consoles, multi-functional study desks, bar counters, and prayer mandir units.', 'fa-chair', '₹1.2 Lakhs', 10, 1),
    (11, 'Office & Commercial Interiors', 'office-commercial-interiors', 'commercial', 'Productive corporate workspaces, conference rooms, executive cabins, reception desks, and retail outlet fitouts.', 'fa-briefcase', '₹6.5 Lakhs', 11, 1),
    (12, 'Renovation & Remodelling', 'renovation-and-remodelling', 'turnkey', 'Complete home transformation, bathroom remodeling, kitchen revamp, waterproofing, and civil alteration work.', 'fa-tools', '₹3.5 Lakhs', 12, 1);

-- ============================================================
-- INTERIOR PROJECTS (Portfolio & Showcase)
-- ============================================================
CREATE TABLE IF NOT EXISTS interior_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_code TEXT UNIQUE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    locality TEXT NOT NULL,
    city TEXT DEFAULT 'Hyderabad',
    property_type TEXT NOT NULL,
    bhk_config TEXT,
    design_style TEXT,
    budget_range TEXT,
    completion_status TEXT DEFAULT 'completed',
    short_description TEXT,
    description TEXT,
    cover_image TEXT,
    is_featured INTEGER DEFAULT 0,
    is_published INTEGER DEFAULT 1,
    views_count INTEGER DEFAULT 0,
    published_at TEXT DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_interior_projects_status ON interior_projects(is_published, is_featured);

-- Seed Authentic Initial Interior Projects in Top Hyderabad Localities
INSERT OR IGNORE INTO interior_projects (id, project_code, title, slug, locality, city, property_type, bhk_config, design_style, budget_range, completion_status, short_description, description, cover_image, is_featured, is_published)
VALUES
    (1, 'SV-INT-KOK-001', 'Neopolis Sky Villa Contemporary Interior', 'neopolis-sky-villa-contemporary', 'Kokapet', 'Hyderabad', 'Villa', '4BHK', 'Contemporary Luxury', '₹22 - ₹28 Lakhs', 'completed', 'Bespoke high-end luxury interiors for a 4BHK triplex villa overlooking Kokapet Golden Mile.', 'Complete luxury renovation with Italian Statuario marble accent wall, profile lighting, Blum modular fittings, and automated sensor walk-in wardrobes.', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80', 1, 1),
    (2, 'SV-INT-FND-001', 'Financial District High-Rise 3BHK Minimalist', 'financial-district-highrise-3bhk-minimalist', 'Financial District', 'Hyderabad', 'Apartment', '3BHK', 'Modern Minimalist', '₹14 - ₹18 Lakhs', 'completed', 'Clean architectural minimalism with integrated smart storage and acrylic island kitchen in Nanakramguda.', 'Designed for tech executives featuring acoustic workspace pods, hidden door panels, fluted charcoal feature wall, and ambient cove lighting.', 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80', 1, 1),
    (3, 'SV-INT-TLP-001', 'Tellapur Gated Community 3BHK Warm Elegance', 'tellapur-gated-community-3bhk-warm-elegance', 'Tellapur', 'Hyderabad', 'Apartment', '3BHK', 'Neo-Traditional Warm', '₹11 - ₹15 Lakhs', 'completed', 'Family-centric aesthetic featuring natural teak accents, brass inlay pooja room, and quartz kitchen.', 'Customized false ceiling with zero glare magnetic spotlights, cushioned window seating, and anti-scratch PU finish wardrobes.', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80', 1, 1),
    (4, 'SV-INT-JBH-001', 'Jubilee Hills Royal Palatial Residence', 'jubilee-hills-royal-palatial-residence', 'Jubilee Hills', 'Hyderabad', 'Villa', 'Villa', 'Royal Classical', '₹35 - ₹45 Lakhs', 'completed', 'Opulent master suite, crystal chandelier ceiling layouts, and solid wood entertainment bar lounge.', 'Crafted with gold leaf trims, acoustic home theater wall panels, imported onyx stone wash counters, and bespoke designer furniture.', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80', 1, 1);

-- ============================================================
-- INTERIOR PROJECT IMAGES & BEFORE/AFTER
-- ============================================================
CREATE TABLE IF NOT EXISTS interior_project_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES interior_projects(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    title TEXT,
    image_type TEXT DEFAULT 'gallery',
    is_before_after INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_interior_images_project ON interior_project_images(project_id);

-- ============================================================
-- WEBSITE PAGES & SECTIONS CMS
-- ============================================================
CREATE TABLE IF NOT EXISTS website_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    meta_title TEXT,
    meta_description TEXT,
    hero_heading TEXT,
    hero_subheading TEXT,
    banner_image TEXT,
    is_published INTEGER DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS website_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_slug TEXT NOT NULL,
    section_key TEXT NOT NULL,
    heading TEXT,
    subheading TEXT,
    content_json TEXT DEFAULT '{}',
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(page_slug, section_key)
);

-- ============================================================
-- CONTENT REVISIONS & AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS content_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    revision_data TEXT NOT NULL,
    created_by INTEGER,
    created_by_name TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
