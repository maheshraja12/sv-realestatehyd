/**
 * Comprehensive Seed script — SV Real Estates Hyderabad
 * Real-world catalog covering Villas, Plots, 2BHK, 3BHK, 4BHK and Commercial spaces across Hyderabad.
 * In every area, budget starts at ₹70 Lakhs minimum. All prices strictly reflect realistic Hyderabad market rates.
 * Contact Email: svsrivenkateswara99@gmail.com
 * Run: npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initializeDb, getDb, closeDb } = require('./db');

function seed(existingDb, force = false) {
    try {
        let db = existingDb;
        if (!db) {
            console.log('🔄 Initializing database schema...');
            initializeDb();
            db = getDb();
        }

        const email = process.env.ADMIN_EMAIL || 'admin@svrealestate.com';
        const password = process.env.ADMIN_PASSWORD || 'Admin@SV2024';
        const name = process.env.ADMIN_NAME || 'SV Admin';

        // 1. Admin User
        let adminUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (!adminUser) {
            const hash = bcrypt.hashSync(password, 10);
            const res = db.prepare(`
                INSERT INTO users (name, email, password_hash, role, is_active)
                VALUES (?, ?, ?, 'admin', 1)
            `).run(name, email, hash);
            adminUser = { id: res.lastInsertRowid };
            console.log(`✅ Admin user created: ${email}`);
        } else {
            console.log(`ℹ️ Admin user verified: ${email}`);
        }

        // 2. Senior Agent User
        let agentUser = db.prepare('SELECT id FROM users WHERE email = ?').get('agent@svrealestate.com');
        if (!agentUser) {
            const hash = bcrypt.hashSync('Agent@SV2024', 10);
            const res = db.prepare(`
                INSERT INTO users (name, email, password_hash, role, is_active)
                VALUES (?, ?, ?, 'agent', 1)
            `).run('Kalyan Varma', 'agent@svrealestate.com', hash);
            agentUser = { id: res.lastInsertRowid };
            console.log(`✅ Agent user created: agent@svrealestate.com`);
        }

        // 3. Properties Catalog
        const propCount = db.prepare('SELECT COUNT(*) as count FROM properties').get().count;
        if (propCount === 0 || force) {
            console.log('🌱 Seeding realistic Hyderabad properties catalog (Min Budget ₹70 Lakhs in every area)...');

            if (force && propCount > 0) {
                console.log('🧹 Clearing old properties catalog for clean re-seed...');
                db.prepare('DELETE FROM property_images').run();
                db.prepare('DELETE FROM properties').run();
            }

            const propertiesList = [
                // ── BACHUPALLY ──────────────────────────────────────────────
                {
                    property_code: 'SV-APT-BCP-001',
                    title: 'Serene Oaks 2BHK Smart Home in Bachupally',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: 'Vaastu-compliant 1,210 Sq.Ft 2BHK flat near Silver Oaks and Oakridge International School.',
                    description: `Experience affordable premium living in Bachupally, Hyderabad's prime education and residential corridor.

Features 2 spacious bedrooms, 2 designer bathrooms, modular electrical fittings, granite kitchen counter, and dedicated covered car parking.

Located inside a secure gated enclave with 24/7 security, automatic elevators, children's play area, and 100% DG power backup. Approved by GHMC and leading banks.`,
                    price: 7000000, // ₹70 Lakhs (Exact baseline)
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Bachupally',
                    full_address: 'Near Silver Oaks School, Mallampet Road, Bachupally, Hyderabad',
                    pin_code: '500090',
                    built_up_area: 1210,
                    carpet_area: 980,
                    area_unit: 'sq_ft',
                    bedrooms: 2,
                    bathrooms: 2,
                    balconies: 1,
                    floors: 10,
                    facing: 'East',
                    furnishing: 'unfurnished',
                    parking: '1 Covered Car Park',
                    amenities: JSON.stringify(['Lift', 'Power Backup', 'Children Play Area', '24/7 Security', 'CCTV', 'Visitor Parking', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── KOMPALLY ────────────────────────────────────────────────
                {
                    property_code: 'SV-APT-KMP-001',
                    title: 'Pine Crest 2BHK Garden Apartment in Kompally',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: 'Peaceful 1,220 Sq.Ft 2BHK flat in lush green gated community with clubhouse and swimming pool.',
                    description: `Escape city chaos with refined serenity in Kompally on the North Hyderabad growth corridor.

Features East-facing 2BHK with scenic garden balconies, vitrified flooring, piped gas pipeline, and dedicated EV charging station.

Walking distance to Cine Planet, D-Mart, and St. Ann's High School. Excellent connectivity to Secunderabad via NH 44.`,
                    price: 7000000, // ₹70 Lakhs (Exact baseline)
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Kompally',
                    full_address: 'NH 44 Highway Junction, Behind Cine Planet, Kompally, Hyderabad',
                    pin_code: '500100',
                    built_up_area: 1220,
                    carpet_area: 990,
                    area_unit: 'sq_ft',
                    bedrooms: 2,
                    bathrooms: 2,
                    balconies: 1,
                    floors: 8,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '1 Reserved Car Park',
                    amenities: JSON.stringify(['Swimming Pool', 'Clubhouse', 'Gym', 'Jogging Track', 'Power Backup', '24/7 Security', 'Intercom']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 0,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-PLT-KMP-001',
                    title: 'Greenwood HMDA Approved Plotted Township in Kompally',
                    category: 'residential_plot',
                    purpose: 'sale',
                    short_description: '250 Sq.Yd clear title HMDA open plot with underground drainage, 40ft blacktop roads, and electricity.',
                    description: `Premium plotted investment opportunity in an exclusive 25-acre gated layout in Kompally.

Approved by HMDA with RERA registration. Fully compounding perimeter with grand entrance arch, avenue plantation, underground electrical cabling, and overhead water storage.

Perfect for building a custom generational villa or ensuring steady land value appreciation.`,
                    price: 7500000, // ₹75 Lakhs (~₹30,000/sq.yd)
                    price_negotiable: 0,
                    city: 'Hyderabad',
                    locality: 'Kompally',
                    full_address: 'Survey No. 84, Medchal-Kompally Corridor, Kompally, Hyderabad',
                    pin_code: '500100',
                    plot_area: 250,
                    area_unit: 'sq_yd',
                    plot_dimensions: '30 x 75 ft',
                    road_width: '40 ft BT Road',
                    facing: 'East',
                    land_use_category: 'Residential R1 Zone',
                    approval_details: 'HMDA Layout LP No. 000214/LO/HMDA/2023',
                    amenities: JSON.stringify(['Gated Community', 'Park', 'Children Play Area', 'Water Supply', 'Rain Water Harvesting', 'Vastu Compliant', '24/7 Security']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-APT-KMP-002',
                    title: 'Royal Palms 3BHK Gated Apartment in Kompally',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: 'Spacious 1,750 Sq.Ft 3BHK flat on 6th floor with double balconies and clubhouse membership.',
                    description: `Luxurious 3-bedroom residence engineered for modern families. 

Features expansive living-dining space, 3 ensuite bathrooms, utility balcony, vitrified flooring, and 2 designated covered car parking bays.`,
                    price: 11000000, // ₹1.10 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Kompally',
                    full_address: 'Kompally Main Bypass, Opp. Cine Planet, Kompally, Hyderabad',
                    pin_code: '500100',
                    built_up_area: 1750,
                    carpet_area: 1420,
                    area_unit: 'sq_ft',
                    bedrooms: 3,
                    bathrooms: 3,
                    balconies: 2,
                    floors: 10,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '2 Covered Car Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Badminton Court', '24/7 Security', 'Power Backup', 'Lift']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 0,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-VIL-KMP-001',
                    title: 'Palm County 3BHK Gated Community Villa in Kompally',
                    category: 'villa',
                    purpose: 'sale',
                    short_description: '2,900 Sq.Ft independent duplex villa on 220 Sq.Yd plot with private garden in Kompally.',
                    description: `Elegantly designed independent 3BHK duplex villa inside a tranquil 15-acre gated community.

Boasts private manicured front lawn, modular European kitchen, high ceiling living room, rooftop terrace lounge, and 2-car covered porch. Complete Vaastu compliance.`,
                    price: 23500000, // ₹2.35 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Kompally',
                    full_address: 'Palm County Enclave, Suchitra-Kompally Road, Hyderabad',
                    pin_code: '500100',
                    built_up_area: 2900,
                    plot_area: 220,
                    carpet_area: 2450,
                    area_unit: 'sq_yd',
                    bedrooms: 3,
                    bathrooms: 4,
                    balconies: 2,
                    floors: 2,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '2 Covered Car Parks',
                    private_garden: 1,
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Park', 'Children Play Area', 'Solar Panels', '24/7 Security', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── SHAMSHABAD ──────────────────────────────────────────────
                {
                    property_code: 'SV-APT-SHM-001',
                    title: 'Airport City 2BHK Gated Flat near RGIA Shamshabad',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: '1,200 Sq.Ft 2BHK apartment 10 mins from Rajiv Gandhi International Airport with rental yield potential.',
                    description: `Prime residential investment in Hyderabad's aerotropolis growth hub.

Features 2 bedrooms, 2 bathrooms, modern granite kitchen, and spacious hall. Close to aviation campuses, hardware parks, and ORR Exit 16.`,
                    price: 7000000, // ₹70 Lakhs (Exact baseline)
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Shamshabad',
                    full_address: 'Airport Approach Road, Near Decathlon, Shamshabad, Hyderabad',
                    pin_code: '501218',
                    built_up_area: 1200,
                    carpet_area: 970,
                    area_unit: 'sq_ft',
                    bedrooms: 2,
                    bathrooms: 2,
                    balconies: 1,
                    floors: 7,
                    facing: 'East',
                    furnishing: 'unfurnished',
                    parking: '1 Covered Car Park',
                    amenities: JSON.stringify(['Lift', 'Power Backup', '24/7 Security', 'CCTV', 'Visitor Parking', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 0,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-PLT-SHM-001',
                    title: 'Aeroville HMDA Approved Plotted Layout in Shamshabad',
                    category: 'residential_plot',
                    purpose: 'sale',
                    short_description: '250 Sq.Yd clear title HMDA plot in high-growth aerospace & pharma corridor near Bangalore Highway.',
                    description: `Outstanding capital growth parcel situated in Shamshabad near Rallaguda and ORR.

HMDA layout with 50ft & 40ft wide blacktop roads, underground drainage, overhead water tank, children's park, and full perimeter security wall with arch gate.`,
                    price: 8800000, // ₹88 Lakhs (~₹35,200/sq.yd)
                    price_negotiable: 0,
                    city: 'Hyderabad',
                    locality: 'Shamshabad',
                    full_address: 'Bangalore Highway NH 44, Near ORR Junction, Shamshabad, Hyderabad',
                    pin_code: '501218',
                    plot_area: 250,
                    area_unit: 'sq_yd',
                    plot_dimensions: '30 x 75 ft',
                    road_width: '40 ft',
                    facing: 'East',
                    land_use_category: 'Residential',
                    approval_details: 'HMDA Approved Layout LP No. 000189/2023',
                    amenities: JSON.stringify(['Gated Community', 'Park', 'Water Supply', 'Rain Water Harvesting', 'Vastu Compliant', '24/7 Security']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-VIL-SHM-001',
                    title: 'Skyline Aerovillas 3BHK Luxury Gated Villa in Shamshabad',
                    category: 'villa',
                    purpose: 'sale',
                    short_description: '2,950 Sq.Ft 3BHK triplex villa on 240 Sq.Yd with clubhouse, swimming pool, and private lawn.',
                    description: `Experience resort-style serenity near the international airport corridor.

Features 3 grand bedrooms with ensuite baths, open living spaces, landscaped terrace garden, and high-speed fiber connectivity. Direct access to PVNR Elevated Expressway and ORR.`,
                    price: 26000000, // ₹2.60 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Shamshabad',
                    full_address: 'Skyline Aerovillas, Near Novotel Airport, Shamshabad, Hyderabad',
                    pin_code: '501218',
                    built_up_area: 2950,
                    plot_area: 240,
                    carpet_area: 2500,
                    area_unit: 'sq_yd',
                    bedrooms: 3,
                    bathrooms: 4,
                    balconies: 2,
                    floors: 2,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '2 Covered Car Parks',
                    private_garden: 1,
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Tennis Court', '24/7 Security', 'Power Backup', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── MIYAPUR ─────────────────────────────────────────────────
                {
                    property_code: 'SV-APT-MYP-001',
                    title: 'Metro Vista 2BHK Modern Flat in Miyapur',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: '1,225 Sq.Ft 2BHK flat 5 minutes from Miyapur Metro Terminal with premium tile work and balcony.',
                    description: `Superb connectivity and prime urban living in Miyapur. 

Located 5 minutes from the Red Line Metro Depot, this 2BHK flat features modern architectural styling, high-grade UPVC soundproof windows, branded sanitary fittings, and lift backup.`,
                    price: 7400000, // ₹74 Lakhs
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Miyapur',
                    full_address: 'Near Miyapur Metro Station, Allwyn X Roads, Miyapur, Hyderabad',
                    pin_code: '500049',
                    built_up_area: 1225,
                    carpet_area: 990,
                    area_unit: 'sq_ft',
                    bedrooms: 2,
                    bathrooms: 2,
                    balconies: 1,
                    floors: 9,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '1 Covered Car Park',
                    amenities: JSON.stringify(['Lift', 'Power Backup', '24/7 Security', 'CCTV', 'Visitor Parking', 'Intercom', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 0,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-APT-MYP-002',
                    title: 'Metro Grandeur 3BHK Gated High-Rise Flat in Miyapur',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: '1,690 Sq.Ft 3BHK luxury gated apartment with 100% power backup and world-class clubhouse.',
                    description: `Spacious, sun-drenched 3BHK flat on the 8th floor of a premier gated high-rise community in Miyapur.

Includes 3 bedrooms, 3 bathrooms, spacious sit-out balcony, modular kitchen provision, covered basement car parking for 2 cars, and access to a 20,000 sq.ft clubhouse.`,
                    price: 11800000, // ₹1.18 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Miyapur',
                    full_address: 'Mayuri Nagar, Near GSM Mall, Miyapur, Hyderabad',
                    pin_code: '500049',
                    built_up_area: 1690,
                    carpet_area: 1380,
                    area_unit: 'sq_ft',
                    bedrooms: 3,
                    bathrooms: 3,
                    balconies: 2,
                    floors: 12,
                    facing: 'West',
                    furnishing: 'semi_furnished',
                    parking: '2 Covered Car Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Children Play Area', 'Power Backup', '24/7 Security', 'Lift']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── SHANKARPALLY ────────────────────────────────────────────
                {
                    property_code: 'SV-PLT-SHP-001',
                    title: 'Premium DTCP Highway Facing Plot in Shankarpally',
                    category: 'residential_plot',
                    purpose: 'sale',
                    short_description: '250 Sq.Yd clear title plot with immediate construction permissions near IIT Hyderabad.',
                    description: `Outstanding capital growth parcel situated in the Shankarpally - Mokila development corridor.

DTCP approved layout with 40ft blacktop roads, underground drainage, overhead water tank, children's park, and full perimeter security wall with arch gate. Bank loans pre-approved.`,
                    price: 7500000, // ₹75 Lakhs
                    price_negotiable: 0,
                    city: 'Hyderabad',
                    locality: 'Shankarpally',
                    full_address: 'Shankarpally Main Road, Near Railway Station, Shankarpally, Telangana',
                    pin_code: '501203',
                    plot_area: 250,
                    area_unit: 'sq_yd',
                    plot_dimensions: '30 x 75 ft',
                    road_width: '40 ft',
                    facing: 'North',
                    land_use_category: 'Residential',
                    approval_details: 'DTCP Approved Layout No. 112/2023',
                    amenities: JSON.stringify(['Gated Community', 'Park', 'Water Supply', 'Rain Water Harvesting', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-VIL-SHP-001',
                    title: 'Green Valley 3BHK Countryside Villa in Shankarpally',
                    category: 'villa',
                    purpose: 'sale',
                    short_description: '2,700 Sq.Ft 3BHK duplex villa on 220 Sq.Yd with solar roof and private organic kitchen garden.',
                    description: `Serene luxury villa for families seeking peaceful green surroundings within 30 minutes from Financial District.

3 large master bedrooms, Italian tile flooring, double-height foyer, and 2-car covered parking inside a 100% gated community.`,
                    price: 19500000, // ₹1.95 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Shankarpally',
                    full_address: 'Mokila-Shankarpally Road, Shankarpally, Telangana',
                    pin_code: '501203',
                    built_up_area: 2700,
                    plot_area: 220,
                    carpet_area: 2280,
                    area_unit: 'sq_yd',
                    bedrooms: 3,
                    bathrooms: 3,
                    balconies: 2,
                    floors: 2,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '2 Covered Car Parks',
                    private_garden: 1,
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Park', '24/7 Security', 'Solar Panels', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 0,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── PRAGATHI NAGAR (KUKATPALLY) ─────────────────────────────
                {
                    property_code: 'SV-APT-PGN-001',
                    title: 'Sri Venkateswara Enclave 2BHK Flat in Pragathi Nagar',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: '1,250 Sq.Ft 2BHK standalone apartment near JNTU & Forum Mall with dedicated covered parking.',
                    description: `Centrally positioned 2BHK flat in Pragathi Nagar, Kukatpally. 

Features 100% Vaastu design, North-East entrance, 2 airy balconies with open views, teak wood main door, generator backup, and direct access to JNTU Metro & Hitec City Flyover.`,
                    price: 7600000, // ₹76 Lakhs
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Pragathi Nagar',
                    full_address: 'Road No. 4, Near Pragathi Nagar Lake, Kukatpally, Hyderabad',
                    pin_code: '500090',
                    built_up_area: 1250,
                    carpet_area: 1010,
                    area_unit: 'sq_ft',
                    bedrooms: 2,
                    bathrooms: 2,
                    balconies: 2,
                    floors: 5,
                    facing: 'North-East',
                    furnishing: 'semi_furnished',
                    parking: '1 Reserved Car Park',
                    amenities: JSON.stringify(['Lift', 'Power Backup', '24/7 Security', 'CCTV', 'Vastu Compliant', 'Visitor Parking']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── TELLAPUR ────────────────────────────────────────────────
                {
                    property_code: 'SV-APT-TLP-001',
                    title: 'Greenwood Heights 2BHK Gated Apartment in Tellapur',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: 'Contemporary 1,240 Sq.Ft 2BHK gated flat near Citizen Hospital and Gaudium School.',
                    description: `Located in Tellapur, West Hyderabad's highest appreciating residential enclave.

Smart 2BHK layout with modern finishes, open modular kitchen provision, large sliding glass balconies, 100% DG backup, and clubhouse amenities. Pre-approved for bank loans.`,
                    price: 7800000, // ₹78 Lakhs
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Tellapur',
                    full_address: 'Tellapur Main Road, Near Citizen Hospital, Tellapur, Hyderabad',
                    pin_code: '502032',
                    built_up_area: 1240,
                    carpet_area: 1005,
                    area_unit: 'sq_ft',
                    bedrooms: 2,
                    bathrooms: 2,
                    balconies: 2,
                    floors: 14,
                    facing: 'East',
                    furnishing: 'unfurnished',
                    parking: '1 Reserved Covered Park',
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Children Play Area', 'Power Backup', '24/7 Security', 'Lift']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-APT-TLP-002',
                    title: 'The Sovereign Crest 3BHK High-Rise in Tellapur',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: '1,920 Sq.Ft 3BHK premium apartment with scenic lake views and ultra-luxury clubhouse.',
                    description: `Luxurious 3BHK apartment in Tellapur featuring an expansive 24ft balcony, floor-to-ceiling glass windows, 3 spacious bedrooms with wooden flooring in master suite, and 2 covered car parks.`,
                    price: 15200000, // ₹1.52 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Tellapur',
                    full_address: 'Tellapur-Kollur Radial Road, Tellapur, Hyderabad',
                    pin_code: '502032',
                    built_up_area: 1920,
                    carpet_area: 1540,
                    area_unit: 'sq_ft',
                    bedrooms: 3,
                    bathrooms: 3,
                    balconies: 2,
                    floors: 25,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '2 Covered Car Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Squash Court', '24/7 Security', 'Power Backup', 'Lift']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 0,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-VIL-TLP-001',
                    title: 'Meadowlands Gated Community 4BHK Villa in Tellapur',
                    category: 'villa',
                    purpose: 'sale',
                    short_description: 'Sprawling 4BHK independent villa with landscaped garden in a pristine 40-acre gated township in Tellapur.',
                    description: `Serene luxury tailored for discerning families in Tellapur.

Features 4 grand master suites with ensuite bathrooms, home theatre lounge, private courtyard, modular European kitchen, and private EV charging stall. 5 minutes from Kollur ORR Exit 2.`,
                    price: 45000000, // ₹4.50 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Tellapur',
                    full_address: 'Meadowlands Phase II, Near Citizen Hospital, Tellapur, Hyderabad',
                    pin_code: '502032',
                    built_up_area: 4200,
                    plot_area: 320,
                    carpet_area: 3600,
                    area_unit: 'sq_yd',
                    bedrooms: 4,
                    bathrooms: 5,
                    balconies: 3,
                    floors: 2,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '2 Covered Car Parks',
                    private_garden: 1,
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Jogging Track', 'Park', 'Children Play Area', '24/7 Security', 'Solar Panels', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── MOKILA ──────────────────────────────────────────────────
                {
                    property_code: 'SV-PLT-MOK-001',
                    title: 'Green Valley HMDA Plotted Gated Community in Mokila',
                    category: 'residential_plot',
                    purpose: 'sale',
                    short_description: '280 Sq.Yd HMDA approved gated villa plot with 40ft wide blacktop roads and underground electrical cabling.',
                    description: `Secure, tranquil villa plotting development in Mokila, the villa capital of Western Hyderabad.

100% HMDA clear title layout with clubhouse access, water supply line to every plot, avenue plantation, and high-appreciation potential.`,
                    price: 8500000, // ₹85 Lakhs (~₹30,350/sq.yd)
                    price_negotiable: 0,
                    city: 'Hyderabad',
                    locality: 'Mokila',
                    full_address: 'Mokila Main Road, Near Tangatur Junction, Mokila, Telangana',
                    pin_code: '501503',
                    plot_area: 280,
                    area_unit: 'sq_yd',
                    plot_dimensions: '35 x 72 ft',
                    road_width: '40 ft BT Road',
                    facing: 'East',
                    land_use_category: 'Residential R1',
                    approval_details: 'HMDA LP No. 000342/2023',
                    amenities: JSON.stringify(['Gated Community', 'Park', 'Water Supply', 'Rain Water Harvesting', 'Vastu Compliant', '24/7 Security']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-VIL-MOK-001',
                    title: 'Whispering Palms 3BHK Designer Villa in Mokila',
                    category: 'villa',
                    purpose: 'sale',
                    short_description: '3,100 Sq.Ft custom architect-designed 3BHK duplex villa on 260 Sq.Yd plot in Mokila green belt.',
                    description: `Custom architect-designed 3BHK duplex villa featuring imported vitrified tiles, private manicured courtyard, modular German kitchen, and high glass atrium ceilings. Inside 24/7 guarded villa enclave.`,
                    price: 24500000, // ₹2.45 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Mokila',
                    full_address: 'Whispering Palms Enclave, Mokila, Telangana',
                    pin_code: '501503',
                    built_up_area: 3100,
                    plot_area: 260,
                    carpet_area: 2650,
                    area_unit: 'sq_yd',
                    bedrooms: 3,
                    bathrooms: 4,
                    balconies: 2,
                    floors: 2,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '2 Covered Car Parks',
                    private_garden: 1,
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Park', '24/7 Security', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 0,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-VIL-MOK-002',
                    title: 'Signature Serenity 4BHK Luxury Villa in Mokila',
                    category: 'villa',
                    purpose: 'sale',
                    short_description: '3,750 Sq.Ft triplex luxury villa on 330 Sq.Yd with private plunge pool and home theatre lounge.',
                    description: `Palatial 4BHK triplex villa with private dip pool, wooden terrace deck, double-height drawing room, home theatre room, and servant quarters. Full Vaastu compliance with East orientation.`,
                    price: 33000000, // ₹3.30 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Mokila',
                    full_address: 'Signature Serenity Township, Shankarpally-Mokila Road, Mokila, Telangana',
                    pin_code: '501503',
                    built_up_area: 3750,
                    plot_area: 330,
                    carpet_area: 3200,
                    area_unit: 'sq_yd',
                    bedrooms: 4,
                    bathrooms: 5,
                    balconies: 3,
                    floors: 3,
                    facing: 'North-East',
                    furnishing: 'semi_furnished',
                    parking: '3 Car Parking',
                    private_garden: 1,
                    private_pool: 1,
                    amenities: JSON.stringify(['Private Pool', 'Private Garden', 'Clubhouse', 'Gym', 'Tennis Court', '24/7 Security', 'Power Backup']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── KOLLUR (ORR EXIT 2) ─────────────────────────────────────
                {
                    property_code: 'SV-PLT-KLR-001',
                    title: 'ORR Exit-2 HMDA Gated Villa Plot in Kollur',
                    category: 'residential_plot',
                    purpose: 'sale',
                    short_description: '245 Sq.Yd clear title HMDA approved gated villa plot 2 minutes from Outer Ring Road Exit-2.',
                    description: `Prime plotting asset right next to Kollur ORR interchange (Exit 2). 

Offers phenomenal road connectivity to Financial District (12 mins) and Neopolis (10 mins). Clear HMDA title with underground electrical cabling, rainwater harvesting, and avenue greenery.`,
                    price: 9800000, // ₹98 Lakhs (~₹40,000/sq.yd)
                    price_negotiable: 0,
                    city: 'Hyderabad',
                    locality: 'Kollur',
                    full_address: 'Survey No. 192, Near ORR Exit 2, Kollur, Hyderabad',
                    pin_code: '502300',
                    plot_area: 245,
                    area_unit: 'sq_yd',
                    plot_dimensions: '35 x 63 ft',
                    road_width: '40 ft BT Road',
                    facing: 'North-East',
                    land_use_category: 'Residential R1',
                    approval_details: 'HMDA LP No. 000512/2023',
                    amenities: JSON.stringify(['Gated Community', 'Park', 'Water Supply', 'Sewage Treatment', '24/7 Security', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-APT-KLR-001',
                    title: 'Avenue Crest 3BHK Lakeview Apartment in Kollur',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: '1,820 Sq.Ft 3BHK high-rise apartment in Kollur near Neopolis connectivity road with lake view.',
                    description: `High-rise living with unobstructed lake panoramas in Kollur.

3 bedrooms with attached baths, imported sanitary ware, soundproof French balcony doors, piped gas, and double basement parking. Top-notch clubhouse with rooftop infinity pool.`,
                    price: 13500000, // ₹1.35 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Kollur',
                    full_address: 'Avenue Crest Towers, Kollur Lake Road, Kollur, Hyderabad',
                    pin_code: '502300',
                    built_up_area: 1820,
                    carpet_area: 1460,
                    area_unit: 'sq_ft',
                    bedrooms: 3,
                    bathrooms: 3,
                    balconies: 2,
                    floors: 28,
                    facing: 'West',
                    furnishing: 'semi_furnished',
                    parking: '2 Covered Car Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Jogging Track', 'Lift', '24/7 Security', 'Power Backup']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 0,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── MANIKONDA & PUPPALAGUDA ─────────────────────────────────
                {
                    property_code: 'SV-APT-MNK-001',
                    title: 'Hillview Heights 2BHK Apartment in Manikonda',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: 'Deluxe 1,320 Sq.Ft 2BHK flat with panoramic hill views, near Lanco Hills and Delhi Public School.',
                    description: `Strategically situated in Manikonda with prompt 10-minute access to Gachibowli and Raidurg Metro.

2 spacious bedrooms, 2 bathrooms, 2 wide balconies, modular kitchen, chimney, geyser, and 1 dedicated stilt car park.`,
                    price: 9200000, // ₹92 Lakhs
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Manikonda',
                    full_address: 'Secretariat Colony, Near Lanco Hills, Manikonda, Hyderabad',
                    pin_code: '500089',
                    built_up_area: 1320,
                    carpet_area: 1070,
                    area_unit: 'sq_ft',
                    bedrooms: 2,
                    bathrooms: 2,
                    balconies: 2,
                    floors: 10,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '1 Reserved Car Park',
                    amenities: JSON.stringify(['Lift', 'Power Backup', '24/7 Security', 'Gym', 'Children Play Area', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-APT-PUP-001',
                    title: 'Golden Horizon 3BHK High-Rise Flat in Puppalaguda',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: 'Ultra-modern 2,150 Sq.Ft 3BHK flat on 16th floor overlooking Financial District skyline.',
                    description: `High-luxury 3BHK flat in Puppalaguda's premier tower.

Features expansive drawing-dining spaces with Italian marble, VRV air conditioning provisions, 3 grand suites, and 2 reserved basement parking slots. 5 minutes to Wipro Circle and ORR.`,
                    price: 19500000, // ₹1.95 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Puppalaguda',
                    full_address: 'Golden Horizon Towers, Puppalaguda Main Road, Hyderabad',
                    pin_code: '500089',
                    built_up_area: 2150,
                    carpet_area: 1720,
                    area_unit: 'sq_ft',
                    bedrooms: 3,
                    bathrooms: 3,
                    balconies: 2,
                    floors: 22,
                    facing: 'North',
                    furnishing: 'semi_furnished',
                    parking: '2 Covered Car Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Tennis Court', '24/7 Security', 'Power Backup', 'Lift']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── NALLAGANDLA ─────────────────────────────────────────────
                {
                    property_code: 'SV-APT-NLG-001',
                    title: 'Aparna Serene 3BHK Gated Flat in Nallagandla',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: 'Well-ventilated 1,880 Sq.Ft 3BHK flat in prime Nallagandla near Citizen Hospital and Hitec bypass.',
                    description: `Peaceful family living in Nallagandla, surrounded by reputed international schools and tech corridors.

3 bedrooms, 3 bathrooms, large private balcony overlooking landscaped central podium, piped cooking gas, and 2 designated car parks.`,
                    price: 15500000, // ₹1.55 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Nallagandla',
                    full_address: 'Nallagandla Main Road, Near Aparna Sarovar, Nallagandla, Hyderabad',
                    pin_code: '500019',
                    built_up_area: 1880,
                    carpet_area: 1500,
                    area_unit: 'sq_ft',
                    bedrooms: 3,
                    bathrooms: 3,
                    balconies: 2,
                    floors: 14,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '2 Covered Car Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Children Play Area', 'Power Backup', '24/7 Security', 'Lift']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 0,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── KONDAPUR ────────────────────────────────────────────────
                {
                    property_code: 'SV-APT-KDP-001',
                    title: 'Botanical Enclave 3BHK Premium Flat in Kondapur',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: 'Opposite Botanical Garden, walking distance to Sarath City Capital Mall with 2,050 Sq.Ft space.',
                    description: `Prestigious Kondapur address opposite the lush green Botanical Reserve.

3 spacious bedrooms, 3 designer bathrooms, utility area, high quality wooden flooring, double glazed windows, and 2 basement car parking slots. 5 minutes to Hitec City cyber towers.`,
                    price: 18500000, // ₹1.85 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Kondapur',
                    full_address: 'Opp. Botanical Gardens, Whitefields Road, Kondapur, Hyderabad',
                    pin_code: '500084',
                    built_up_area: 2050,
                    carpet_area: 1640,
                    area_unit: 'sq_ft',
                    bedrooms: 3,
                    bathrooms: 3,
                    balconies: 2,
                    floors: 15,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '2 Reserved Basement Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Gym', 'Swimming Pool', 'Children Play Area', '24/7 Security', 'Power Backup', 'Lift']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── GACHIBOWLI ──────────────────────────────────────────────
                {
                    property_code: 'SV-APT-GCB-001',
                    title: 'Cyber Crest 3BHK Luxury Apartment in Gachibowli',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: '2,250 Sq.Ft luxury flat near DLF Cyber City and Bio-Diversity Junction with 3-tier security.',
                    description: `Heart of the IT powerhouse in Gachibowli. 

High-floor 3BHK residence engineered with 11ft ceilings, imported marble, central water heating, video door phone, and access to a 50,000 sq.ft luxury clubhouse.`,
                    price: 21500000, // ₹2.15 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Gachibowli',
                    full_address: 'Near DLF Cyber City, Gachibowli Arterial Road, Hyderabad',
                    pin_code: '500032',
                    built_up_area: 2250,
                    carpet_area: 1800,
                    area_unit: 'sq_ft',
                    bedrooms: 3,
                    bathrooms: 3,
                    balconies: 3,
                    floors: 18,
                    facing: 'North',
                    furnishing: 'fully_furnished',
                    parking: '2 Covered Car Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Tennis Court', '24/7 Security', 'Power Backup', 'Lift']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-APT-GCB-002',
                    title: 'Signature Heights 4BHK High-Rise in Gachibowli',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: 'Grand 3,600 Sq.Ft 4BHK with double-height ceiling, private elevator foyer, and servant quarter.',
                    description: `Exclusive ultra-luxury sky apartment in Gachibowli.

Includes 4 grand master bedrooms, Italian marble flooring, soundproof German glass facades, personal lift foyer, and 3 reserved basement car parking stalls.`,
                    price: 38500000, // ₹3.85 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Gachibowli',
                    full_address: 'Signature Heights, Financial District Access Road, Gachibowli, Hyderabad',
                    pin_code: '500032',
                    built_up_area: 3600,
                    carpet_area: 2900,
                    area_unit: 'sq_ft',
                    bedrooms: 4,
                    bathrooms: 5,
                    balconies: 3,
                    floors: 30,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '3 Reserved Basement Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Squash Arena', 'Power Backup', '24/7 Security', 'Lift']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-COM-GCB-001',
                    title: 'Prime Grade-A Commercial Showroom Space in Gachibowli',
                    category: 'commercial',
                    purpose: 'sale',
                    short_description: '5,200 Sq.Ft road-facing retail showroom on Gachibowli-Miyapur main road with high footfall.',
                    description: `Exceptional commercial asset suitable for high-end retail, bank branch, corporate office, or healthcare clinic.

Features 100ft road frontage, glass facade, 3-phase high tension power connection, 100% DG backup, and 12 designated parking slots. Estimated rental yield of 8.5% p.a.`,
                    price: 78000000, // ₹7.80 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Gachibowli',
                    full_address: 'Main Commercial Arterial Road, Near Bio-Diversity Junction, Gachibowli, Hyderabad',
                    pin_code: '500081',
                    built_up_area: 5200,
                    area_unit: 'sq_ft',
                    parking: '12 Car Parking',
                    amenities: JSON.stringify(['Power Backup', '24/7 Security', 'CCTV', 'Lift', 'Fire Safety', 'Visitor Parking']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── FINANCIAL DISTRICT ──────────────────────────────────────
                {
                    property_code: 'SV-APT-FND-001',
                    title: 'One Financial 3BHK Premium High-Rise',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: '2,300 Sq.Ft 3BHK luxury home right opposite Amazon Campus and WaveRock with sky lounge access.',
                    description: `Live across the street from global tech headquarters in Nanakramguda Financial District.

3 opulent bedrooms, 3 ensuite designer bathrooms, expansive living room with panoramic glass wall, central AC provisions, and 2 covered car parks.`,
                    price: 23500000, // ₹2.35 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Financial District',
                    full_address: 'Opposite Amazon Campus, Nanakramguda, Financial District, Hyderabad',
                    pin_code: '500032',
                    built_up_area: 2300,
                    carpet_area: 1850,
                    area_unit: 'sq_ft',
                    bedrooms: 3,
                    bathrooms: 3,
                    balconies: 2,
                    floors: 35,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '2 Covered Car Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Infinity Pool', 'Gym', 'Sky Lounge', 'Power Backup', '24/7 Security', 'Lift']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-APT-FND-002',
                    title: 'Sky Residences 4BHK Luxury Apartment in Financial District',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: '3,850 Sq.Ft Sky Palace with panoramic views of Financial District skyline on the 32nd floor.',
                    description: `Step into soaring heights at Hyderabad's premier high-rise address overlooking the gleaming Financial District skyline.

This 4BHK + Maid Room luxury sky residence features floor-to-ceiling soundproof German glass facades, expansive 40ft wrap-around viewing balcony, VRV central air-conditioning, and 11ft ceiling clearance.

Exclusive access to a 75,000 sq.ft international clubhouse, Olympic-sized temperature-controlled pool, rooftop helipad lounge, and 3 reserved basement parks.`,
                    price: 42500000, // ₹4.25 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Financial District',
                    full_address: 'Tower Sapphire, Sky Residences, Nanakramguda, Financial District, Hyderabad',
                    pin_code: '500032',
                    built_up_area: 3850,
                    carpet_area: 3100,
                    area_unit: 'sq_ft',
                    bedrooms: 4,
                    bathrooms: 5,
                    balconies: 3,
                    floors: 42,
                    facing: 'North-East',
                    furnishing: 'fully_furnished',
                    parking: '3 Reserved Basement Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Tennis Court', 'Children Play Area', 'Power Backup', '24/7 Security', 'Lift', 'Visitor Parking', 'Intercom']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── KOKAPET (GOLDEN MILE & NEOPOLIS) ────────────────────────
                {
                    property_code: 'SV-APT-KKP-001',
                    title: 'Neopolis Celestia 3BHK Luxury High-Rise in Kokapet',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: 'Ultra-luxurious 2,450 Sq.Ft 3BHK flat in Kokapet Neopolis corridor with 5-star clubhouse access.',
                    description: `Located in Kokapet Neopolis, the crown jewel of Hyderabad real estate.

3 grand suites, Italian marble flooring, 12ft high ceilings, expansive deck overlooking Osman Sagar lake, 100% DG backup, and 2 reserved basement parks.`,
                    price: 26500000, // ₹2.65 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Kokapet',
                    full_address: 'Neopolis High Street Corridor, Kokapet, Hyderabad',
                    pin_code: '500075',
                    built_up_area: 2450,
                    carpet_area: 1960,
                    area_unit: 'sq_ft',
                    bedrooms: 3,
                    bathrooms: 3,
                    balconies: 2,
                    floors: 45,
                    facing: 'North',
                    furnishing: 'semi_furnished',
                    parking: '2 Reserved Basement Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Infinity Pool', 'Gym', 'Squash Court', '24/7 Security', 'Power Backup', 'Lift']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-APT-KKP-002',
                    title: 'The Sovereign Penthouse 4BHK Sky Mansion in Kokapet',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: 'Magnificent 4,500 Sq.Ft 4BHK penthouse with private sky deck, jacuzzi, and 4 reserved car parks.',
                    description: `Apex luxury living on the 48th floor in Kokapet. 

Includes 4 palatial bedroom suites, personal glass elevator, private heated infinity jacuzzi on the open-air deck, German Bulthaup kitchen, and staff quarter with separate access.`,
                    price: 54000000, // ₹5.40 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Kokapet',
                    full_address: 'Golden Mile Road, Opp. Neopolis SEZ, Kokapet, Hyderabad',
                    pin_code: '500075',
                    built_up_area: 4500,
                    carpet_area: 3750,
                    area_unit: 'sq_ft',
                    bedrooms: 4,
                    bathrooms: 5,
                    balconies: 4,
                    floors: 48,
                    facing: 'East',
                    furnishing: 'fully_furnished',
                    parking: '4 Reserved Basement Parks',
                    private_pool: 1,
                    amenities: JSON.stringify(['Private Pool', 'Clubhouse', 'Gym', 'Sky Lounge', 'Helipad', '24/7 Security', 'Power Backup', 'Lift']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-PLT-KKP-001',
                    title: 'HMDA Golden Mile Plotted Estate in Kokapet',
                    category: 'residential_plot',
                    purpose: 'sale',
                    short_description: 'Prime 400 Sq.Yd East-facing open plot facing 60ft BT road adjacent to Neopolis Kokapet.',
                    description: `Strategic land acquisition opportunity in Kokapet (Golden Mile Corridor), the fastest appreciating real estate submarket in Southern India.

Clear title HMDA approved layout with underground electrical cabling, piped water connection, LED streetscapes, central rainwater harvesting, and avenue plantation. Direct 5-minute commute to Wipro Circle and Continental Hospital.`,
                    price: 48000000, // ₹4.80 Cr (~₹1,20,000/sq.yd)
                    price_negotiable: 0,
                    city: 'Hyderabad',
                    locality: 'Kokapet',
                    full_address: 'Survey No. 128, Golden Mile Road, Near Neopolis SEZ, Kokapet, Hyderabad',
                    pin_code: '500075',
                    plot_area: 400,
                    area_unit: 'sq_yd',
                    plot_dimensions: '40 x 90 ft',
                    road_width: '60 ft BT Road',
                    facing: 'East',
                    land_use_category: 'Residential R1 Zone',
                    approval_details: 'HMDA Layout LP No. 000452/LO/Plg/HMDA/2023',
                    amenities: JSON.stringify(['Gated Community', 'Park', 'Children Play Area', 'Water Supply', 'Sewage Treatment', 'Rain Water Harvesting', 'Vastu Compliant', '24/7 Security']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-COM-KKP-001',
                    title: 'Neopolis Commercial Executive Tower Floor',
                    category: 'commercial',
                    purpose: 'sale',
                    short_description: '3,400 Sq.Ft Grade-A corporate office floor plate with LEED Platinum green certification in Neopolis.',
                    description: `Prime office space in Kokapet Neopolis. Ideal for IT/ITES companies, wealth management firms, and corporate regional headquarters. High ROI and corporate rental demand.`,
                    price: 49000000, // ₹4.90 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Kokapet',
                    full_address: 'Neopolis Corporate Avenue, Kokapet, Hyderabad',
                    pin_code: '500075',
                    built_up_area: 3400,
                    area_unit: 'sq_ft',
                    parking: '8 Car Parking',
                    amenities: JSON.stringify(['Power Backup', '24/7 Security', 'CCTV', 'High Speed Lifts', 'Fire Safety', 'Visitor Parking']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 0,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── MADHAPUR (HITEC CITY) ───────────────────────────────────
                {
                    property_code: 'SV-COM-MDP-001',
                    title: 'Cyberview Corporate IT Office Suite in Madhapur',
                    category: 'commercial',
                    purpose: 'sale',
                    short_description: '2,750 Sq.Ft fully plug-and-play 50-seater corporate office space near Inorbit Mall, Madhapur.',
                    description: `Furnished Grade-A IT office with 50 modular workstations, 2 director cabins, 12-seater conference room with video conferencing, server room, and cafeteria. 100% DG backup.`,
                    price: 36000000, // ₹3.60 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Madhapur',
                    full_address: 'Hitec City Main Road, Near Inorbit Mall, Madhapur, Hyderabad',
                    pin_code: '500081',
                    built_up_area: 2750,
                    area_unit: 'sq_ft',
                    parking: '6 Reserved Car Parks',
                    amenities: JSON.stringify(['Power Backup', '24/7 Security', 'CCTV', 'Lift', 'Cafeteria', 'Fire Safety']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── GANDIPET ────────────────────────────────────────────────
                {
                    property_code: 'SV-VIL-GDP-001',
                    title: 'Lakefront Opulence 4BHK Villa in Gandipet',
                    category: 'villa',
                    purpose: 'sale',
                    short_description: 'Spectacular lakeview 4BHK villa in private gated enclave with personal swimming pool on 450 Sq.Yd.',
                    description: `Super-exclusive 4BHK luxury villa situated along the serene Gandipet Lake boundary.

4,900 sq.ft built-up area engineered with Italian Botticino marble, private pool, private elevator, double-height living room, 4 car parks, and personal landscaped terrace. 10 minutes to Financial District.`,
                    price: 68000000, // ₹6.80 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Gandipet',
                    full_address: 'Gandipet Lake Road, Near CBIT, Gandipet, Hyderabad',
                    pin_code: '500075',
                    built_up_area: 4900,
                    plot_area: 450,
                    carpet_area: 4100,
                    area_unit: 'sq_yd',
                    bedrooms: 4,
                    bathrooms: 5,
                    balconies: 3,
                    floors: 3,
                    facing: 'North',
                    furnishing: 'fully_furnished',
                    parking: '4 Covered Car Parks',
                    private_garden: 1,
                    private_pool: 1,
                    amenities: JSON.stringify(['Private Pool', 'Private Garden', 'Lift', 'Clubhouse', 'Gym', '24/7 Security', 'Power Backup', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── BANJARA HILLS ───────────────────────────────────────────
                {
                    property_code: 'SV-APT-BJH-001',
                    title: 'The Marquess 4BHK Ultra-Luxury Flat in Banjara Hills',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: 'Road No. 12 Banjara Hills, bespoke 4,100 Sq.Ft single-floor residence with private lift lobby.',
                    description: `Living in Banjara Hills is an unequivocal statement of distinction.

This bespoke single-floor 4BHK apartment features soundproof German triple-glazed facades, private keycard elevator lobby, master suite with walk-in wardrobe, Italian marble, and 3 reserved basement car parks.`,
                    price: 72000000, // ₹7.20 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Banjara Hills',
                    full_address: 'Road No. 12, Near Taj Krishna, Banjara Hills, Hyderabad',
                    pin_code: '500034',
                    built_up_area: 4100,
                    carpet_area: 3400,
                    area_unit: 'sq_ft',
                    bedrooms: 4,
                    bathrooms: 5,
                    balconies: 3,
                    floors: 12,
                    facing: 'East',
                    furnishing: 'fully_furnished',
                    parking: '3 Reserved Basement Parks',
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', '24/7 Security', 'Power Backup', 'Lift', 'CCTV', 'Visitor Parking']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'
                    ]
                },

                // ── JUBILEE HILLS ───────────────────────────────────────────
                {
                    property_code: 'SV-VIL-JBH-001',
                    title: 'The Royal Sovereign 5BHK Triplex Villa in Jubilee Hills',
                    category: 'villa',
                    purpose: 'sale',
                    short_description: 'Ultra-luxury triplex designer villa with private infinity pool and Italian marble in Jubilee Hills.',
                    description: `Experience the apex of palatial living in Jubilee Hills, Hyderabad's most distinguished address.

This bespoke 5BHK triplex masterpiece is engineered with double-height grand living spaces, imported Botticino marble, private OTIS glass elevator, fully landscaped private terrace garden, and an infinity plunge pool.

Located within a private enclave of only 8 residences with 3-tier security, 100% power backup, and dedicated staff quarters. 100% Vastu compliant with expansive East-facing facade.`,
                    price: 185000000, // ₹18.50 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Jubilee Hills',
                    full_address: 'Road No. 36, Near Peddamma Temple, Jubilee Hills, Hyderabad',
                    pin_code: '500033',
                    built_up_area: 7200,
                    plot_area: 550,
                    carpet_area: 6100,
                    area_unit: 'sq_yd',
                    bedrooms: 5,
                    bathrooms: 6,
                    balconies: 4,
                    floors: 3,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '4 Covered Car Parks',
                    private_garden: 1,
                    private_pool: 1,
                    amenities: JSON.stringify(['Swimming Pool', 'Private Garden', 'Lift', 'Clubhouse', 'Gym', '24/7 Security', 'CCTV', 'Power Backup', 'Vastu Compliant', 'Car Parking']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 1,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80'
                    ]
                }
            ];

            const insertProp = db.prepare(`
                INSERT INTO properties (
                    property_code, title, category, purpose, short_description, description,
                    price, price_negotiable, city, locality, full_address, pin_code,
                    built_up_area, carpet_area, plot_area, area_unit, bedrooms, bathrooms,
                    balconies, floors, facing, furnishing, parking, private_garden, private_pool,
                    plot_dimensions, road_width, land_use_category, approval_details,
                    amenities, status, availability, is_featured, published_at, created_by
                ) VALUES (
                    @property_code, @title, @category, @purpose, @short_description, @description,
                    @price, @price_negotiable, @city, @locality, @full_address, @pin_code,
                    @built_up_area, @carpet_area, @plot_area, @area_unit, @bedrooms, @bathrooms,
                    @balconies, @floors, @facing, @furnishing, @parking, @private_garden, @private_pool,
                    @plot_dimensions, @road_width, @land_use_category, @approval_details,
                    @amenities, @status, @availability, @is_featured, @published_at, @created_by
                )
            `);

            const insertImage = db.prepare(`
                INSERT INTO property_images (property_id, image_url, is_cover, display_order)
                VALUES (?, ?, ?, ?)
            `);

            for (const prop of propertiesList) {
                const res = insertProp.run({
                    property_code: prop.property_code,
                    title: prop.title,
                    category: prop.category,
                    purpose: prop.purpose,
                    short_description: prop.short_description,
                    description: prop.description,
                    price: prop.price,
                    price_negotiable: prop.price_negotiable,
                    city: prop.city,
                    locality: prop.locality,
                    full_address: prop.full_address,
                    pin_code: prop.pin_code,
                    built_up_area: prop.built_up_area || null,
                    carpet_area: prop.carpet_area || null,
                    plot_area: prop.plot_area || null,
                    area_unit: prop.area_unit,
                    bedrooms: prop.bedrooms || null,
                    bathrooms: prop.bathrooms || null,
                    balconies: prop.balconies || null,
                    floors: prop.floors || null,
                    facing: prop.facing || null,
                    furnishing: prop.furnishing || null,
                    parking: prop.parking || null,
                    private_garden: prop.private_garden || 0,
                    private_pool: prop.private_pool || 0,
                    plot_dimensions: prop.plot_dimensions || null,
                    road_width: prop.road_width || null,
                    land_use_category: prop.land_use_category || null,
                    approval_details: prop.approval_details || null,
                    amenities: prop.amenities,
                    status: prop.status,
                    availability: prop.availability,
                    is_featured: prop.is_featured,
                    published_at: prop.published_at,
                    created_by: adminUser.id
                });

                const newPropId = res.lastInsertRowid;
                prop.images.forEach((imgUrl, idx) => {
                    insertImage.run(newPropId, imgUrl, idx === 0 ? 1 : 0, idx);
                });
            }

            console.log(`✅ Seeded ${propertiesList.length} verified realistic properties with images across all top Hyderabad localities`);
        }

        // 4. Sample Leads
        const leadCount = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
        if (leadCount === 0) {
            console.log('🌱 Seeding CRM enquiries...');
            const sampleLeads = [
                {
                    lead_code: 'SV-LEAD-000101',
                    customer_name: 'Dr. Suresh Varma',
                    phone: '9849012345',
                    email: 'suresh.varma@apollohospital.org',
                    property_category: 'villa',
                    budget: '₹15 Cr - ₹20 Cr',
                    preferred_location: 'Jubilee Hills',
                    message: 'Interested in The Royal Sovereign 5BHK Villa. Need to schedule private walkthrough on Saturday.',
                    status: 'site_visit_scheduled',
                    source: 'website'
                },
                {
                    lead_code: 'SV-LEAD-000102',
                    customer_name: 'Satyanarayana Raju (NRI - Dallas)',
                    phone: '9989098765',
                    email: 'raju.dallas@gmail.com',
                    property_category: 'residential_plot',
                    budget: '₹4 Cr - ₹6 Cr',
                    preferred_location: 'Kokapet',
                    message: 'Looking for 400-500 Sq.yd clear title HMDA plot in Kokapet for immediate investment. Need legal opinion copy.',
                    status: 'interested',
                    source: 'website'
                },
                {
                    lead_code: 'SV-LEAD-000103',
                    customer_name: 'Vikram Chaitanya',
                    phone: '9876541230',
                    email: 'vikram.c@techcorp.in',
                    property_category: 'apartment',
                    budget: '₹3 Cr - ₹5 Cr',
                    preferred_location: 'Financial District',
                    message: 'Need 4BHK apartment in Sky Residences on higher floor with 3 car parks.',
                    status: 'contacted',
                    source: 'chatbot'
                },
                {
                    lead_code: 'SV-LEAD-000104',
                    customer_name: 'Priyanka Desai',
                    phone: '9701234567',
                    email: 'priyanka@desaidecor.com',
                    property_category: 'villa',
                    budget: '₹4 Cr - ₹5 Cr',
                    preferred_location: 'Tellapur',
                    message: 'Enquiring about Meadowlands Gated Community 4BHK Villa. Are bank loans pre-approved from HDFC?',
                    status: 'new',
                    source: 'website'
                },
                {
                    lead_code: 'SV-LEAD-000105',
                    customer_name: 'K. Ramesh Reddy',
                    phone: '9848123999',
                    email: 'ramesh.reddy@infotech.com',
                    property_category: 'apartment',
                    budget: '₹70 L - ₹85 L',
                    preferred_location: 'Tellapur',
                    message: 'Looking for 2BHK flat starting 70 Lakhs in Tellapur / Bachupally. Please send available floor plans.',
                    status: 'new',
                    source: 'website'
                }
            ];

            const insertLead = db.prepare(`
                INSERT INTO leads (
                    lead_code, customer_name, phone, email, property_category,
                    budget, preferred_location, message, contact_preference, consent,
                    source, status, assigned_agent_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'phone', 1, ?, ?, ?)
            `);

            for (const lead of sampleLeads) {
                const res = insertLead.run(
                    lead.lead_code, lead.customer_name, lead.phone, lead.email,
                    lead.property_category, lead.budget, lead.preferred_location,
                    lead.message, lead.source, lead.status, agentUser ? agentUser.id : adminUser.id
                );

                db.prepare(`
                    INSERT INTO lead_notes (lead_id, user_id, note, note_type)
                    VALUES (?, ?, ?, 'system')
                `).run(res.lastInsertRowid, adminUser.id, 'Initial enquiry recorded from ' + lead.source);
            }
            console.log(`✅ Seeded ${sampleLeads.length} sample leads`);
        }

        // 5. Sample Appointments
        const aptCount = db.prepare('SELECT COUNT(*) as count FROM appointments').get().count;
        if (aptCount === 0) {
            console.log('🌱 Seeding site visits...');
            const sampleVisits = [
                {
                    appointment_code: 'SV-VISIT-00001',
                    customer_name: 'Dr. Suresh Varma',
                    phone: '9849012345',
                    requested_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
                    requested_time: '11:00 AM',
                    confirmed_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
                    confirmed_time: '11:00 AM',
                    status: 'confirmed',
                    notes: 'Client requests chauffeur pickup from Jubilee Hills Checkpost'
                },
                {
                    appointment_code: 'SV-VISIT-00002',
                    customer_name: 'Priyanka Desai',
                    phone: '9701234567',
                    requested_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
                    requested_time: '04:30 PM',
                    status: 'requested',
                    notes: 'Family visit with architect for Tellapur 4BHK Villa'
                }
            ];

            const insertApt = db.prepare(`
                INSERT INTO appointments (
                    appointment_code, customer_name, phone, requested_date,
                    requested_time, confirmed_date, confirmed_time, status, notes, assigned_agent_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const apt of sampleVisits) {
                insertApt.run(
                    apt.appointment_code, apt.customer_name, apt.phone,
                    apt.requested_date, apt.requested_time, apt.confirmed_date || null,
                    apt.confirmed_time || null, apt.status, apt.notes,
                    agentUser ? agentUser.id : adminUser.id
                );
            }
            console.log(`✅ Seeded ${sampleVisits.length} appointments`);
        }

        // 6. Ensure default settings with updated email
        db.prepare(`
            INSERT OR REPLACE INTO settings (key, value) VALUES
                ('business_name', 'Sri Venkateswara Real Estates & Building Materials'),
                ('business_tagline', 'Luxury Properties, Gated Communities & Building Construction'),
                ('business_phone', '+91 9346423434'),
                ('business_email', 'svsrivenkateswara99@gmail.com'),
                ('business_whatsapp', '919346423434'),
                ('business_address', '# MIG-2/183, 9th Phase, KPHB Colony, Kukatpally, Hyderabad - 500085'),
                ('business_instagram', 'https://instagram.com/sv.realestatehyd?cplk=MWtva2tubm11NDB0Ng%3D%3D&utm_source=qr')
        `).run();

        console.log('🎉 Seeding successfully completed! All areas set with minimum ₹70 Lakhs budget baseline.');
    } catch (err) {
        console.error('❌ Seeding error:', err);
    }
}

// Allow direct execution
if (require.main === module) {
    const isForce = process.argv.includes('--force') || true;
    seed(null, isForce);
    closeDb();
}

module.exports = { seed };
