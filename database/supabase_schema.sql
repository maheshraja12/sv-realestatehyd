-- ==============================================================
-- SV Real Estates Hyderabad — Supabase PostgreSQL Schema
-- Table: public.enquiries
-- ==============================================================

-- 1. Create Enquiries Table
CREATE TABLE IF NOT EXISTS public.enquiries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TEXT NOT NULL,
  property_requirement TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- 3. Reset Permissions
REVOKE ALL ON public.enquiries FROM anon, authenticated;

-- 4. Grant Insert Permission to Anon (Public Website Visitors)
GRANT INSERT ON public.enquiries TO anon;

-- 5. RLS Policy: Allow Public Customers to Submit Enquiries with Validation
DROP POLICY IF EXISTS "Allow customer enquiry submissions" ON public.enquiries;
CREATE POLICY "Allow customer enquiry submissions"
ON public.enquiries
FOR INSERT TO anon
WITH CHECK (
  length(trim(full_name)) BETWEEN 2 AND 100
  AND length(trim(phone_number)) BETWEEN 7 AND 20
  AND length(trim(property_requirement)) BETWEEN 1 AND 100
);

-- 6. Grant Read and Update Permissions to Authenticated & Service Role (Admin Portal)
GRANT SELECT, UPDATE ON public.enquiries TO authenticated, service_role;

-- 7. RLS Policy: Allow Authenticated Admins to View All Enquiries
DROP POLICY IF EXISTS "Allow authenticated admin to view enquiries" ON public.enquiries;
CREATE POLICY "Allow authenticated admin to view enquiries"
ON public.enquiries
FOR SELECT TO authenticated, service_role
USING (true);

-- 8. RLS Policy: Allow Authenticated Admins to Update Enquiry Status
DROP POLICY IF EXISTS "Allow authenticated admin to update enquiries" ON public.enquiries;
CREATE POLICY "Allow authenticated admin to update enquiries"
ON public.enquiries
FOR UPDATE TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- 9. Helpful Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON public.enquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON public.enquiries (status);
CREATE INDEX IF NOT EXISTS idx_enquiries_appointment_date ON public.enquiries (appointment_date);
