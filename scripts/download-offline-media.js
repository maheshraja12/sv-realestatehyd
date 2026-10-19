/**
 * SV Real Estates Hyderabad — Offline Property Photo Downloader & Synchronizer
 * Downloads high-resolution property photos into public/uploads/properties
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

async function downloadWithRetry(url, destPath, retries = 3) {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
        return { success: true, cached: true };
    }
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const res = await fetch(url, { signal: controller.signal });
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
            await new Promise(r => setTimeout(r, 500 * attempt));
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
    console.log('🚀 Starting Offline Property Photo Download to public/uploads/properties...');
    console.log('Target directory:', TARGET_DIR);

    const downloadTasks = [];
    const localMediaMap = {};

    for (const [code, urls] of Object.entries(PROPERTY_MEDIA)) {
        localMediaMap[code] = [];
        urls.forEach((url, idx) => {
            const ext = 'jpg';
            const filename = `${code.toLowerCase()}-${idx + 1}.${ext}`;
            const destPath = path.join(TARGET_DIR, filename);
            const localUrl = `/uploads/properties/${filename}`;
            localMediaMap[code].push({ localUrl, remoteUrl: url, filename });
            downloadTasks.push({ code, idx, url, destPath, filename, localUrl });
        });
    }

    console.log(`📦 Found ${downloadTasks.length} photos to verify/download across ${Object.keys(PROPERTY_MEDIA).length} properties.`);

    let completed = 0;
    let errors = 0;

    await mapConcurrent(downloadTasks, 6, async (task) => {
        const result = await downloadWithRetry(task.url, task.destPath);
        completed++;
        if (result.success) {
            if (!result.cached) {
                process.stdout.write(`✅ [${completed}/${downloadTasks.length}] Saved ${task.filename} (${(result.size / 1024).toFixed(0)} KB)\n`);
            }
        } else {
            errors++;
            console.error(`❌ [${completed}/${downloadTasks.length}] Failed ${task.filename}: ${result.error}`);
        }
    });

    console.log(`\n🎉 Download pass complete! Verified ${completed} photos. Errors: ${errors}`);

    // Update SQLite database property_images table
    const db = getDb();
    console.log('🔄 Syncing local photo paths to SQLite database (svrealestate.db)...');

    const updateStmt = db.prepare('UPDATE property_images SET image_url = ? WHERE id = ?');
    const insertStmt = db.prepare('INSERT INTO property_images (property_id, image_url, original_name, is_cover, display_order) VALUES (?, ?, ?, ?, ?)');

    const properties = db.prepare('SELECT id, property_code FROM properties').all();
    let updatedRows = 0;

    for (const prop of properties) {
        const localImages = localMediaMap[prop.property_code];
        if (!localImages || localImages.length === 0) continue;

        // Check existing images for this property
        const existingImages = db.prepare('SELECT id, display_order FROM property_images WHERE property_id = ? ORDER BY display_order ASC').all(prop.id);

        if (existingImages.length > 0) {
            existingImages.forEach((img, idx) => {
                if (localImages[idx]) {
                    const localUrl = localImages[idx].localUrl;
                    updateStmt.run(localUrl, img.id);
                    updatedRows++;
                }
            });
            // If localImages has more images than existing DB rows, insert the remaining ones
            if (localImages.length > existingImages.length) {
                for (let i = existingImages.length; i < localImages.length; i++) {
                    insertStmt.run(prop.id, localImages[i].localUrl, localImages[i].filename, 0, i);
                    updatedRows++;
                }
            }
        } else {
            // No existing images, insert all
            localImages.forEach((img, idx) => {
                insertStmt.run(prop.id, img.localUrl, img.filename, idx === 0 ? 1 : 0, idx);
                updatedRows++;
            });
        }
    }

    console.log(`✅ Updated ${updatedRows} photo references in SQLite property_images table!`);
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
