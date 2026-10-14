/**
 * Public Website Routes
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// GET / — Homepage
router.get('/', (req, res) => {
    const db = getDb();
    
    const featuredProperties = db.prepare(`
        SELECT p.*,
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image
        FROM properties p
        WHERE p.status = 'published' AND p.is_featured = 1
        ORDER BY p.published_at DESC
        LIMIT 6
    `).all();

    const latestProperties = db.prepare(`
        SELECT p.*,
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image
        FROM properties p
        WHERE p.status = 'published'
        ORDER BY p.published_at DESC
        LIMIT 8
    `).all();

    const categoryCounts = db.prepare(`
        SELECT category, COUNT(*) as count
        FROM properties
        WHERE status = 'published'
        GROUP BY category
    `).all();

    res.render('public/home', {
        title: 'SV Real Estates Hyderabad — Premium Properties in Hyderabad',
        featuredProperties,
        latestProperties,
        categoryCounts
    });
});

// GET /properties — Property Listings
router.get('/properties', (req, res) => {
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
        where += ' AND (title LIKE ? OR locality LIKE ? OR city LIKE ? OR description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
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
        where += ' AND bedrooms >= ?';
        params.push(parseInt(bedrooms));
    }

    let orderBy = 'published_at DESC';
    if (sort === 'price_low') orderBy = 'price ASC';
    else if (sort === 'price_high') orderBy = 'price DESC';
    else if (sort === 'oldest') orderBy = 'published_at ASC';

    const total = db.prepare(`SELECT COUNT(*) as count FROM properties WHERE ${where}`).get(...params).count;
    const properties = db.prepare(`
        SELECT p.*,
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image
        FROM properties p
        WHERE ${where}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const totalPages = Math.ceil(total / limit);

    // Get available localities for filter
    const localities = db.prepare(`
        SELECT DISTINCT locality FROM properties WHERE status = 'published' AND locality IS NOT NULL ORDER BY locality
    `).all();

    res.render('public/properties', {
        title: 'Properties — SV Real Estates Hyderabad',
        properties,
        page,
        totalPages,
        total,
        filters: { category, purpose, city, locality, minPrice, maxPrice, bedrooms, search, sort },
        localities
    });
});

// GET /properties/:id — Property Detail
router.get('/properties/:id', (req, res) => {
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

    const images = db.prepare('SELECT * FROM property_images WHERE property_id = ? ORDER BY display_order').all(property.id);
    
    const similarProperties = db.prepare(`
        SELECT p.*,
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image
        FROM properties p
        WHERE p.status = 'published' AND p.id != ? AND (p.category = ? OR p.locality = ?)
        ORDER BY p.published_at DESC
        LIMIT 4
    `).all(property.id, property.category, property.locality);

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
router.get('/locations', (req, res) => {
    const db = getDb();
    const locationData = db.prepare(`
        SELECT locality, city, COUNT(*) as property_count
        FROM properties
        WHERE status = 'published' AND locality IS NOT NULL
        GROUP BY locality, city
        ORDER BY property_count DESC
    `).all();

    res.render('public/locations', {
        title: 'Locations — SV Real Estates Hyderabad',
        locationData
    });
});

// GET /contact
router.get('/contact', (req, res) => {
    res.render('public/contact', {
        title: 'Contact Us — SV Real Estates Hyderabad'
    });
});

module.exports = router;
