/**
 * SV Real Estates Hyderabad
 * Non-destructive Properties & Images Synchronization to Supabase
 *
 * Usage:
 *   node scripts/sync-properties-to-supabase.js --dry-run   (Pre-flight inspection only)
 *   node scripts/sync-properties-to-supabase.js --execute   (Performs upsert synchronization)
 */
require('dotenv').config();
const { getDb } = require('../database/db');
const { isPostgresConfigured, getSupabaseClient, getPgPool } = require('../database/postgres');

async function syncProperties() {
    const isDryRun = !process.argv.includes('--execute');

    console.log('='.repeat(70));
    console.log(' SV Real Estates — Supabase Properties Sync Utility');
    console.log(` Mode: ${isDryRun ? '🔍 DRY RUN (Preview only — no database changes)' : '🚀 EXECUTE (Applying changes to Supabase)'}`);
    console.log('='.repeat(70));

    if (!isPostgresConfigured()) {
        console.error('❌ Supabase / PostgreSQL is not configured in .env');
        process.exit(1);
    }

    const localDb = getDb();
    const localProperties = localDb.prepare('SELECT * FROM properties ORDER BY id ASC').all();
    console.log(`📋 Found ${localProperties.length} properties in local catalog.`);

    if (localProperties.length === 0) {
        console.log('⚠️ No local properties found to sync.');
        process.exit(0);
    }

    const sb = getSupabaseClient();
    const pg = getPgPool();

    let syncedCount = 0;
    let skippedCount = 0;
    let imagesSyncedCount = 0;

    for (const prop of localProperties) {
        const localImages = localDb.prepare('SELECT * FROM property_images WHERE property_id = ? ORDER BY display_order ASC').all(prop.id);

        if (isDryRun) {
            console.log(` [PREVIEW] Would sync: ${prop.property_code} — "${prop.title}" (${prop.locality}, ${prop.category}) with ${localImages.length} images`);
            syncedCount++;
            imagesSyncedCount += localImages.length;
            continue;
        }

        try {
            // Upsert property into Supabase
            if (sb) {
                const { data: existing } = await sb
                    .from('properties')
                    .select('id, property_code')
                    .eq('property_code', prop.property_code)
                    .maybeSingle();

                let propId;
                if (!existing) {
                    const propData = {
                        property_code: prop.property_code,
                        title: prop.title,
                        description: prop.description,
                        short_description: prop.short_description || null,
                        category: prop.category,
                        purpose: prop.purpose,
                        property_type: prop.property_type || null,
                        price: prop.price,
                        price_unit: prop.price_unit || 'total',
                        price_per_sqft: prop.price_per_sqft || null,
                        is_price_negotiable: Boolean(prop.is_price_negotiable),
                        address: prop.address || null,
                        locality: prop.locality,
                        city: prop.city || 'Hyderabad',
                        state: prop.state || 'Telangana',
                        pincode: prop.pincode || null,
                        latitude: prop.latitude || null,
                        longitude: prop.longitude || null,
                        built_up_area: prop.built_up_area || null,
                        carpet_area: prop.carpet_area || null,
                        plot_area: prop.plot_area || null,
                        area_unit: prop.area_unit || 'sq.ft',
                        bedrooms: prop.bedrooms || null,
                        bathrooms: prop.bathrooms || null,
                        balconies: prop.balconies || null,
                        facing: prop.facing || null,
                        floor_number: prop.floor_number || null,
                        total_floors: prop.total_floors || null,
                        furnishing: prop.furnishing || 'unfurnished',
                        parking_spaces: prop.parking_spaces || 0,
                        possession_status: prop.possession_status || 'ready_to_move',
                        possession_date: prop.possession_date || null,
                        rera_id: prop.rera_id || null,
                        hmda_approved: Boolean(prop.hmda_approved),
                        rera_approved: Boolean(prop.rera_approved),
                        clear_title: Boolean(prop.clear_title),
                        loan_available: Boolean(prop.loan_available),
                        amenities: prop.amenities || null,
                        specifications: prop.specifications || null,
                        location_advantages: prop.location_advantages || null,
                        status: prop.status || 'published',
                        is_featured: Boolean(prop.is_featured),
                        is_verified: Boolean(prop.is_verified),
                        featured_order: prop.featured_order || 0,
                        seo_title: prop.seo_title || null,
                        seo_description: prop.seo_description || null
                    };

                    const { data: inserted, error: insertErr } = await sb
                        .from('properties')
                        .insert(propData)
                        .select('id')
                        .single();

                    if (insertErr) {
                        console.error(`❌ Failed to insert ${prop.property_code}:`, insertErr.message);
                        continue;
                    }
                    propId = inserted.id;
                    syncedCount++;
                } else {
                    propId = existing.id;
                    skippedCount++;
                }

                // Sync images
                if (propId && localImages.length > 0) {
                    for (const img of localImages) {
                        const { error: imgErr } = await sb
                            .from('property_images')
                            .insert({
                                property_id: propId,
                                image_url: img.image_url,
                                is_cover: Boolean(img.is_cover),
                                display_order: img.display_order || 0,
                                caption: img.caption || null
                            });
                        if (!imgErr) imagesSyncedCount++;
                    }
                }
            }
        } catch (err) {
            console.error(`❌ Error syncing ${prop.property_code}:`, err.message);
        }
    }

    console.log('='.repeat(70));
    console.log(` Summary:`);
    console.log(`   Properties Synced:  ${syncedCount}`);
    console.log(`   Properties Skipped: ${skippedCount} (already exist)`);
    console.log(`   Images Synced:      ${imagesSyncedCount}`);
    console.log('='.repeat(70));
    process.exit(0);
}

syncProperties().catch(err => {
    console.error('Fatal sync error:', err);
    process.exit(1);
});

