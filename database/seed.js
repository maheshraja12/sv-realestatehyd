/**
 * Comprehensive Seed script — Creates admin user, agent user, luxury properties, images, sample leads, and site visits.
 * Run: npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initializeDb, getDb, closeDb } = require('./db');

function seed(existingDb) {
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
            console.log(`ℹ️ Admin user already exists: ${email}`);
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

        // 3. Sample Properties
        const propCount = db.prepare('SELECT COUNT(*) as count FROM properties').get().count;
        if (propCount === 0) {
            console.log('🌱 Seeding luxury properties catalog...');

            const sampleProperties = [
                {
                    property_code: 'SV-VIL-00101',
                    title: 'The Royal Sovereign 5BHK Triplex Villa',
                    category: 'villa',
                    purpose: 'sale',
                    short_description: 'Ultra-luxury triplex designer villa with private infinity pool and Italian marble in Jubilee Hills.',
                    description: `Experience the apex of palatial living in Jubilee Hills, Hyderabad's most distinguished address.

This bespoke 5BHK triplex masterpiece is engineered with double-height grand living spaces, imported Botticino marble, private OTIS glass elevator, fully landscaped private terrace garden, and an infinity plunge pool.

Located within a private enclave of only 8 residences with 3-tier security, 100% power backup, and dedicated staff quarters. 100% Vastu compliant with expansive East-facing facade.`,
                    price: 185000000, // 18.5 Cr
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
                },
                {
                    property_code: 'SV-PLT-00204',
                    title: 'HMDA Golden Mile Plotted Estate in Kokapet',
                    category: 'residential_plot',
                    purpose: 'sale',
                    short_description: 'Prime 400 Sq.Yd East-facing open plot facing 60ft BT road adjacent to Neopolis Kokapet.',
                    description: `Strategic land acquisition opportunity in Kokapet (Golden Mile Corridor), the fastest appreciating real estate submarket in Southern India.

Clear title HMDA approved layout with underground electrical cabling, piped water connection, LED streetscapes, central rainwater harvesting, and avenue plantation.

Direct 5-minute commute to Wipro Circle, Continental Hospital, and Financial District. Ideal for constructing a modern generational villa or high-appreciation land banking.`,
                    price: 48000000, // 4.8 Cr
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
                    property_code: 'SV-APT-00305',
                    title: 'Sky Residences 4BHK Luxury Apartment',
                    category: 'apartment',
                    purpose: 'sale',
                    short_description: '3,850 Sq.Ft Sky Palace with panoramic views of Financial District skyline on the 32nd floor.',
                    description: `Step into soaring heights at Hyderabad's premier high-rise address overlooking the gleaming Financial District skyline.

This 4BHK + Maid Room luxury sky residence features floor-to-ceiling soundproof German glass facades, expansive 40ft wrap-around viewing balcony, VRV central air-conditioning, and 11ft ceiling clearance.

Exclusive access to a 75,000 sq.ft international clubhouse, Olympic-sized temperature-controlled pool, rooftop helipad lounge, badminton courts, and squash arena.`,
                    price: 42500000, // 4.25 Cr
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
                {
                    property_code: 'SV-VIL-00412',
                    title: 'Meadowlands Gated Community 4BHK Villa',
                    category: 'villa',
                    purpose: 'sale',
                    short_description: 'Sprawling 4BHK independent villa with landscaped garden in a pristine 40-acre gated township in Tellapur.',
                    description: `Discover serene luxury tailored for family living in Tellapur, West Hyderabad's most sought-after green residential zone.

Features 4 grand master suites with ensuite bathrooms, home theatre lounge, private courtyard, modular European kitchen, and private EV charging stall.

Minutes away from Glendale Academy, Gaudium School, and Kollur ORR interchange (Exit 2). Completely approved by HMDA and RERA.`,
                    price: 65000000, // 6.5 Cr
                    price_negotiable: 1,
                    city: 'Hyderabad',
                    locality: 'Tellapur',
                    full_address: 'Meadowlands Phase II, Near Citizen Hospital, Tellapur, Hyderabad',
                    pin_code: '502032',
                    built_up_area: 4500,
                    plot_area: 350,
                    carpet_area: 3800,
                    area_unit: 'sq_yd',
                    bedrooms: 4,
                    bathrooms: 5,
                    balconies: 3,
                    floors: 2,
                    facing: 'East',
                    furnishing: 'semi_furnished',
                    parking: '2 Car Parking',
                    private_garden: 1,
                    amenities: JSON.stringify(['Clubhouse', 'Swimming Pool', 'Gym', 'Jogging Track', 'Park', 'Children Play Area', '24/7 Security', 'Solar Panels', 'Vastu Compliant']),
                    status: 'published',
                    availability: 'available',
                    is_featured: 0,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
                        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-PLT-00520',
                    title: 'Premium DTCP Highway Facing Plot in Shankarpally',
                    category: 'residential_plot',
                    purpose: 'sale',
                    short_description: '250 Sq.Yd clear title plot with immediate construction permissions near IIT Hyderabad.',
                    description: `Outstanding capital growth parcel situated in the Shankarpally - Mokila development corridor.

DTCP approved layout with 40ft blacktop roads, underground drainage, overhead water tank, children's park, and full perimeter security wall with arch gate.

Rapidly developing region with excellent connection to Gachibowli (30 min) and BDL Bhanur. Bank loans approved from SBI and HDFC.`,
                    price: 7500000, // 75 Lakhs
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
                    is_featured: 0,
                    published_at: new Date().toISOString(),
                    images: [
                        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80'
                    ]
                },
                {
                    property_code: 'SV-COM-00630',
                    title: 'Prime Grade-A Commercial Showroom Space in Gachibowli',
                    category: 'commercial',
                    purpose: 'sale',
                    short_description: '5,200 Sq.Ft road-facing retail showroom on Gachibowli-Miyapur main road with high footfall.',
                    description: `Exceptional commercial asset suitable for high-end retail, bank branch, corporate office, or healthcare clinic.

Features 100ft road frontage, glass facade, 3-phase high tension power connection, 100% DG backup, and 12 designated parking slots.

Currently in high demand with an estimated rental yield of 8.5% p.a.`,
                    price: 78000000, // 7.8 Cr
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

            for (const prop of sampleProperties) {
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

            console.log(`✅ Seeded ${sampleProperties.length} luxury properties with images`);
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
                    budget: '₹5 Cr - ₹7 Cr',
                    preferred_location: 'Tellapur',
                    message: 'Enquiring about Meadowlands Gated Community Villa. Are bank loans pre-approved from HDFC?',
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

                // Add sample note
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
                    notes: 'Family visit with architect'
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
                    apt.confirmed_time || null, apt.status, apt.notes, agentUser ? agentUser.id : adminUser.id
                );
            }
            console.log(`✅ Seeded ${sampleVisits.length} site visits`);
        }

        // 6. Sample Notifications
        db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, link, is_read)
            VALUES (?, 'lead', 'New High-Value Enquiry', 'Dr. Suresh Varma requested visit for Jubilee Hills Villa', '/admin/leads/1', 0)
        `).run(adminUser.id);

        if (!existingDb) {
            console.log(`
🎉 Database ready!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Admin Login Credentials:
  URL:      http://localhost:3000/admin/login
  Email:    ${email}
  Password: ${password}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            `);
            closeDb();
        }
        return true;
    } catch (err) {
        console.error('❌ Seed failed:', err);
        if (!existingDb) process.exit(1);
        return false;
    }
}

if (require.main === module) {
    seed();
}

module.exports = { seed };

