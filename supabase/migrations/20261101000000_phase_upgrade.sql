-- ==============================================================
-- SV Real Estates Hyderabad & Home Interiors — Phase Upgrade Migration
-- Safe & Reversible Migration: Adds CMS, Interiors, Leadership, and Hardened RLS
-- Existing tables and customer records are 100% PRESERVED
-- ==============================================================

-- 1. Extend Leads Table for Interior Categories & Multi-Category Enquiries
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_category VARCHAR(100) DEFAULT 'Property Buying';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS service_type VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_leads_category ON public.leads(lead_category);

-- 2. Leadership & Executive Team Table (Dynamic CMS, no hardcoded names)
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

-- Seed initial approved leadership records if empty
INSERT INTO public.leadership_profiles (name, designation, role_type, bio, experience_years, display_order, is_active, show_on_home, show_on_about)
SELECT 'B. Bhuvan Raju', 'Founder', 'founder', 'Visionary founder guiding SV Real Estates with over two decades of land acquisition, development excellence, and trusted property leadership across Hyderabad.', 20, 1, 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM public.leadership_profiles WHERE designation = 'Founder');

INSERT INTO public.leadership_profiles (name, designation, role_type, bio, experience_years, display_order, is_active, show_on_home, show_on_about)
SELECT 'D. Manikanta', 'Managing Director', 'managing_director', 'Leading executive operations, client advisory, luxury acquisitions, and project delivery with end-to-end transparency and verified compliance.', 15, 2, 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM public.leadership_profiles WHERE designation = 'Managing Director');

-- 3. Team Members Table
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

-- 4. Home Interior Services Catalog (12 Supported Services)
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

-- Seed 12 core interior services if not already present
INSERT INTO public.interior_services (title, slug, category, short_description, icon, starting_price, display_order, is_active)
VALUES
    ('Full Home Interiors', 'full-home-interiors', 'turnkey', 'End-to-end interior design and execution with personalized 3D renders, premium woodwork, and turnkey handover.', 'fa-home', '₹8.5 Lakhs', 1, 1),
    ('2BHK Interior Design', '2bhk-interior-design', 'package', 'Optimized smart storage, space-maximizing modular kitchen, aesthetic false ceiling, and bespoke wardrobes for 2BHK flats.', 'fa-cubes', '₹5.5 Lakhs', 2, 1),
    ('3BHK Interior Design', '3bhk-interior-design', 'package', 'Comprehensive luxury interior solutions for spacious 3BHK homes including designer foyer, living lounge, and master bedroom.', 'fa-couch', '₹8.9 Lakhs', 3, 1),
    ('4BHK & Luxury Villa Interiors', '4bhk-luxury-villa-interiors', 'luxury', 'Ultra-premium bespoke villa interiors with imported Italian marble, ambient architectural lighting, and custom walk-in closets.', 'fa-crown', '₹16.5 Lakhs', 4, 1),
    ('Modular Kitchen', 'modular-kitchen', 'specialized', 'Ergonomic German-fitted modular kitchens with anti-scratch acrylic/laminate finishes, quartz countertops, and soft-close hardware.', 'fa-utensils', '₹2.4 Lakhs', 5, 1),
    ('Wardrobes & Storage', 'wardrobes-and-storage', 'specialized', 'Floor-to-ceiling sliding and hinged designer wardrobes with integrated vanity dressers, sensor LED lighting, and internal organizers.', 'fa-door-closed', '₹1.8 Lakhs', 6, 1),
    ('Living Room Design', 'living-room-design', 'room', 'Opulent living spaces featuring TV accent paneling, fluted wall louvers, mood lighting, and customized centerpieces.', 'fa-tv', '₹2.2 Lakhs', 7, 1),
    ('Bedroom Design', 'bedroom-design', 'room', 'Tranquil master & guest bedroom designs with upholstered headboards, acoustic wall treatments, and ambient bedside lighting.', 'fa-bed', '₹1.9 Lakhs', 8, 1),
    ('False Ceiling & Lighting', 'false-ceiling-and-lighting', 'architectural', 'Precision gypsum false ceiling designs with cove lighting, dimmable smart LEDs, magnetic track spots, and chandelier cutouts.', 'fa-lightbulb', '₹95,000', 9, 1),
    ('TV Units & Custom Furniture', 'tv-units-custom-furniture', 'furniture', 'Bespoke floating TV media consoles, multi-functional study desks, bar counters, and prayer mandir units.', 'fa-chair', '₹1.2 Lakhs', 10, 1),
    ('Office & Commercial Interiors', 'office-commercial-interiors', 'commercial', 'Productive corporate workspaces, conference rooms, executive cabins, reception desks, and retail outlet fitouts.', 'fa-briefcase', '₹6.5 Lakhs', 11, 1),
    ('Renovation & Remodelling', 'renovation-and-remodelling', 'turnkey', 'Complete home transformation, bathroom remodeling, kitchen revamp, waterproofing, and civil alteration work.', 'fa-tools', '₹3.5 Lakhs', 12, 1)
ON CONFLICT (slug) DO NOTHING;

-- 5. Interior Projects Portfolio
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

-- 6. Interior Project Gallery & Before/After Images
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
CREATE INDEX IF NOT EXISTS idx_interior_images_project ON public.interior_project_images(project_id);

-- 7. Website Pages & Sections CMS
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

-- 8. Content Revision History & Rollback
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
CREATE INDEX IF NOT EXISTS idx_revisions_entity ON public.content_revisions(entity_type, entity_id);

-- 9. Comprehensive Admin Audit Logs
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
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_logs(created_at DESC);

-- 10. Update RLS Policies with Strict Security
-- Revoke insecure anonymous SELECT/UPDATE on customer data:
DROP POLICY IF EXISTS "Public can read leads" ON public.leads;
DROP POLICY IF EXISTS "Public can update leads" ON public.leads;
DROP POLICY IF EXISTS "Public can read enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Public can update enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Public can read appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public can update appointments" ON public.appointments;

-- Allow anonymous & authenticated to INSERT leads/appointments (needed for public contact forms)
DROP POLICY IF EXISTS "Public can insert leads" ON public.leads;
CREATE POLICY "Public can insert leads" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can insert enquiries" ON public.enquiries;
CREATE POLICY "Public can insert enquiries" ON public.enquiries FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can insert appointments" ON public.appointments;
CREATE POLICY "Public can insert appointments" ON public.appointments FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Authenticated and Service Role have full access to customer data
DROP POLICY IF EXISTS "Staff can read leads" ON public.leads;
CREATE POLICY "Staff can read leads" ON public.leads FOR SELECT TO authenticated, service_role USING (true);
DROP POLICY IF EXISTS "Staff can update leads" ON public.leads;
CREATE POLICY "Staff can update leads" ON public.leads FOR UPDATE TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can read appointments" ON public.appointments;
CREATE POLICY "Staff can read appointments" ON public.appointments FOR SELECT TO authenticated, service_role USING (true);
DROP POLICY IF EXISTS "Staff can update appointments" ON public.appointments;
CREATE POLICY "Staff can update appointments" ON public.appointments FOR UPDATE TO authenticated, service_role USING (true) WITH CHECK (true);

-- Enable RLS and public read on CMS entities
ALTER TABLE public.leadership_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interior_project_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read leadership" ON public.leadership_profiles FOR SELECT TO anon, authenticated USING (is_active = 1);
CREATE POLICY "Staff full access leadership" ON public.leadership_profiles FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public can read interior services" ON public.interior_services FOR SELECT TO anon, authenticated USING (is_active = 1);
CREATE POLICY "Staff full access interior services" ON public.interior_services FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public can read interior projects" ON public.interior_projects FOR SELECT TO anon, authenticated USING (is_published = 1);
CREATE POLICY "Staff full access interior projects" ON public.interior_projects FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public can read interior project images" ON public.interior_project_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff full access interior project images" ON public.interior_project_images FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public can read website pages" ON public.website_pages FOR SELECT TO anon, authenticated USING (is_published = 1);
CREATE POLICY "Staff full access website pages" ON public.website_pages FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public can read website sections" ON public.website_sections FOR SELECT TO anon, authenticated USING (is_active = 1);
CREATE POLICY "Staff full access website sections" ON public.website_sections FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

