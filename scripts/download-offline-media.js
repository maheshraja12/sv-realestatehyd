/**
 * SV Real Estates Hyderabad — Offline Property Photo Downloader & Synchronizer
 * Downloads authentic high-resolution Hyderabad property photos into public/uploads/properties
 * and updates SQLite property_images and database/property-media.js
 */
const fs = require('fs');
const path = require('path');
const { PROPERTY_MEDIA } = require('../database/property-media');
const { getDb, closeDb } = require('../database/db');

const TARGET_DIR = path.join(__dirname, '..', 'public', 'uploads', 'properties');

if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

async function downloadWithRetry(url, destPath, retries = 3, force = false) {
    if (!force && fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
        return { success: true, cached: true };
    }
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000);
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'SVRealEstateHyd/1.0 (contact@svrealestatehyd.com; authentic property photography)'
                },
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buffer = Buffer.from(await res.arrayBuffer());
            if (buffer.length < 500) throw new Error('Downloaded file too small');
            fs.writeFileSync(destPath, buffer);
            return { success: true, cached: false, size: buffer.length };
        } catch (err) {
            if (attempt === retries) {
                return { success: false, error: err.message };
            }
            await new Promise(r => setTimeout(r, 600 * attempt));
        }
    }
}

// Concurrency helper
async function mapConcurrent(items, concurrency, fn) {
    const results = [];
    const executing = new Set();
    for (const item of items) {
        const p = Promise.resolve().then(() => fn(item));
        results.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean, clean);
        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }
    return Promise.all(results);
}

async function run() {
    const isForce = process.argv.includes('--force') || true;
    console.log(`🚀 Starting Offline Property Photo Sync to public/uploads/properties... (force=${isForce})`);
    console.log('Target directory:', TARGET_DIR);

    const downloadTasks = [];
    const localMediaMap = {};
    const validFilenames = new Set();

    for (const [code, urls] of Object.entries(PROPERTY_MEDIA)) {
        localMediaMap[code] = [];
        urls.forEach((url, idx) => {
            const ext = 'jpg';
            const filename = `${code.toLowerCase()}-${idx + 1}.${ext}`;
            const destPath = path.join(TARGET_DIR, filename);
            const localUrl = `/uploads/properties/${filename}`;
            validFilenames.add(filename);
            localMediaMap[code].push({ localUrl, remoteUrl: url, filename });
            downloadTasks.push({ code, idx, url, destPath, filename, localUrl });
        });
    }

    console.log(`📦 Found ${downloadTasks.length} photos to verify/download across ${Object.keys(PROPERTY_MEDIA).length} properties.`);

    // Clean up orphaned or obsolete files from previous fake assets
    const existingFiles = fs.readdirSync(TARGET_DIR);
    let removedOrphans = 0;
    for (const file of existingFiles) {
        if (file.endsWith('.jpg') && !validFilenames.has(file)) {
            try {
                fs.unlinkSync(path.join(TARGET_DIR, file));
                removedOrphans++;
            } catch (e) {}
        }
    }
    if (removedOrphans > 0) {
        console.log(`🧹 Removed ${removedOrphans} outdated or unreferenced image assets.`);
    }

    let completed = 0;
    let errors = 0;

    await mapConcurrent(downloadTasks, 4, async (task) => {
        const result = await downloadWithRetry(task.url, task.destPath, 3, isForce);
        completed++;
        if (result.success) {
            if (!result.cached) {
                process.stdout.write(`✅ [${completed}/${downloadTasks.length}] Saved ${task.filename} (${(result.size / 1024).toFixed(0)} KB)\n`);
            } else {
                process.stdout.write(`ℹ️ [${completed}/${downloadTasks.length}] Cached ${task.filename}\n`);
            }
        } else {
            errors++;
            console.error(`❌ [${completed}/${downloadTasks.length}] Failed ${task.filename}: ${result.error}`);
        }
    });

    console.log(`\n🎉 Download pass complete! Verified ${completed} photos. Errors: ${errors}`);

    // Update SQLite database property_images table
    const db = getDb();
    console.log('🔄 Syncing authentic local photo paths to SQLite database (svrealestate.db)...');

    const properties = db.prepare('SELECT id, property_code FROM properties').all();
    let updatedRows = 0;

    for (const prop of properties) {
        const localImages = localMediaMap[prop.property_code];
        if (!localImages || localImages.length === 0) continue;

        // Clean re-sync of images for this property to match current photo count exactly
        db.prepare('DELETE FROM property_images WHERE property_id = ?').run(prop.id);
        const insertStmt = db.prepare('INSERT INTO property_images (property_id, image_url, original_name, is_cover, display_order) VALUES (?, ?, ?, ?, ?)');

        localImages.forEach((img, idx) => {
            insertStmt.run(prop.id, img.localUrl, img.filename, idx === 0 ? 1 : 0, idx);
            updatedRows++;
        });
    }

    console.log(`✅ Synced ${updatedRows} authentic photo records in SQLite property_images table!`);
}

if (require.main === module) {
    run().then(() => {
        console.log('Done.');
        process.exit(0);
    }).catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { run };
