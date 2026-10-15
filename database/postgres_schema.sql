-- ==============================================================
-- SV Real Estates Hyderabad — PostgreSQL & Supabase Cloud Schema
-- Compatible with: Supabase, Neon, Vercel Postgres, Render, Railway, AWS RDS
-- ==============================================================

-- 1. Session Table (Used by connect-pg-simple for persistent serverless sessions)
CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- 2. Leads / Enquiries Table (Receives all "Enquire Now", callback, and chatbot leads)
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

-- 3. Appointments & Site Visits Table
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

-- 4. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO settings (key, value) VALUES
    ('business_name', 'Sri Venkateswara Building Material Traders'),
    ('business_tagline', 'Building Construction & Materials Supplier'),
    ('business_phone', '+91 9346423434'),
    ('business_email', 'info@svbuildingmaterials.com'),
    ('business_whatsapp', '919346423434'),
    ('business_address', '# MIG-2/183, 9th Phase, KPHB Colony, Kukatpally, Hyderabad - 500085'),
    ('business_instagram', 'https://instagram.com/sv.realestatehyd?cplk=MWtva2tubm11NDB0Ng%3D%3D&utm_source=qr')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
