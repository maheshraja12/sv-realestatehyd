-- ==============================================================
-- SV Real Estates Hyderabad — Supabase PostgreSQL Schema
-- Tables: public.session, public.leads, public.enquiries, public.appointments, public.settings,
--         public.leadership_profiles, public.team_members, public.interior_services,
--         public.interior_projects, public.interior_project_images, public.website_pages,
--         public.website_sections, public.content_revisions, public.admin_audit_logs
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
    lead_category VARCHAR(100) DEFAULT 'Property Buying',
    service_type VARCHAR(100),
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
CREATE INDEX IF NOT EXISTS idx_leads_category ON public.leads(lead_category);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- 3. Compatibility Enquiries Table
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
    ('business_name', 'Sri Venkateswara Real Estates & Building Materials'),
    ('business_tagline', 'Luxury Properties, Gated Communities & Home Interiors'),
    ('business_phone', '+91 9346423434'),
    ('business_email', 'svsrivenkateswara99@gmail.com'),
    ('business_whatsapp', '919346423434'),
    ('business_address', '# MIG-2/183, 9th Phase, KPHB Colony, Kukatpally, Hyderabad - 500085'),
    ('business_instagram', 'https://instagram.com/sv.realestatehyd?cplk=MWtva2tubm11NDB0Ng%3D%3D&utm_source=qr'),
    ('admin_perm_dashboard', '0'),
    ('admin_perm_properties', '0'),
    ('admin_perm_leads', '1'),
    ('admin_perm_appointments', '0'),
    ('theme_primary_color', '#0a0d14'),
    ('theme_accent_gold', '#d4af37'),
    ('whatsapp_floating_enabled', '1'),
    ('announcement_bar_enabled', '0'),
    ('announcement_text', '')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 6. Admin Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'property_manager', 'sales_staff', 'interior_manager', 'staff', 'agent')),
    is_active INT NOT NULL DEFAULT 1,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.users (name, email, password_hash, role, is_active) VALUES
    ('SV Super Admin', 'superadmin@svrealestate.com', '$2a$10$MXv9CNsonmpzFy7zQXAMe.sLLhAPs.rPHlKwQgY26aj8h.cd0N0Zu', 'superadmin', 1),
    ('SV Staff Admin', 'admin@svrealestate.com', '$2a$10$GHBRBZWJoYyPhtnXZkMB1unMHhM5bEbanT6pV7tK9OEPwQcsG4fgK', 'admin', 1)
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;

-- 7. Leadership & Executive Team Profiles (CMS Managed)
CREATE TABLE IF NOT EXISTS public.leadership_profiles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    designation VARCHAR(150) NOT NULL,
    role_type VARCHAR(100) NOT NULL DEFAULT 'director',
    bio TEXT,
    photo_url TEXT,
    experience_years INT DEFAULT 15,
    achievements TEXT,
    linkedin_url VARCHAR(300),
    display_order INT DEFAULT 0,
    is_active INT DEFAULT 1,
    show_on_home INT DEFAULT 0,
    show_on_about INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leadership_active ON public.leadership_profiles(is_active, display_order);

-- 8. Team Members Table
CREATE TABLE IF NOT EXISTS public.team_members (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    designation VARCHAR(150) NOT NULL,
    department VARCHAR(100) DEFAULT 'Real Estate Advisory',
    photo_url TEXT,
    bio TEXT,
    phone VARCHAR(50),
    email VARCHAR(200),
    linkedin_url VARCHAR(300),
    display_order INT DEFAULT 0,
    is_active INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Home Interior Services Catalog (12 Supported Services)
CREATE TABLE IF NOT EXISTS public.interior_services (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(150) NOT NULL UNIQUE,
    category VARCHAR(100) DEFAULT 'residential',
    short_description TEXT,
    full_description TEXT,
    icon VARCHAR(100) DEFAULT 'fa-couch',
    image_url TEXT,
    features TEXT,
    starting_price VARCHAR(100),
    display_order INT DEFAULT 0,
    is_active INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interior_services_active ON public.interior_services(is_active, display_order);

-- 10. Interior Projects Portfolio
CREATE TABLE IF NOT EXISTS public.interior_projects (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_code VARCHAR(50) UNIQUE,
    title VARCHAR(250) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    locality VARCHAR(150) NOT NULL,
    city VARCHAR(100) DEFAULT 'Hyderabad',
    property_type VARCHAR(100) NOT NULL,
    bhk_config VARCHAR(50),
    design_style VARCHAR(100),
    budget_range VARCHAR(100),
    completion_status VARCHAR(50) DEFAULT 'completed',
    short_description TEXT,
    description TEXT,
    cover_image TEXT,
    is_featured INT DEFAULT 0,
    is_published INT DEFAULT 1,
    views_count INT DEFAULT 0,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interior_projects_status ON public.interior_projects(is_published, is_featured);

-- 11. Interior Project Gallery & Before/After Images
CREATE TABLE IF NOT EXISTS public.interior_project_images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id BIGINT REFERENCES public.interior_projects(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    title VARCHAR(200),
    image_type VARCHAR(50) DEFAULT 'gallery',
    is_before_after INT DEFAULT 0,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Website Pages & Sections CMS
CREATE TABLE IF NOT EXISTS public.website_pages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    meta_title VARCHAR(250),
    meta_description TEXT,
    hero_heading VARCHAR(250),
    hero_subheading TEXT,
    banner_image TEXT,
    is_published INT DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.website_sections (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    page_slug VARCHAR(100) NOT NULL,
    section_key VARCHAR(100) NOT NULL,
    heading VARCHAR(250),
    subheading TEXT,
    content_json JSONB DEFAULT '{}'::jsonb,
    image_url TEXT,
    display_order INT DEFAULT 0,
    is_active INT DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_page_section UNIQUE (page_slug, section_key)
);

-- 13. Content Revision History & Rollback
CREATE TABLE IF NOT EXISTS public.content_revisions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    revision_data JSONB NOT NULL,
    created_by BIGINT,
    created_by_name VARCHAR(200),
    note VARCHAR(250),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Admin Audit Logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT,
    user_name VARCHAR(200),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    details TEXT,
    ip_address VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==============================================================
-- CRM MODULE TABLES (Pipeline, Customers, Follow-ups, Activities)
-- ==============================================================

-- Customer Profiles (360 Degree Customer Profiles)
CREATE TABLE IF NOT EXISTS public.customer_profiles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_code VARCHAR(100) NOT NULL UNIQUE,
    lead_id BIGINT REFERENCES public.leads(id) ON DELETE SET NULL,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    alt_phone VARCHAR(50),
    email VARCHAR(200),
    address TEXT,
    city VARCHAR(100) DEFAULT 'Hyderabad',
    preferred_locations TEXT,
    budget_range VARCHAR(100),
    property_interests TEXT,
    deal_status VARCHAR(50) NOT NULL DEFAULT 'active',
    assigned_to BIGINT,
    notes TEXT,
    merged_into_id BIGINT REFERENCES public.customer_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customer_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_customers_assigned ON public.customer_profiles(assigned_to);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customer_profiles(deal_status);

-- Follow-Up Tasks & Reminders
CREATE TABLE IF NOT EXISTS public.follow_up_tasks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_code VARCHAR(100) NOT NULL UNIQUE,
    lead_id BIGINT REFERENCES public.leads(id) ON DELETE CASCADE,
    customer_id BIGINT REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
    assigned_to BIGINT,
    title VARCHAR(250) NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'medium',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result_notes TEXT,
    completed_at TIMESTAMPTZ,
    created_by BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followups_scheduled ON public.follow_up_tasks(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_followups_status ON public.follow_up_tasks(status);
CREATE INDEX IF NOT EXISTS idx_followups_assigned ON public.follow_up_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_followups_lead ON public.follow_up_tasks(lead_id);

-- Lead & Customer Activity Timeline
CREATE TABLE IF NOT EXISTS public.lead_activities (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lead_id BIGINT REFERENCES public.leads(id) ON DELETE CASCADE,
    customer_id BIGINT REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
    user_id BIGINT,
    user_name VARCHAR(200),
    activity_type VARCHAR(50) NOT NULL,
    title VARCHAR(250) NOT NULL,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_customer ON public.lead_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON public.lead_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_created ON public.lead_activities(created_at);

-- CRM Teams & Members
CREATE TABLE IF NOT EXISTS public.crm_teams (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    team_lead_id BIGINT,
    is_active INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_team_members (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES public.crm_teams(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- CRM Lead Assignment Rules
CREATE TABLE IF NOT EXISTS public.crm_lead_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    config JSONB,
    is_active INT DEFAULT 1,
    priority_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) Configuration
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leadership_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_project_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_sections ENABLE ROW LEVEL SECURITY;

-- Allow anonymous & authenticated to INSERT leads/appointments
DROP POLICY IF EXISTS "Public can insert leads" ON public.leads;
CREATE POLICY "Public can insert leads" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can insert enquiries" ON public.enquiries;
CREATE POLICY "Public can insert enquiries" ON public.enquiries FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can insert appointments" ON public.appointments;
CREATE POLICY "Public can insert appointments" ON public.appointments FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Protect customer PII: authenticated staff & service role only can read/modify leads
DROP POLICY IF EXISTS "Public can read leads" ON public.leads;
DROP POLICY IF EXISTS "Public can update leads" ON public.leads;
DROP POLICY IF EXISTS "Staff full access leads" ON public.leads;
CREATE POLICY "Staff full access leads" ON public.leads FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Public can update enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Staff full access enquiries" ON public.enquiries;
CREATE POLICY "Staff full access enquiries" ON public.enquiries FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff full access appointments" ON public.appointments;
CREATE POLICY "Staff full access appointments" ON public.appointments FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

-- Public read policies for CMS content
DROP POLICY IF EXISTS "Public can read settings" ON public.settings;
CREATE POLICY "Public can read settings" ON public.settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Staff full access settings" ON public.settings;
CREATE POLICY "Staff full access settings" ON public.settings FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access users" ON public.users;
CREATE POLICY "Service role full access users" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated can read users" ON public.users;
CREATE POLICY "Authenticated can read users" ON public.users FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public can read leadership" ON public.leadership_profiles;
CREATE POLICY "Public can read leadership" ON public.leadership_profiles FOR SELECT TO anon, authenticated USING (is_active = 1);
DROP POLICY IF EXISTS "Staff full access leadership" ON public.leadership_profiles;
CREATE POLICY "Staff full access leadership" ON public.leadership_profiles FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read interior services" ON public.interior_services;
CREATE POLICY "Public can read interior services" ON public.interior_services FOR SELECT TO anon, authenticated USING (is_active = 1);
DROP POLICY IF EXISTS "Staff full access interior services" ON public.interior_services;
CREATE POLICY "Staff full access interior services" ON public.interior_services FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read interior projects" ON public.interior_projects;
CREATE POLICY "Public can read interior projects" ON public.interior_projects FOR SELECT TO anon, authenticated USING (is_published = 1);
DROP POLICY IF EXISTS "Staff full access interior projects" ON public.interior_projects;
CREATE POLICY "Staff full access interior projects" ON public.interior_projects FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read interior project images" ON public.interior_project_images;
CREATE POLICY "Public can read interior project images" ON public.interior_project_images FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Staff full access interior project images" ON public.interior_project_images;
CREATE POLICY "Staff full access interior project images" ON public.interior_project_images FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read website pages" ON public.website_pages;
CREATE POLICY "Public can read website pages" ON public.website_pages FOR SELECT TO anon, authenticated USING (is_published = 1);
DROP POLICY IF EXISTS "Staff full access website pages" ON public.website_pages;
CREATE POLICY "Staff full access website pages" ON public.website_pages FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read website sections" ON public.website_sections;
CREATE POLICY "Public can read website sections" ON public.website_sections FOR SELECT TO anon, authenticated USING (is_active = 1);
DROP POLICY IF EXISTS "Staff full access website sections" ON public.website_sections;
CREATE POLICY "Staff full access website sections" ON public.website_sections FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);


-- CRM Row Level Security
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff full access customer_profiles" ON public.customer_profiles;
CREATE POLICY "Staff full access customer_profiles" ON public.customer_profiles FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff full access follow_up_tasks" ON public.follow_up_tasks;
CREATE POLICY "Staff full access follow_up_tasks" ON public.follow_up_tasks FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff full access lead_activities" ON public.lead_activities;
CREATE POLICY "Staff full access lead_activities" ON public.lead_activities FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff full access crm_teams" ON public.crm_teams;
CREATE POLICY "Staff full access crm_teams" ON public.crm_teams FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff full access crm_team_members" ON public.crm_team_members;
CREATE POLICY "Staff full access crm_team_members" ON public.crm_team_members FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff full access crm_lead_rules" ON public.crm_lead_rules;
CREATE POLICY "Staff full access crm_lead_rules" ON public.crm_lead_rules FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);
