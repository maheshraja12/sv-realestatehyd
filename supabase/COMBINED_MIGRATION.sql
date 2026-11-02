-- ==============================================================
-- SV Real Estates Hyderabad — Complete CRM System Upgrade Migration
-- Migration: 20261101100000_crm_upgrade.sql
-- Non-destructive, idempotent, preserves all existing records
-- ==============================================================

-- 1. Extend Leads Table with CRM Fields
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to BIGINT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_follow_up_date TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS customer_id BIGINT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS estimated_budget_val NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_assigned ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON public.leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON public.leads(next_follow_up_date);

-- 2. Extend Users Table for CRM Roles and Team Structure
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS designation VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS team_id BIGINT;

-- 3. Extend Appointments Table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_id BIGINT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS feedback_rating INT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS feedback_notes TEXT;

-- 4. Customer Profiles Table (360-degree Customer Records)
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

-- 5. Follow-Up Tasks Table
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

-- 6. Lead & Customer Activity Timeline Table
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

-- 7. CRM Teams and Members
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

-- 8. CRM Lead Assignment Rules
CREATE TABLE IF NOT EXISTS public.crm_lead_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    config JSONB,
    is_active INT DEFAULT 1,
    priority_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Row Level Security Policies
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_crm_customers') THEN
        CREATE POLICY service_role_all_crm_customers ON public.customer_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_crm_followups') THEN
        CREATE POLICY service_role_all_crm_followups ON public.follow_up_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_crm_activities') THEN
        CREATE POLICY service_role_all_crm_activities ON public.lead_activities FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_crm_teams') THEN
        CREATE POLICY service_role_all_crm_teams ON public.crm_teams FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ==============================================================
-- SV Real Estates Hyderabad — Properties Catalog & Sync Migration
-- Migration: 20261101130000_properties_and_sync.sql
-- Non-destructive, idempotent, preserves all existing tables & records
-- ==============================================================

-- 1. Properties Table
CREATE TABLE IF NOT EXISTS public.properties (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    property_code VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(300) NOT NULL,
    category VARCHAR(100) NOT NULL CHECK(category IN (
        'villa', 'residential_plot', 'apartment', 'independent_house',
        'commercial', 'agricultural_land', 'rental'
    )),
    purpose VARCHAR(50) NOT NULL DEFAULT 'sale' CHECK(purpose IN ('sale', 'rent', 'lease')),
    short_description TEXT,
    description TEXT,
    price NUMERIC,
    price_negotiable INT NOT NULL DEFAULT 0,

    -- Location
    state VARCHAR(100) DEFAULT 'Telangana',
    city VARCHAR(100) DEFAULT 'Hyderabad',
    locality VARCHAR(200),
    full_address TEXT,
    pin_code VARCHAR(50),
    map_link TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,

    -- Property Details
    plot_area NUMERIC,
    built_up_area NUMERIC,
    carpet_area NUMERIC,
    area_unit VARCHAR(50) DEFAULT 'sq_ft' CHECK(area_unit IN ('sq_ft', 'sq_yd', 'acres', 'guntas', 'cents')),
    bedrooms INT,
    bathrooms INT,
    balconies INT,
    floors INT,
    facing VARCHAR(50),
    furnishing VARCHAR(50) CHECK(furnishing IN ('unfurnished', 'semi_furnished', 'fully_furnished', NULL)),
    parking VARCHAR(200),

    -- Plot-specific
    plot_dimensions VARCHAR(200),
    road_width VARCHAR(200),
    land_use_category VARCHAR(200),
    approval_details TEXT,

    -- Villa-specific
    private_garden INT DEFAULT 0,
    private_pool INT DEFAULT 0,

    -- Media
    cover_image TEXT,
    virtual_tour_link TEXT,
    brochure_url TEXT,

    -- Amenities (JSONB array)
    amenities JSONB DEFAULT '[]'::jsonb,

    -- Status & Listing
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
    availability VARCHAR(50) DEFAULT 'available' CHECK(availability IN ('available', 'sold', 'rented', 'upcoming')),
    is_featured INT NOT NULL DEFAULT 0,
    published_at TIMESTAMPTZ,

    -- SEO
    seo_title VARCHAR(300),
    seo_description TEXT,

    -- Internal
    admin_notes TEXT,
    created_by BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_category ON public.properties(category);
CREATE INDEX IF NOT EXISTS idx_properties_city ON public.properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_purpose ON public.properties(purpose);
CREATE INDEX IF NOT EXISTS idx_properties_price ON public.properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_featured ON public.properties(is_featured);

-- 2. Property Images Table
CREATE TABLE IF NOT EXISTS public.property_images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    property_id BIGINT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    original_name VARCHAR(300),
    is_cover INT NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_images_property ON public.property_images(property_id);

-- 3. Row Level Security for Properties
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published properties" ON public.properties;
CREATE POLICY "Public can read published properties" ON public.properties FOR SELECT TO anon, authenticated USING (status = 'published');

DROP POLICY IF EXISTS "Staff full access properties" ON public.properties;
CREATE POLICY "Staff full access properties" ON public.properties FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read property images" ON public.property_images;
CREATE POLICY "Public can read property images" ON public.property_images FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff full access property images" ON public.property_images;
CREATE POLICY "Staff full access property images" ON public.property_images FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

-- 4. Customer PII Security: Verify anonymous users cannot read leads or appointments
DROP POLICY IF EXISTS "Public can read leads" ON public.leads;
DROP POLICY IF EXISTS "Public can update leads" ON public.leads;
DROP POLICY IF EXISTS "Public can delete leads" ON public.leads;

DROP POLICY IF EXISTS "Public can read appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public can delete appointments" ON public.appointments;

DROP POLICY IF EXISTS "Public can read customer_profiles" ON public.customer_profiles;
DROP POLICY IF EXISTS "Public can update customer_profiles" ON public.customer_profiles;
DROP POLICY IF EXISTS "Public can delete customer_profiles" ON public.customer_profiles;

