/**
 * Public Website Routes
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { cloudLeadsConfigured, listCloudProperties } = require('../database/cloud-leads');
const { enhanceProperty, enhancePropertyList } = require('../database/property-media');

// GET / — Homepage
router.get('/', async (req, res) => {
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).render('public/error', { title: 'Properties temporarily unavailable', error: 'The property database is not configured.' });
        const result = await listCloudProperties({ public: true, limit: 100, offset: 0 });
        if (!result.success) return res.status(502).render('public/error', { title: 'Properties temporarily unavailable', error: 'We could not load property listings right now.' });
        const all = enhancePropertyList(result.properties || []);
        // Sort: featured listings first, then newest published/created listings
        const sortedAll = [...all].sort((a, b) => {
            const featA = Number(a.is_featured) || 0;
            const featB = Number(b.is_featured) || 0;
            if (featB !== featA) return featB - featA;
            const dateA = new Date(a.published_at || a.created_at || 0).getTime();
            const dateB = new Date(b.published_at || b.created_at || 0).getTime();
            return dateB - dateA;
        });
        const featuredProperties = sortedAll.slice(0, 8);
        const latestProperties = sortedAll.slice(0, 8);
        const counts = new Map();
        all.forEach(p => counts.set(p.category, (counts.get(p.category) || 0) + 1));
        const categoryCounts = Array.from(counts, ([category, count]) => ({ category, count }));
        return res.render('public/home', { title: 'SV Real Estates — Verified Properties All Over Hyderabad', featuredProperties, latestProperties, categoryCounts });
    }
    const db = getDb();
    
    let featuredProperties = db.prepare(`
        SELECT p.*,
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image
        FROM properties p
        WHERE p.status = 'published'
        ORDER BY p.is_featured DESC, COALESCE(p.published_at, p.created_at) DESC
        LIMIT 8
    `).all();
    featuredProperties = enhancePropertyList(featuredProperties);

    let latestProperties = db.prepare(`
        SELECT p.*,
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image
        FROM properties p
        WHERE p.status = 'published'
        ORDER BY COALESCE(p.published_at, p.created_at) DESC
        LIMIT 8
    `).all();
    latestProperties = enhancePropertyList(latestProperties);

    const categoryCounts = db.prepare(`
        SELECT category, COUNT(*) as count
        FROM properties
        WHERE status = 'published'
        GROUP BY category
    `).all();

    res.render('public/home', {
        title: 'SV Real Estates — Verified Properties All Over Hyderabad',
        featuredProperties,
        latestProperties,
        categoryCounts
    });
});

// GET /properties — Property Listings
router.get('/properties', async (req, res) => {
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).render('public/error', { title: 'Properties temporarily unavailable', error: 'The property database is not configured.' });
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 12;
        const offset = (page - 1) * limit;
        const category = req.query.category || '';
        const purpose = req.query.purpose || '';
        const city = req.query.city || '';
        const locality = req.query.locality || '';
        const minPrice = req.query.min_price || '';
        const maxPrice = req.query.max_price || '';
        const bedrooms = req.query.bedrooms || '';
        const search = req.query.search || '';
        const sort = req.query.sort || 'newest';
        const result = await listCloudProperties({ public: true, limit, offset, category, purpose, city, locality, min_price: minPrice, max_price: maxPrice, bedrooms, search, sort });
        if (!result.success) return res.status(502).render('public/error', { title: 'Properties temporarily unavailable', error: result.error || 'We could not load property listings right now.' });
        const localitiesResult = await listCloudProperties({ public: true, limit: 100, offset: 0 });
        const localities = Array.from(new Set((localitiesResult.properties || []).map(p => p.locality).filter(Boolean))).sort().map(locality => ({ locality }));
        const properties = enhancePropertyList(result.properties || []);
        const total = Number(result.total || 0);
        const totalPages = Math.ceil(total / limit) || 1;
        return res.render('public/properties', { title: 'Properties All Over Hyderabad — SV Real Estates', properties, page, totalPages, total, filters: { category, purpose, city, locality, minPrice, maxPrice, bedrooms, search, sort }, localities });
    }
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const offset = (page - 1) * limit;
    
    const category = req.query.category || '';
    const purpose = req.query.purpose || '';
    const city = req.query.city || '';
    const locality = req.query.locality || '';
    const minPrice = req.query.min_price || '';
    const maxPrice = req.query.max_price || '';
    const bedrooms = req.query.bedrooms || '';
    const search = req.query.search || '';
    const sort = req.query.sort || 'newest';

    let where = "status = 'published'";
    const params = [];

    if (search) {
        const s = search.trim();
        const bhkMatch = s.match(/^(\d)\s*bhk$/i);
        if (bhkMatch) {
            where += ' AND bedrooms = ?';
            params.push(parseInt(bhkMatch[1]));
        } else {
            where += ' AND (title LIKE ? OR locality LIKE ? OR city LIKE ? OR description LIKE ? OR category LIKE ?)';
            params.push(`%${s}%`, `%${s}%`, `%${s}%`, `%${s}%`, `%${s}%`);
        }
    }
    if (category) {
        where += ' AND category = ?';
        params.push(category);
    }
    if (purpose) {
        where += ' AND purpose = ?';
        params.push(purpose);
    }
    if (city) {
        where += ' AND city LIKE ?';
        params.push(`%${city}%`);
    }
    if (locality) {
        where += ' AND locality LIKE ?';
        params.push(`%${locality}%`);
    }
    if (minPrice) {
        where += ' AND price >= ?';
        params.push(parseFloat(minPrice));
    }
    if (maxPrice) {
        where += ' AND price <= ?';
        params.push(parseFloat(maxPrice));
    }
    if (bedrooms) {
        if (bedrooms === '5' || bedrooms === '5+') {
            where += ' AND bedrooms >= 5';
        } else {
            where += ' AND bedrooms = ?';
            params.push(parseInt(bedrooms));
        }
    }

    let orderBy = 'published_at DESC';
    if (sort === 'price_low') orderBy = 'price ASC';
    else if (sort === 'price_high') orderBy = 'price DESC';
    else if (sort === 'oldest') orderBy = 'published_at ASC';

    const total = db.prepare(`SELECT COUNT(*) as count FROM properties WHERE ${where}`).get(...params).count;
    let properties = db.prepare(`
        SELECT p.*,
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image
        FROM properties p
        WHERE ${where}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    properties = enhancePropertyList(properties);

    const totalPages = Math.ceil(total / limit);

    // Get available localities for filter
    const localities = db.prepare(`
        SELECT DISTINCT locality FROM properties WHERE status = 'published' AND locality IS NOT NULL ORDER BY locality
    `).all();

    res.render('public/properties', {
        title: 'Properties All Over Hyderabad — SV Real Estates',
        properties,
        page,
        totalPages,
        total,
        filters: { category, purpose, city, locality, minPrice, maxPrice, bedrooms, search, sort },
        localities
    });
});

// GET /properties/:id — Property Detail
router.get('/properties/:id', async (req, res) => {
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).render('public/error', { title: 'Property temporarily unavailable', error: 'The property database is not configured.' });
        const result = await listCloudProperties({ public: true, id: req.params.id, limit: 1, offset: 0 });
        const property = result.success ? result.property : null;
        if (!property) return res.status(result.success ? 404 : 502).render('public/404', { title: 'Property Not Found' });
        enhanceProperty(property);
        const images = (property.images && property.images.length) ? property.images : [];
        let similarProperties = [];
        if (property.category) {
            const similar = await listCloudProperties({ public: true, category: property.category, limit: 8, offset: 0 });
            if (similar.success) similarProperties = enhancePropertyList((similar.properties || []).filter(p => String(p.id) !== String(property.id)).slice(0, 4));
        }
        const amenities = Array.isArray(property.amenities) ? property.amenities : (() => { try { return JSON.parse(property.amenities || '[]'); } catch { return []; } })();
        delete property.admin_notes; delete property.created_by;
        return res.render('public/property-detail', { title: `${property.title} — SV Real Estates Hyderabad`, property, images, amenities, similarProperties });
    }
    const db = getDb();
    
    // Support both numeric ID and property_code
    let property;
    if (isNaN(req.params.id)) {
        property = db.prepare("SELECT * FROM properties WHERE property_code = ? AND status = 'published'").get(req.params.id);
    } else {
        property = db.prepare("SELECT * FROM properties WHERE id = ? AND status = 'published'").get(req.params.id);
    }

    if (!property) {
        return res.status(404).render('public/404', { title: 'Property Not Found' });
    }

    enhanceProperty(property);
    let images = db.prepare('SELECT * FROM property_images WHERE property_id = ? ORDER BY display_order').all(property.id);
    if (!images || images.length === 0) images = property.images || [];
    
    let similarProperties = db.prepare(`
        SELECT p.*,
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image
        FROM properties p
        WHERE p.status = 'published' AND p.id != ? AND (p.category = ? OR p.locality = ?)
        ORDER BY p.published_at DESC
        LIMIT 4
    `).all(property.id, property.category, property.locality);
    similarProperties = enhancePropertyList(similarProperties);

    // Parse amenities JSON
    let amenities = [];
    try {
        amenities = JSON.parse(property.amenities || '[]');
    } catch (e) {
        amenities = [];
    }

    res.render('public/property-detail', {
        title: `${property.title} — SV Real Estates Hyderabad`,
        property,
        images,
        amenities,
        similarProperties
    });
});

// GET /about
router.get('/about', (req, res) => {
    res.render('public/about', {
        title: 'About Us — SV Real Estates Hyderabad'
    });
});

// GET /services
router.get('/services', (req, res) => {
    res.render('public/services', {
        title: 'Our Services — SV Real Estates Hyderabad'
    });
});

// GET /locations
router.get('/locations', async (req, res) => {
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) return res.status(503).render('public/error', { title: 'Locations temporarily unavailable', error: 'The property database is not configured.' });
        const result = await listCloudProperties({ public: true, limit: 100, offset: 0 });
        if (!result.success) return res.status(502).render('public/error', { title: 'Locations temporarily unavailable', error: 'We could not load locations right now.' });
        const grouped = new Map();
        (result.properties || []).forEach(p => { if (!p.locality) return; const key = `${p.locality}|${p.city || 'Hyderabad'}`; const old = grouped.get(key) || { locality: p.locality, city: p.city || 'Hyderabad', property_count: 0 }; old.property_count++; grouped.set(key, old); });
        const locationData = Array.from(grouped.values()).sort((a, b) => b.property_count - a.property_count);
        return res.render('public/locations', { title: 'Locations All Over Hyderabad — SV Real Estates', locationData });
    }
    const db = getDb();
    const locationData = db.prepare(`
        SELECT locality, city, COUNT(*) as property_count
        FROM properties
        WHERE status = 'published' AND locality IS NOT NULL
        GROUP BY locality, city
        ORDER BY property_count DESC
    `).all();

    res.render('public/locations', {
        title: 'Locations All Over Hyderabad — SV Real Estates',
        locationData
    });
});

// GET /contact
router.get('/contact', (req, res) => {
    res.render('public/contact', {
        title: 'Contact Us — SV Real Estates Hyderabad'
    });
});

// GET /privacy
router.get('/privacy', (req, res) => {
    res.render('public/privacy', {
        title: 'Privacy Policy — SV Real Estates Hyderabad'
    });
});

// GET /terms
router.get('/terms', (req, res) => {
    res.render('public/terms', {
        title: 'Terms of Service — SV Real Estates Hyderabad'
    });
});

module.exports = router;
