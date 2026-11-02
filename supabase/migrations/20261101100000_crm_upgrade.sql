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

