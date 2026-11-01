/**
 * Public Website Routes — SV Real Estates & Home Interiors Hyderabad
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { cloudLeadsConfigured, listCloudProperties } = require('../database/cloud-leads');
const { enhanceProperty, enhancePropertyList } = require('../database/property-media');

// Helper to get leadership profiles safely
function getLeadershipProfiles(db) {
    try {
        const rows = db.prepare(`
            SELECT * FROM leadership_profiles 
            WHERE is_active = 1 
            ORDER BY display_order ASC, id ASC
        `).all();
        if (rows && rows.length > 0) return rows;
    } catch (e) {}
    // Fallback if table empty
    return [
        {
            id: 1,
            name: 'B. Bhuvan Raju',
            designation: 'Founder',
            role_type: 'founder',
            bio: 'Visionary founder guiding SV Real Estates with over two decades of land acquisition, development excellence, and trusted property leadership across Hyderabad.',
            experience_years: 20,
            show_on_home: 1,
            show_on_about: 1
        },
        {
            id: 2,
            name: 'D. Manikanta',
            designation: 'Managing Director',
            role_type: 'managing_director',
            bio: 'Leading executive operations, client advisory, luxury acquisitions, and project delivery with end-to-end transparency and verified compliance.',
            experience_years: 15,
            show_on_home: 1,
            show_on_about: 1
        }
    ];
}

// Helper to get interior services safely
function getInteriorServices(db) {
    try {
        const rows = db.prepare(`
            SELECT * FROM interior_services 
            WHERE is_active = 1 
            ORDER BY display_order ASC, id ASC
        `).all();
        if (rows && rows.length > 0) return rows;
    } catch (e) {}
    return [];
}

// Helper to get interior projects safely
function getInteriorProjects(db, options = {}) {
    try {
        let sql = "SELECT * FROM interior_projects WHERE is_published = 1";
        if (options.featuredOnly) sql += " AND is_featured = 1";
        sql += " ORDER BY is_featured DESC, COALESCE(published_at, created_at) DESC";
        if (options.limit) sql += ` LIMIT ${parseInt(options.limit, 10)}`;
        return db.prepare(sql).all();
    } catch (e) {
        return [];
    }
}

// GET / — Homepage
router.get('/', async (req, res) => {
    const db = getDb();
    const interiorProjects = getInteriorProjects(db, { limit: 4 });
    const leadershipProfiles = getLeadershipProfiles(db);

    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) {
            return res.status(503).render('public/error', {
                title: 'Properties temporarily unavailable',
                error: 'The property database is not configured.'
            });
        }
        const result = await listCloudProperties({ public: true, limit: 100, offset: 0 });
        if (!result.success) {
            return res.status(502).render('public/error', {
                title: 'Properties temporarily unavailable',
                error: 'We could not load property listings right now.'
            });
        }
        const all = enhancePropertyList(result.properties || []);
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

        return res.render('public/home', {
            title: 'SV Real Estates — Verified Luxury Properties & Home Interiors Hyderabad',
            featuredProperties,
            latestProperties,
            categoryCounts,
            interiorProjects,
            leadershipProfiles
        });
    }

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
        title: 'SV Real Estates — Verified Luxury Properties & Home Interiors Hyderabad',
        featuredProperties,
        latestProperties,
        categoryCounts,
        interiorProjects,
        leadershipProfiles
    });
});

// GET /properties — Property Listings
router.get('/properties', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const offset = (page - 1) * limit;

    const { category, purpose, city, locality, min_price, max_price, bedrooms, search, sort } = req.query;

    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) {
            return res.status(503).render('public/error', {
                title: 'Properties temporarily unavailable',
                error: 'The property database is not configured.'
            });
        }
        const result = await listCloudProperties({
            public: true,
            category,
            purpose,
            city,
            locality,
            min_price,
            max_price,
            bedrooms,
            search,
            sort,
            limit,
            offset
        });
        if (!result.success) {
            return res.status(502).render('public/error', {
                title: 'Properties temporarily unavailable',
                error: 'We could not load property listings right now.'
            });
        }
        const total = result.total || 0;
        const totalPages = Math.ceil(total / limit) || 1;
        const properties = enhancePropertyList(result.properties || []);
        const localities = (result.localities || []).map(row => row.locality || row.locality_name || row).filter(Boolean);

        return res.render('public/properties', {
            title: 'Verified Properties All Over Hyderabad — SV Real Estates',
            properties,
            total,
            page,
            totalPages,
            filters: { category, purpose, city, locality, min_price, max_price, bedrooms, search, sort },
            localities
        });
    }

    const db = getDb();
    let where = "p.status = 'published'";
    const params = [];

    if (category) {
        where += ' AND p.category = ?';
        params.push(category);
    }
    if (purpose) {
        where += ' AND p.purpose = ?';
        params.push(purpose);
    }
    if (city) {
        where += ' AND p.city = ?';
        params.push(city);
    }
    if (locality) {
        where += ' AND (p.locality LIKE ? OR p.full_address LIKE ?)';
        params.push(`%${locality}%`, `%${locality}%`);
    }
    if (min_price) {
        where += ' AND p.price >= ?';
        params.push(parseFloat(min_price));
    }
    if (max_price) {
        where += ' AND p.price <= ?';
        params.push(parseFloat(max_price));
    }
    if (bedrooms) {
        const b = parseInt(bedrooms);
        if (b >= 5) {
            where += ' AND p.bedrooms >= 5';
        } else {
            where += ' AND p.bedrooms = ?';
            params.push(b);
        }
    }
    if (search) {
        where += ' AND (p.title LIKE ? OR p.description LIKE ? OR p.locality LIKE ? OR p.property_code LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    let orderBy = 'p.is_featured DESC, COALESCE(p.published_at, p.created_at) DESC';
    if (sort === 'price_asc') orderBy = 'p.price ASC NULLS LAST';
    if (sort === 'price_desc') orderBy = 'p.price DESC NULLS LAST';
    if (sort === 'newest') orderBy = 'COALESCE(p.published_at, p.created_at) DESC';
    if (sort === 'featured') orderBy = 'p.is_featured DESC, p.id DESC';

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM properties p WHERE ${where}`).get(...params);
    const total = countRow ? countRow.count : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    let properties = db.prepare(`
        SELECT p.*,
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image,
            (SELECT COUNT(*) FROM property_images WHERE property_id = p.id) as image_count
        FROM properties p
        WHERE ${where}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    properties = enhancePropertyList(properties);

    const localities = db.prepare(`
        SELECT DISTINCT locality FROM properties
        WHERE status = 'published' AND locality IS NOT NULL
        ORDER BY locality
    `).all().map(r => r.locality);

    res.render('public/properties', {
        title: 'Verified Properties All Over Hyderabad — SV Real Estates',
        properties,
        total,
        page,
        totalPages,
        filters: { category, purpose, city, locality, min_price, max_price, bedrooms, search, sort },
        localities
    });
});

// GET /properties/:id — Property Detail Page
router.get('/properties/:id', async (req, res) => {
    const isNumeric = /^\d+$/.test(req.params.id);

    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) {
            return res.status(503).render('public/error', {
                title: 'Property temporarily unavailable',
                error: 'The property database is not configured.'
            });
        }
        const result = await listCloudProperties({ id: req.params.id, public: true });
        if (!result.success || !result.property) {
            return res.status(404).render('public/404', { title: 'Property Not Found' });
        }
        const property = enhanceProperty(result.property);
        delete property.admin_notes;
        delete property.created_by;
        const images = property.images && property.images.length > 0
            ? property.images
            : (property.cover_image ? [{ id: 1, image_url: property.cover_image, is_cover: 1 }] : []);
        const similarResult = await listCloudProperties({
            public: true,
            category: property.category,
            limit: 3
        });
        const similarProperties = enhancePropertyList((similarResult.properties || []).filter(p => p.id !== property.id).slice(0, 3));
        return res.render('public/property-detail', {
            title: `${property.title} — SV Real Estates Hyderabad`,
            property,
            images,
            similarProperties
        });
    }

    const db = getDb();
    const where = isNumeric
        ? "p.id = ? AND p.status = 'published'"
        : "p.property_code = ? AND p.status = 'published'";

    const rawProperty = db.prepare(`SELECT p.* FROM properties p WHERE ${where}`).get(req.params.id);

    if (!rawProperty) {
        return res.status(404).render('public/404', {
            title: 'Property Not Found — SV Real Estates'
        });
    }
    const property = enhanceProperty(rawProperty);
    // Sanitize internal fields from public SSR
    delete property.admin_notes;
    delete property.created_by;

    const images = db.prepare(`
        SELECT * FROM property_images
        WHERE property_id = ?
        ORDER BY is_cover DESC, display_order ASC, id ASC
    `).all(property.id);

    let similarProperties = db.prepare(`
        SELECT p.*,
            (SELECT image_url FROM property_images WHERE property_id = p.id AND is_cover = 1 LIMIT 1) as cover_image
        FROM properties p
        WHERE p.category = ? AND p.id != ? AND p.status = 'published'
        ORDER BY p.is_featured DESC, p.id DESC
        LIMIT 3
    `).all(property.category, property.id);
    similarProperties = enhancePropertyList(similarProperties);

    res.render('public/property-detail', {
        title: `${property.title} — SV Real Estates Hyderabad`,
        property,
        images,
        similarProperties
    });
});

// ==============================================================
// HOME INTERIORS ROUTES
// ==============================================================

// GET /interiors — Home Interiors Landing Page
router.get('/interiors', (req, res) => {
    const db = getDb();
    const services = getInteriorServices(db);
    const projects = getInteriorProjects(db, { limit: 6 });

    res.render('public/interiors', {
        title: 'Home Interiors Hyderabad — SV Real Estates & Bespoke Interiors',
        services,
        projects
    });
});

// GET /interiors/services — Detailed 12 Services Catalog
router.get('/interiors/services', (req, res) => {
    const db = getDb();
    const services = getInteriorServices(db);

    res.render('public/interiors-services', {
        title: 'Interior Design Services Hyderabad — SV Home Interiors',
        services
    });
});

// GET /interiors/projects — Complete Projects Portfolio
router.get('/interiors/projects', (req, res) => {
    const db = getDb();
    const projects = getInteriorProjects(db);

    res.render('public/interiors-projects', {
        title: 'Interior Projects Portfolio — SV Home Interiors Hyderabad',
        projects
    });
});

// GET /interiors/projects/:id — Project Detail View
router.get('/interiors/projects/:id', (req, res) => {
    const db = getDb();
    const id = req.params.id;
    const isNum = /^\d+$/.test(id);

    let project = null;
    try {
        if (isNum) {
            project = db.prepare("SELECT * FROM interior_projects WHERE id = ? AND is_published = 1").get(parseInt(id, 10));
        } else {
            project = db.prepare("SELECT * FROM interior_projects WHERE slug = ? AND is_published = 1").get(id);
        }
    } catch (e) {}

    if (!project) {
        return res.status(404).render('public/404', {
            title: 'Interior Project Not Found — SV Home Interiors'
        });
    }

    let images = [];
    try {
        images = db.prepare("SELECT * FROM interior_project_images WHERE project_id = ? ORDER BY display_order ASC, id ASC").all(project.id);
    } catch (e) {}

    if (images.length === 0 && project.cover_image) {
        images = [{ id: 1, image_url: project.cover_image, title: project.title }];
    }

    const beforeImage = (images.find(img => img.image_type === 'before') || {}).image_url || null;
    const afterImage = (images.find(img => img.image_type === 'after') || {}).image_url || null;

    res.render('public/interiors-project-detail', {
        title: `${project.title} — SV Home Interiors Hyderabad`,
        project,
        images,
        beforeImage,
        afterImage
    });
});

// GET /interiors/contact — Dedicated Interior Consultation Page
router.get('/interiors/contact', (req, res) => {
    res.render('public/interiors-contact', {
        title: 'Book Interior Design Consultation — SV Home Interiors Hyderabad'
    });
});

// ==============================================================
// COMPANY PAGES
// ==============================================================

// GET /about — About Us & Dynamic Leadership Profiles
router.get('/about', (req, res) => {
    const db = getDb();
    const leadership = getLeadershipProfiles(db).filter(p => p.show_on_about);

    res.render('public/about', {
        title: 'About Us — SV Real Estates & Home Interiors Hyderabad',
        leadership
    });
});

// GET /services — Real Estate & Construction Materials Services
router.get('/services', (req, res) => {
    res.render('public/services', {
        title: 'Our Services — SV Real Estates & Building Materials Hyderabad'
    });
});

// GET /locations — Locations Across Hyderabad
router.get('/locations', async (req, res) => {
    if (process.env.VERCEL) {
        if (!cloudLeadsConfigured()) {
            return res.status(503).render('public/error', {
                title: 'Locations temporarily unavailable',
                error: 'The property database is not configured.'
            });
        }
        const result = await listCloudProperties({ public: true, limit: 100, offset: 0 });
        if (!result.success) {
            return res.status(502).render('public/error', {
                title: 'Locations temporarily unavailable',
                error: 'We could not load locations right now.'
            });
        }
        const grouped = new Map();
        (result.properties || []).forEach(p => {
            if (!p.locality) return;
            const key = `${p.locality}|${p.city || 'Hyderabad'}`;
            const old = grouped.get(key) || { locality: p.locality, city: p.city || 'Hyderabad', property_count: 0 };
            old.property_count++;
            grouped.set(key, old);
        });
        const locationData = Array.from(grouped.values()).sort((a, b) => b.property_count - a.property_count);
        return res.render('public/locations', {
            title: 'Locations All Over Hyderabad — SV Real Estates',
            locationData
        });
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

// GET /contact — General Contact Page
router.get('/contact', (req, res) => {
    res.render('public/contact', {
        title: 'Contact Us — SV Real Estates Hyderabad'
    });
});

// GET /privacy — Privacy Policy
router.get('/privacy', (req, res) => {
    res.render('public/privacy', {
        title: 'Privacy Policy — SV Real Estates Hyderabad'
    });
});

// GET /terms — Terms of Service
router.get('/terms', (req, res) => {
    res.render('public/terms', {
        title: 'Terms of Service — SV Real Estates Hyderabad'
    });
});

// GET /sitemap.xml — SEO XML Sitemap
router.get('/sitemap.xml', (req, res) => {
    res.header('Content-Type', 'application/xml');
    const baseUrl = 'https://sv-realestatehyd.vercel.app';
    const pages = [
        '',
        '/properties',
        '/interiors',
        '/interiors/services',
        '/interiors/projects',
        '/interiors/contact',
        '/about',
        '/services',
        '/locations',
        '/contact',
        '/privacy',
        '/terms'
    ];
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    pages.forEach(p => {
        xml += `  <url>\n    <loc>${baseUrl}${p}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${p === '' ? '1.0' : '0.8'}</priority>\n  </url>\n`;
    });
    xml += '</urlset>';
    res.send(xml);
});

// GET /robots.txt — Robots definition
router.get('/robots.txt', (req, res) => {
    res.header('Content-Type', 'text/plain');
    res.send(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: https://sv-realestatehyd.vercel.app/sitemap.xml\n`);
});

module.exports = router;
