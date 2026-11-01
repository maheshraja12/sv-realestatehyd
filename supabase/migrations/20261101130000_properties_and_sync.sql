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

