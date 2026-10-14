/**
 * SV Real Estates Hyderabad — Supabase PostgreSQL Integration Client
 * Handles connection, customer enquiry inserts, and admin queries.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// Check if credentials are meaningfully set and not template placeholders
function isSupabaseConfigured() {
    if (!supabaseUrl || !supabaseAnonKey) return false;
    if (supabaseUrl.includes('your-project') || supabaseAnonKey.includes('your-supabase')) return false;
    if (!supabaseUrl.startsWith('https://') && !supabaseUrl.startsWith('http://')) return false;
    return true;
}

let supabase = null;
let supabaseAdmin = null;

if (isSupabaseConfigured()) {
    try {
        // Public client (uses anon key, respects Row-Level Security)
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false }
        });

        // Admin client (uses service role key if available, else anon key)
        const adminKey = supabaseServiceRoleKey || supabaseAnonKey;
        supabaseAdmin = createClient(supabaseUrl, adminKey, {
            auth: { persistSession: false }
        });

        console.log(`✅ [SUPABASE] Client initialized successfully for: ${supabaseUrl}`);
    } catch (err) {
        console.error('❌ [SUPABASE] Initialization failed:', err.message);
    }
} else {
    console.log('ℹ️ [SUPABASE] Real credentials not detected in .env; running in local SQLite replica mode until credentials are provided.');
}

/**
 * Insert an enquiry into Supabase PostgreSQL (public.enquiries)
 * @param {Object} enquiry
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function insertEnquiry(enquiry) {
    if (!isSupabaseConfigured() || !supabase) {
        return { 
            success: false, 
            notConfigured: true, 
            error: 'Supabase credentials are not configured in .env' 
        };
    }

    try {
        const payload = {
            full_name: String(enquiry.full_name || enquiry.customer_name || '').trim(),
            phone_number: String(enquiry.phone_number || enquiry.phone || '').trim(),
            appointment_date: String(enquiry.appointment_date || enquiry.preferred_visit_date || '').trim(),
            appointment_time: String(enquiry.appointment_time || '10:00 AM - 12:00 PM').trim(),
            property_requirement: String(enquiry.property_requirement || enquiry.property_category || 'Residential Plot').trim(),
            status: enquiry.status || 'New'
        };

        const clientToUse = supabaseAdmin || supabase;
        const { data, error } = await clientToUse
            .from('enquiries')
            .insert([payload])
            .select();

        if (error) {
            console.error('❌ [SUPABASE INSERT ERROR]:', error);
            return { success: false, error: error.message || 'Database insert failed' };
        }

        console.log(`✅ [SUPABASE INSERT SUCCESS]: Enquiry ID ${data && data[0] ? data[0].id : 'N/A'} for ${payload.full_name}`);
        return { success: true, data: data && data[0] ? data[0] : null };
    } catch (err) {
        console.error('❌ [SUPABASE EXCEPTION]:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Fetch enquiries from Supabase PostgreSQL with optional filters and pagination
 * @param {Object} options
 * @returns {Promise<{success: boolean, data?: any[], count?: number, error?: string}>}
 */
async function fetchEnquiries(options = {}) {
    if (!isSupabaseConfigured() || (!supabase && !supabaseAdmin)) {
        return { success: false, notConfigured: true, data: [], count: 0 };
    }

    try {
        const clientToUse = supabaseAdmin || supabase;
        let query = clientToUse
            .from('enquiries')
            .select('*', { count: 'exact' });

        if (options.status) {
            query = query.ilike('status', options.status);
        }

        if (options.search) {
            const s = `%${options.search}%`;
            query = query.or(`full_name.ilike.${s},phone_number.ilike.${s},property_requirement.ilike.${s}`);
        }

        query = query.order('created_at', { ascending: false });

        if (options.limit) {
            const from = options.offset || 0;
            const to = from + options.limit - 1;
            query = query.range(from, to);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('❌ [SUPABASE FETCH ERROR]:', error);
            return { success: false, error: error.message, data: [], count: 0 };
        }

        return { success: true, data: data || [], count: count || 0 };
    } catch (err) {
        console.error('❌ [SUPABASE FETCH EXCEPTION]:', err.message);
        return { success: false, error: err.message, data: [], count: 0 };
    }
}

/**
 * Get Enquiry by ID from Supabase
 * @param {number|string} id
 */
async function getEnquiryById(id) {
    if (!isSupabaseConfigured() || (!supabase && !supabaseAdmin)) {
        return { success: false, notConfigured: true, data: null };
    }

    try {
        const clientToUse = supabaseAdmin || supabase;
        const { data, error } = await clientToUse
            .from('enquiries')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            return { success: false, error: error.message, data: null };
        }
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message, data: null };
    }
}

/**
 * Get aggregated enquiry stats from Supabase
 */
async function getEnquiryStats() {
    if (!isSupabaseConfigured() || (!supabase && !supabaseAdmin)) {
        return { success: false, notConfigured: true };
    }

    try {
        const clientToUse = supabaseAdmin || supabase;
        const { count: total, error: totalErr } = await clientToUse
            .from('enquiries')
            .select('*', { count: 'exact', head: true });

        const { count: newCount, error: newErr } = await clientToUse
            .from('enquiries')
            .select('*', { count: 'exact', head: true })
            .ilike('status', 'new');

        if (totalErr || newErr) {
            return { success: false, error: (totalErr || newErr).message };
        }

        return { 
            success: true, 
            total: total || 0, 
            newCount: newCount || 0 
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Update enquiry status in Supabase
 * @param {number|string} id
 * @param {string} status
 */
async function updateEnquiryStatus(id, status) {
    if (!isSupabaseConfigured() || (!supabase && !supabaseAdmin)) {
        return { success: false, notConfigured: true };
    }

    try {
        const clientToUse = supabaseAdmin || supabase;
        const { data, error } = await clientToUse
            .from('enquiries')
            .update({ status })
            .eq('id', id)
            .select();

        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true, data: data && data[0] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Test connectivity to Supabase
 */
async function testConnection() {
    if (!isSupabaseConfigured()) {
        return { 
            connected: false, 
            message: 'Supabase credentials not configured or using placeholders in .env' 
        };
    }

    try {
        const clientToUse = supabaseAdmin || supabase;
        const { data, error } = await clientToUse
            .from('enquiries')
            .select('id')
            .limit(1);

        if (error) {
            return { connected: false, error: error.message, code: error.code };
        }
        return { connected: true, message: 'Successfully connected to Supabase PostgreSQL table public.enquiries' };
    } catch (err) {
        return { connected: false, error: err.message };
    }
}

module.exports = {
    supabase,
    supabaseAdmin,
    isSupabaseConfigured,
    insertEnquiry,
    fetchEnquiries,
    getEnquiryById,
    getEnquiryStats,
    updateEnquiryStatus,
    testConnection
};
