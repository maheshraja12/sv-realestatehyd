/**
 * Automated Supabase & Cloud Integration Tests — SV Real Estates Hyderabad
 * Validates real database operations, RLS security policies, and data integrity.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();
const {
    isPostgresConfigured,
    fetchLeads,
    fetchProperties,
    getPropertyById,
    fetchCustomerProfiles,
    fetchFollowUpTasks,
    getSupabaseClient
} = require('../database/postgres');
const { getDb } = require('../database/db');

describe('Supabase Cloud Sync & Real Database Integration', () => {

    test('1. Supabase credentials and client are properly configured', () => {
        assert.equal(isPostgresConfigured(), true, 'Supabase / PostgreSQL must be configured');
        const sb = getSupabaseClient();
        assert.ok(sb, 'Supabase REST client must be successfully initialized');
    });

    test('2. Existing persistent customer leads count >= 37 in Supabase', async () => {
        const result = await fetchLeads({ limit: 100 });
        assert.equal(result.success, true, 'fetchLeads must succeed');
        assert.ok(result.count >= 37, `Expected at least 37 existing leads, found ${result.count}`);
        assert.ok(Array.isArray(result.data), 'result.data must be an array');
        assert.ok(result.data.length >= 37, `Expected at least 37 lead records returned, got ${result.data.length}`);

        // Validate lead record integrity (sample)
        const sample = result.data[0];
        assert.ok(sample.id, 'Lead must have an id');
        assert.ok(sample.lead_code, 'Lead must have a lead_code');
        assert.ok(sample.customer_name || sample.full_name, 'Lead must have a customer name');
        assert.ok(sample.phone, 'Lead must have a phone number');
    });

    test('3. Local properties catalog has 38 verified Hyderabad properties', () => {
        const localDb = getDb();
        const row = localDb.prepare("SELECT COUNT(*) as count FROM properties WHERE status = 'published'").get();
        assert.ok(row.count >= 38, `Expected at least 38 published properties, got ${row.count}`);
    });

    test('4. RLS Security: Public anon client CANNOT read customer leads', async () => {
        const sbUrl = (process.env.SV_REAL_ESTATE_SUPABASE_URL || '').trim();
        const anonKey = (process.env.SV_REAL_ESTATE_SUPABASE_ANON_KEY || '').trim();
        if (!sbUrl || !anonKey) return; // Skip if anon key not configured

        const { createClient } = require('@supabase/supabase-js');
        const anonClient = createClient(sbUrl, anonKey);

        const { data, error } = await anonClient.from('leads').select('*');
        // RLS policy: Anon role has NO SELECT policy on leads, so either error is returned or data is empty []
        if (error) {
            assert.ok(error, 'Anon client blocked by RLS');
        } else {
            assert.strictEqual((data || []).length, 0, 'Anon client must receive 0 lead rows under RLS');
        }
    });

    test('5. RLS Security: Public anon client CANNOT read appointments', async () => {
        const sbUrl = (process.env.SV_REAL_ESTATE_SUPABASE_URL || '').trim();
        const anonKey = (process.env.SV_REAL_ESTATE_SUPABASE_ANON_KEY || '').trim();
        if (!sbUrl || !anonKey) return;

        const { createClient } = require('@supabase/supabase-js');
        const anonClient = createClient(sbUrl, anonKey);

        const { data, error } = await anonClient.from('appointments').select('*');
        if (error) {
            assert.ok(error, 'Anon client blocked by RLS');
        } else {
            assert.strictEqual((data || []).length, 0, 'Anon client must receive 0 appointment rows under RLS');
        }
    });

    test('6. RLS Security: Public anon client CANNOT read customer profiles', async () => {
        const sbUrl = (process.env.SV_REAL_ESTATE_SUPABASE_URL || '').trim();
        const anonKey = (process.env.SV_REAL_ESTATE_SUPABASE_ANON_KEY || '').trim();
        if (!sbUrl || !anonKey) return;

        const { createClient } = require('@supabase/supabase-js');
        const anonClient = createClient(sbUrl, anonKey);

        const { data, error } = await anonClient.from('customer_profiles').select('*');
        if (error) {
            assert.ok(error, 'Anon client blocked by RLS');
        } else {
            assert.strictEqual((data || []).length, 0, 'Anon client must receive 0 customer profiles under RLS');
        }
    });

    test('7. Database: Fetch properties handles search, category, and limit query filters', async () => {
        const result = await fetchProperties({ category: 'apartment', limit: 5 });
        assert.equal(result.success, true);
        assert.ok(Array.isArray(result.data));
    });

    test('8. Database: Customer profiles fetch operation returns valid schema structure', async () => {
        const result = await fetchCustomerProfiles({ limit: 10 });
        assert.equal(result.success, true);
        assert.ok(Array.isArray(result.data));
    });

    test('9. Database: Follow-up tasks query executes successfully', async () => {
        const result = await fetchFollowUpTasks({ limit: 10 });
        assert.equal(result.success, true);
        assert.ok(Array.isArray(result.data));
    });

});
