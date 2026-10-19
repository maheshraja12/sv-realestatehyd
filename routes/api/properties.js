/**
 * Property CRUD API
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../../database/db');
const { requireAuth, auditLog, notifyAllAdmins } = require('../../middleware/auth');
const { sanitizeObject, validatePropertyData } = require('../../middleware/validation');
const { upload } = require('../../middleware/upload');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { cloudLeadsConfigured, listCloudProperties, createCloudProperty, updateCloudProperty, uploadCloudPropertyImage, setCloudPropertyStatus, setCloudPropertyCoverImage, deleteCloudPropertyImage, deleteCloudProperty } = require('../../database/cloud-leads');
const { enhanceProperty, enhancePropertyList } = require('../../database/property-media');

// Generate unique property code
function generatePropertyCode(category) {
    const prefix = {
        villa: 'SV-VL',
        residential_plot: 'SV-RP',
        apartment: 'SV-AP',
        independent_house: 'SV-IH',
        commercial: 'SV-CM',
        agricultural_land: 'SV-AL',
        rental: 'SV-RT'
    };
    const pre = prefix[category] || 'SV-PR';
    const num = String(Date.now()).slice(-6);
    return `${pre}-${num}`;
}

// ── Public Endpoints ──────────────────────────────────────

// GET /api/properties/public — Public property list
router.get('/public', async (req, res) => {
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).json({ error: 'Production properties database is not configured.' });
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 12));
        const result = await listCloudProperties({ public: true, page, limit, offset: (page - 1) * limit, category: req.query.category, purpose: req.query.purpose, min_price: req.query.min_price, max_price: req.query.max_price, bedrooms: req.query.bedrooms, search: req.query.search });
        if (!result.success) return res.status(502).json({ error: result.error || 'Unable to load published properties.' });
        const properties = enhancePropertyList(result.properties || []);
        return res.json({ properties, total: Number(result.total || 0), page, totalPages: Math.ceil(Number(result.total || 0) / limit) });
    }
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    const category = req.query.category || '';
    const purpose = req.query.purpose || '';
    const minPrice = req.query.min_price || '';
    const maxPrice = req.query.max_price || '';
    const bedrooms = req.query.bedrooms || '';
    const search = req.query.search || '';

    let where = "status = 'published'";
    const params = [];

    if (search) {
        where += ' AND (title LIKE ? OR locality LIKE ? OR city LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) { where += ' AND category = ?'; params.push(category); }
    if (purpose) { where += ' AND purpose = ?'; params.push(purpose); }
    if (minPrice) { where += ' AND price >= ?'; params.push(parseFloat(minPrice)); }
    if (maxPrice) { where += ' AND price <= ?'; params.push(parseFloat(maxPrice)); }
    if (bedrooms) { where += ' AND bedrooms >= ?'; params.push(parseInt(bedrooms)); }

    const total = db.prepare(`SELECT COUNT(*) as count FROM properties WHERE ${where}`).get(...params).count;
    let properties = db.prepare(`
        SELECT p.id, p.property_code, p.title, p.category, p.purpose, p.short_description,
            p.price, p.price_negotiable, p.city, p.locality, p.plot_area, p.built_up_area,
            p.area_unit, p.bedrooms, p.bathrooms, p.floors, p.facing, p.furnishing,
            p.is_featured, p.amenities, p.availability,
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image
        FROM properties p
        WHERE ${where}
        ORDER BY p.is_featured DESC, p.published_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    properties = enhancePropertyList(properties);

    res.json({ properties, total, page, totalPages: Math.ceil(total / limit) });
});

// GET /api/properties/public/:id — Public property detail
router.get('/public/:id', async (req, res) => {
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).json({ error: 'Production properties database is not configured.' });
        const result = await listCloudProperties({ public: true, id: req.params.id, limit: 1, offset: 0 });
        const property = result.success ? result.property : null;
        if (!property) return res.status(result.success ? 404 : 502).json({ error: result.error || 'Property not found.' });
        enhanceProperty(property);
        delete property.admin_notes; delete property.created_by;
        return res.json({ property, images: property.images || [] });
    }
    const db = getDb();
    let property;
    if (isNaN(req.params.id)) {
        property = db.prepare("SELECT * FROM properties WHERE property_code = ? AND status = 'published'").get(req.params.id);
    } else {
        property = db.prepare("SELECT * FROM properties WHERE id = ? AND status = 'published'").get(req.params.id);
    }

    if (!property) return res.status(404).json({ error: 'Property not found' });

    enhanceProperty(property);
    let images = db.prepare('SELECT * FROM property_images WHERE property_id = ? ORDER BY display_order').all(property.id);
    if (!images || images.length === 0) images = property.images || [];
    
    // Don't expose admin_notes to public
    delete property.admin_notes;
    delete property.created_by;

    res.json({ property, images });
});

// ── Admin Endpoints (Protected) ──────────────────────────

// POST /api/properties — Create property
router.post('/', requireAuth, async (req, res) => {
    try {
        const db = getDb();
        const data = sanitizeObject(req.body);
        const errors = validatePropertyData(data);
        if (errors.length > 0) return res.status(400).json({ errors });

        if (process.env.VERCEL) {
            if (!cloudLeadsConfigured()) return res.status(503).json({ error: 'Production properties database is not configured.' });
            const saved = await createCloudProperty({ ...data, created_by: req.session.userId });
            if (!saved.success) return res.status(502).json({ error: saved.error || 'Failed to save property to production database.' });
            return res.status(201).json({ id: saved.id, property_code: saved.property_code, message: saved.message || 'Property created successfully' });
        }

        const propertyCode = data.property_code || generatePropertyCode(data.category);

        // Check for duplicate property code
        const existing = db.prepare('SELECT id FROM properties WHERE property_code = ?').get(propertyCode);
        if (existing) return res.status(409).json({ error: 'Property code already exists' });

        let amenities = '[]';
        if (data.amenities) {
            try {
                amenities = typeof data.amenities === 'string' ? data.amenities : JSON.stringify(data.amenities);
            } catch (e) { amenities = '[]'; }
        }

        const result = db.prepare(`
            INSERT INTO properties (
                property_code, title, category, purpose, short_description, description,
                price, price_negotiable, state, city, locality, full_address, pin_code,
                map_link, latitude, longitude, plot_area, built_up_area, carpet_area,
                area_unit, bedrooms, bathrooms, balconies, floors, facing, furnishing,
                parking, plot_dimensions, road_width, land_use_category, approval_details,
                private_garden, private_pool, virtual_tour_link, brochure_url,
                amenities, status, availability, is_featured, seo_title, seo_description,
                admin_notes, created_by
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        `).run(
            propertyCode, data.title, data.category, data.purpose || 'sale',
            data.short_description || null, data.description || null,
            data.price ? parseFloat(data.price) : null,
            data.price_negotiable ? 1 : 0,
            data.state || 'Telangana', data.city || 'Hyderabad',
            data.locality || null, data.full_address || null, data.pin_code || null,
            data.map_link || null,
            data.latitude ? parseFloat(data.latitude) : null,
            data.longitude ? parseFloat(data.longitude) : null,
            data.plot_area ? parseFloat(data.plot_area) : null,
            data.built_up_area ? parseFloat(data.built_up_area) : null,
            data.carpet_area ? parseFloat(data.carpet_area) : null,
            data.area_unit || 'sq_ft',
            data.bedrooms ? parseInt(data.bedrooms) : null,
            data.bathrooms ? parseInt(data.bathrooms) : null,
            data.balconies ? parseInt(data.balconies) : null,
            data.floors ? parseInt(data.floors) : null,
            data.facing || null, data.furnishing || null, data.parking || null,
            data.plot_dimensions || null, data.road_width || null,
            data.land_use_category || null, data.approval_details || null,
            data.private_garden ? 1 : 0, data.private_pool ? 1 : 0,
            data.virtual_tour_link || null, data.brochure_url || null,
            amenities,
            data.status || 'draft', data.availability || 'available',
            data.is_featured ? 1 : 0,
            data.seo_title || null, data.seo_description || null,
            data.admin_notes || null, req.session.userId
        );

        const propertyId = result.lastInsertRowid;

        // If publishing, set published_at
        if (data.status === 'published') {
            db.prepare("UPDATE properties SET published_at = datetime('now') WHERE id = ?").run(propertyId);
        }

        auditLog(db, req.session.userId, req.session.userName, 'create', 'property', propertyId, `Created: ${data.title}`, req.ip);

        res.status(201).json({ id: propertyId, property_code: propertyCode, message: 'Property created successfully' });
    } catch (err) {
        console.error('Create property error:', err);
        res.status(500).json({ error: 'Failed to create property' });
    }
});

// PUT /api/properties/:id — Update property
router.put('/:id', requireAuth, async (req, res) => {
    try {
        if (process.env.VERCEL) {
            if (!cloudLeadsConfigured()) return res.status(503).json({ error: 'Production properties database is not configured.' });
            const data = sanitizeObject(req.body);
            const errors = validatePropertyData(data);
            if (errors.length > 0) return res.status(400).json({ errors });
            const updated = await updateCloudProperty(req.params.id, { ...data, updated_at: new Date().toISOString() });
            if (!updated.success) return res.status(502).json({ error: updated.error || 'Failed to update property.' });
            return res.json({ message: 'Property updated successfully' });
        }
        const db = getDb();
        const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
        if (!property) return res.status(404).json({ error: 'Property not found' });

        const data = sanitizeObject(req.body);
        const errors = validatePropertyData(data);
        if (errors.length > 0) return res.status(400).json({ errors });

        // Check property_code uniqueness if changed
        if (data.property_code && data.property_code !== property.property_code) {
            const dup = db.prepare('SELECT id FROM properties WHERE property_code = ? AND id != ?').get(data.property_code, property.id);
            if (dup) return res.status(409).json({ error: 'Property code already exists' });
        }

        let amenities = property.amenities;
        if (data.amenities !== undefined) {
            try {
                amenities = typeof data.amenities === 'string' ? data.amenities : JSON.stringify(data.amenities);
            } catch (e) { /* keep existing */ }
        }

        // Track publish status change
        const wasPublished = property.status === 'published';
        const willPublish = data.status === 'published';

        db.prepare(`
            UPDATE properties SET
                title = ?, category = ?, purpose = ?, short_description = ?, description = ?,
                price = ?, price_negotiable = ?, state = ?, city = ?, locality = ?,
                full_address = ?, pin_code = ?, map_link = ?, latitude = ?, longitude = ?,
                plot_area = ?, built_up_area = ?, carpet_area = ?, area_unit = ?,
                bedrooms = ?, bathrooms = ?, balconies = ?, floors = ?, facing = ?,
                furnishing = ?, parking = ?, plot_dimensions = ?, road_width = ?,
                land_use_category = ?, approval_details = ?, private_garden = ?, private_pool = ?,
                virtual_tour_link = ?, brochure_url = ?, amenities = ?, status = ?,
                availability = ?, is_featured = ?, seo_title = ?, seo_description = ?,
                admin_notes = ?, updated_at = datetime('now'),
                property_code = COALESCE(?, property_code)
            WHERE id = ?
        `).run(
            data.title, data.category, data.purpose || 'sale',
            data.short_description || null, data.description || null,
            data.price ? parseFloat(data.price) : null,
            data.price_negotiable ? 1 : 0,
            data.state || 'Telangana', data.city || 'Hyderabad',
            data.locality || null, data.full_address || null, data.pin_code || null,
            data.map_link || null,
            data.latitude ? parseFloat(data.latitude) : null,
            data.longitude ? parseFloat(data.longitude) : null,
            data.plot_area ? parseFloat(data.plot_area) : null,
            data.built_up_area ? parseFloat(data.built_up_area) : null,
            data.carpet_area ? parseFloat(data.carpet_area) : null,
            data.area_unit || 'sq_ft',
            data.bedrooms ? parseInt(data.bedrooms) : null,
            data.bathrooms ? parseInt(data.bathrooms) : null,
            data.balconies ? parseInt(data.balconies) : null,
            data.floors ? parseInt(data.floors) : null,
            data.facing || null, data.furnishing || null, data.parking || null,
            data.plot_dimensions || null, data.road_width || null,
            data.land_use_category || null, data.approval_details || null,
            data.private_garden ? 1 : 0, data.private_pool ? 1 : 0,
            data.virtual_tour_link || null, data.brochure_url || null,
            amenities, data.status || property.status,
            data.availability || 'available',
            data.is_featured ? 1 : 0,
            data.seo_title || null, data.seo_description || null,
            data.admin_notes || null,
            data.property_code || null,
            req.params.id
        );

        // Set published_at if newly publishing
        if (!wasPublished && willPublish) {
            db.prepare("UPDATE properties SET published_at = datetime('now') WHERE id = ?").run(req.params.id);
        }

        auditLog(db, req.session.userId, req.session.userName, 'update', 'property', req.params.id, `Updated: ${data.title}`, req.ip);

        res.json({ message: 'Property updated successfully' });
    } catch (err) {
        console.error('Update property error:', err);
        res.status(500).json({ error: 'Failed to update property' });
    }
});

// POST /api/properties/:id/images — Upload images (files or URLs)
router.post('/:id/images', requireAuth, upload.array('images', 20), async (req, res) => {
    try {
        const urlList = [];
        if (req.body && req.body.image_url) {
            const trimmed = String(req.body.image_url).trim();
            if (trimmed) urlList.push(trimmed);
        }
        if (req.body && Array.isArray(req.body.image_urls)) {
            req.body.image_urls.forEach(u => {
                if (typeof u === 'string' && u.trim()) urlList.push(u.trim());
            });
        }

        const hasFiles = Boolean(req.files && req.files.length > 0);
        const hasUrls = Boolean(urlList.length > 0);

        if (!hasFiles && !hasUrls) {
            return res.status(400).json({ error: 'No images or image URLs provided' });
        }

        if (process.env.VERCEL) {
            if (!cloudLeadsConfigured()) return res.status(503).json({ error: 'Production properties database is not configured.' });
            const images = [];
            if (hasFiles) {
                for (const file of req.files) {
                    const saved = await uploadCloudPropertyImage(req.params.id, file);
                    if (!saved.success) return res.status(502).json({ error: saved.error || 'Property image upload failed.' });
                    images.push(saved.image);
                }
            }
            if (hasUrls) {
                for (const u of urlList) {
                    images.push({ image_url: u });
                }
            }
            return res.json({ images, message: `${images.length} image(s) saved` });
        }
        const db = getDb();
        const property = db.prepare('SELECT id FROM properties WHERE id = ?').get(req.params.id);
        if (!property) return res.status(404).json({ error: 'Property not found' });

        const existingCount = db.prepare('SELECT COUNT(*) as count FROM property_images WHERE property_id = ?').get(req.params.id).count;
        const hasCover = db.prepare('SELECT COUNT(*) as count FROM property_images WHERE property_id = ? AND is_cover = 1').get(req.params.id).count > 0;

        const stmt = db.prepare(`
            INSERT INTO property_images (property_id, image_url, original_name, is_cover, display_order)
            VALUES (?, ?, ?, ?, ?)
        `);

        const images = [];
        let orderOffset = 0;

        if (hasFiles) {
            req.files.forEach((file) => {
                const imageUrl = `/uploads/properties/${file.filename}`;
                const isCover = (!hasCover && images.length === 0) ? 1 : 0;
                const order = existingCount + (orderOffset++);
                const result = stmt.run(req.params.id, imageUrl, file.originalname, isCover, order);
                images.push({ id: result.lastInsertRowid, image_url: imageUrl, is_cover: isCover, display_order: order });
            });
        }

        if (hasUrls) {
            urlList.forEach((rawUrl) => {
                const isCover = (!hasCover && images.length === 0) ? 1 : 0;
                const order = existingCount + (orderOffset++);
                const result = stmt.run(req.params.id, rawUrl, 'Image URL', isCover, order);
                images.push({ id: result.lastInsertRowid, image_url: rawUrl, is_cover: isCover, display_order: order });
            });
        }

        auditLog(db, req.session.userId, req.session.userName, 'upload_images', 'property', req.params.id, `Added ${images.length} image(s)`, req.ip);

        res.json({ images, message: `${images.length} image(s) added successfully` });
    } catch (err) {
        console.error('Upload images error:', err);
        res.status(500).json({ error: 'Failed to upload images' });
    }
});

// PUT /api/properties/:id/images/:imageId/cover — Set cover image
router.patch('/:id/images/:imageId/cover', requireAuth, async (req, res) => {
    if (process.env.VERCEL) {
        const result = await setCloudPropertyCoverImage(req.params.id, req.params.imageId);
        if (!result.success) return res.status(502).json({ error: result.error || 'Could not set cover image.' });
        return res.json({ message: 'Cover image updated' });
    }
    const db = getDb();
    db.prepare('UPDATE property_images SET is_cover = 0 WHERE property_id = ?').run(req.params.id);
    db.prepare('UPDATE property_images SET is_cover = 1 WHERE id = ? AND property_id = ?').run(req.params.imageId, req.params.id);
    res.json({ message: 'Cover image updated' });
});

// DELETE /api/properties/:id/images/:imageId — Delete image
router.delete('/:id/images/:imageId', requireAuth, async (req, res) => {
    if (process.env.VERCEL) {
        const result = await deleteCloudPropertyImage(req.params.id, req.params.imageId);
        if (!result.success) return res.status(502).json({ error: result.error || 'Could not delete property image.' });
        return res.json({ message: 'Image deleted' });
    }
    const db = getDb();
    const image = db.prepare('SELECT * FROM property_images WHERE id = ? AND property_id = ?').get(req.params.imageId, req.params.id);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    // Delete file from disk if local upload
    if (image.image_url && typeof image.image_url === 'string' && !image.image_url.startsWith('http://') && !image.image_url.startsWith('https://')) {
        const filePath = path.join(__dirname, '..', '..', 'public', image.image_url.replace(/^\//, ''));
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            console.warn('Could not unlink local file:', filePath, e.message);
        }
    }

    db.prepare('DELETE FROM property_images WHERE id = ?').run(req.params.imageId);

    // If deleted image was cover, make the first remaining image the cover
    if (image.is_cover) {
        const first = db.prepare('SELECT id FROM property_images WHERE property_id = ? ORDER BY display_order LIMIT 1').get(req.params.id);
        if (first) {
            db.prepare('UPDATE property_images SET is_cover = 1 WHERE id = ?').run(first.id);
        }
    }

    res.json({ message: 'Image deleted' });
});

// PUT /api/properties/:id/images/reorder — Reorder images
router.put('/:id/images/reorder', requireAuth, (req, res) => {
    const db = getDb();
    const { order } = req.body; // Array of image IDs in new order
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order data' });

    const stmt = db.prepare('UPDATE property_images SET display_order = ? WHERE id = ? AND property_id = ?');
    order.forEach((imageId, index) => {
        stmt.run(index, imageId, req.params.id);
    });

    res.json({ message: 'Images reordered' });
});

// PATCH /api/properties/:id/publish — Publish
router.patch('/:id/publish', requireAuth, async (req, res) => {
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).json({ error: 'Production properties database is not configured.' });
        const result = await setCloudPropertyStatus(req.params.id, 'publish');
        if (!result.success) return res.status(502).json({ error: result.error || 'Failed to update property status.' });
        return res.json({ message: 'Property published successfully' });
    }
    const db = getDb();
    db.prepare("UPDATE properties SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    auditLog(db, req.session.userId, req.session.userName, 'publish', 'property', req.params.id, null, req.ip);
    res.json({ message: 'Property published' });
});

// PATCH /api/properties/:id/unpublish — Unpublish
router.patch('/:id/unpublish', requireAuth, async (req, res) => {
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).json({ error: 'Production properties database is not configured.' });
        const result = await setCloudPropertyStatus(req.params.id, 'unpublish');
        if (!result.success) return res.status(502).json({ error: result.error || 'Failed to update property status.' });
        return res.json({ message: 'Property unpublished successfully' });
    }
    const db = getDb();
    db.prepare("UPDATE properties SET status = 'draft', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    auditLog(db, req.session.userId, req.session.userName, 'unpublish', 'property', req.params.id, null, req.ip);
    res.json({ message: 'Property unpublished' });
});

// PATCH /api/properties/:id/archive — Archive
router.patch('/:id/archive', requireAuth, async (req, res) => {
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).json({ error: 'Production properties database is not configured.' });
        const result = await setCloudPropertyStatus(req.params.id, 'archive');
        if (!result.success) return res.status(502).json({ error: result.error || 'Failed to update property status.' });
        return res.json({ message: 'Property archived successfully' });
    }
    const db = getDb();
    db.prepare("UPDATE properties SET status = 'archived', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    auditLog(db, req.session.userId, req.session.userName, 'archive', 'property', req.params.id, null, req.ip);
    res.json({ message: 'Property archived' });
});

// POST /api/properties/:id/duplicate — Duplicate
router.post('/:id/duplicate', requireAuth, (req, res) => {
    const db = getDb();
    const original = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
    if (!original) return res.status(404).json({ error: 'Property not found' });

    const newCode = generatePropertyCode(original.category);
    const result = db.prepare(`
        INSERT INTO properties (
            property_code, title, category, purpose, short_description, description,
            price, price_negotiable, state, city, locality, full_address, pin_code,
            map_link, latitude, longitude, plot_area, built_up_area, carpet_area,
            area_unit, bedrooms, bathrooms, balconies, floors, facing, furnishing,
            parking, plot_dimensions, road_width, land_use_category, approval_details,
            private_garden, private_pool, virtual_tour_link, brochure_url,
            amenities, status, availability, is_featured, seo_title, seo_description,
            admin_notes, created_by
        ) SELECT
            ?, title || ' (Copy)', category, purpose, short_description, description,
            price, price_negotiable, state, city, locality, full_address, pin_code,
            map_link, latitude, longitude, plot_area, built_up_area, carpet_area,
            area_unit, bedrooms, bathrooms, balconies, floors, facing, furnishing,
            parking, plot_dimensions, road_width, land_use_category, approval_details,
            private_garden, private_pool, virtual_tour_link, brochure_url,
            amenities, 'draft', availability, 0, seo_title, seo_description,
            admin_notes, ?
        FROM properties WHERE id = ?
    `).run(newCode, req.session.userId, req.params.id);

    auditLog(db, req.session.userId, req.session.userName, 'duplicate', 'property', result.lastInsertRowid, `Duplicated from ${req.params.id}`, req.ip);
    res.json({ id: result.lastInsertRowid, property_code: newCode, message: 'Property duplicated as draft' });
});

// DELETE /api/properties/:id — Delete
router.delete('/:id', requireAuth, async (req, res) => {
    if (process.env.VERCEL) {
        const result = await deleteCloudProperty(req.params.id);
        if (!result.success) return res.status(502).json({ error: result.error || 'Could not delete property.' });
        return res.json({ message: 'Property deleted' });
    }
    const db = getDb();
    const property = db.prepare('SELECT title FROM properties WHERE id = ?').get(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    // Delete associated images from disk
    const images = db.prepare('SELECT image_url FROM property_images WHERE property_id = ?').all(req.params.id);
    images.forEach(img => {
        const filePath = path.join(__dirname, '..', '..', 'public', img.image_url);
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
        }
    });

    db.prepare('DELETE FROM property_images WHERE property_id = ?').run(req.params.id);
    db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);

    auditLog(db, req.session.userId, req.session.userName, 'delete', 'property', req.params.id, `Deleted: ${property.title}`, req.ip);
    res.json({ message: 'Property deleted' });
});

module.exports = router;
