-- ==============================================================
-- SV Real Estates Hyderabad — Supabase PostgreSQL Schema
-- Tables: public.session, public.leads, public.enquiries, public.appointments, public.settings
-- Run this in your Supabase SQL Editor if needed (auto-migrated by app as well)
-- ==============================================================

-- 1. Session Table (Used by connect-pg-simple for persistent serverless sessions)
CREATE TABLE IF NOT EXISTS public."session" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON public."session" ("expire");

-- 2. Leads / Enquiries Table (Receives all "Enquire Now", callback, and chatbot leads)
CREATE TABLE IF NOT EXISTS public.leads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- 3. Also provide public.enquiries view or table for compatibility
CREATE TABLE IF NOT EXISTS public.enquiries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lead_code VARCHAR(50),
    full_name VARCHAR(200) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    appointment_date VARCHAR(50),
    appointment_time VARCHAR(50),
    property_requirement VARCHAR(200),
    email VARCHAR(200),
    message TEXT,
    status VARCHAR(50) DEFAULT 'New',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status ON public.enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_created ON public.enquiries(created_at DESC);

-- 4. Site Visits & Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_created ON public.appointments(created_at DESC);

-- 5. Business Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.settings (key, value) VALUES
    ('business_name', 'Sri Venkateswara Building Material Traders'),
    ('business_tagline', 'Building Construction & Materials Supplier'),
    ('business_phone', '+91 9346423434'),
    ('business_email', 'info@svbuildingmaterials.com'),
    ('business_whatsapp', '919346423434'),
    ('business_address', '# MIG-2/183, 9th Phase, KPHB Colony, Kukatpally, Hyderabad - 500085'),
    ('business_instagram', 'https://instagram.com/sv.realestatehyd?cplk=MWtva2tubm11NDB0Ng%3D%3D&utm_source=qr')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Enable Row Level Security (RLS) policies for security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Allow anonymous & authenticated to insert, select, and update leads and appointments
DROP POLICY IF EXISTS "Public can insert leads" ON public.leads;
CREATE POLICY "Public can insert leads" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read leads" ON public.leads;
CREATE POLICY "Public can read leads" ON public.leads FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can update leads" ON public.leads;
CREATE POLICY "Public can update leads" ON public.leads FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can insert enquiries" ON public.enquiries;
CREATE POLICY "Public can insert enquiries" ON public.enquiries FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read enquiries" ON public.enquiries;
CREATE POLICY "Public can read enquiries" ON public.enquiries FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can update enquiries" ON public.enquiries;
CREATE POLICY "Public can update enquiries" ON public.enquiries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can insert appointments" ON public.appointments;
CREATE POLICY "Public can insert appointments" ON public.appointments FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read appointments" ON public.appointments;
CREATE POLICY "Public can read appointments" ON public.appointments FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can update appointments" ON public.appointments;
CREATE POLICY "Public can update appointments" ON public.appointments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Allow service_role and postgres full access to everything
DROP POLICY IF EXISTS "Service role full access leads" ON public.leads;
CREATE POLICY "Service role full access leads" ON public.leads FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access enquiries" ON public.enquiries;
CREATE POLICY "Service role full access enquiries" ON public.enquiries FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access appointments" ON public.appointments;
CREATE POLICY "Service role full access appointments" ON public.appointments FOR ALL TO service_role USING (true) WITH CHECK (true);
