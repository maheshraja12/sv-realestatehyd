/**
 * Comprehensive Hyderabad Real Estate Master Locations & SEO Registry
 * Covers all major zones, growth corridors, and micro-markets across Hyderabad & Telangana.
 */

const HYDERABAD_CORRIDORS = [
    {
        id: 'west',
        zone: 'West Hyderabad',
        corridorTitle: 'IT Capital, Financial District & Luxury Corridors',
        description: 'Hyderabad premier growth engine hosting global tech campuses, ultra-luxury high-rises, and prime villa townships.',
        localities: [
            {
                name: 'Kokapet',
                displayName: 'Kokapet & Neopolis (Golden Mile)',
                subAreas: ['Neopolis', 'Golden Mile', 'Gandipet Road'],
                keywords: 'kokapet flats, luxury apartments in kokapet neopolis, trump tower hyderabad, kokapet villas, commercial space kokapet',
                popularTypes: ['Luxury Villas', 'Sky Apartments', 'Commercial'],
                priceRange: '₹1.5 Cr - ₹6 Cr'
            },
            {
                name: 'Financial District',
                displayName: 'Financial District (Nanakramguda)',
                subAreas: ['Nanakramguda', 'Waverock', 'ISB Road'],
                keywords: 'financial district hyderabad flats, nanakramguda apartments, office space financial district',
                popularTypes: ['Gated Apartments', 'Commercial', 'Penthouses'],
                priceRange: '₹1.8 Cr - ₹5.5 Cr'
            },
            {
                name: 'Gachibowli',
                displayName: 'Gachibowli (IT Corridor)',
                subAreas: ['Telecom Nagar', 'Jayabheri Enclave', 'DLF Cybercity'],
                keywords: 'flats in gachibowli, gachibowli apartments for sale, 3bhk flats gachibowli, rent in gachibowli',
                popularTypes: ['3 BHK Flats', '2 BHK Flats', 'Commercial Offices'],
                priceRange: '₹95L - ₹4.5 Cr'
            },
            {
                name: 'Tellapur',
                displayName: 'Tellapur (Gated Community Hub)',
                subAreas: ['Tellapur Road', 'Osman Nagar', 'Kollur Road'],
                keywords: 'villas in tellapur, 3bhk in tellapur, tellapur gated community flats, aparna tellapur',
                popularTypes: ['Gated Villas', 'Luxury High-Rises', '2 & 3 BHK Flats'],
                priceRange: '₹85L - ₹4.2 Cr'
            },
            {
                name: 'Narsingi',
                displayName: 'Narsingi & Puppalaguda',
                subAreas: ['Puppalaguda', 'Alkapur Township', 'ORR Junction'],
                keywords: 'flats in narsingi, luxury apartments in narsingi, puppalaguda flats for sale, narsingi orr junction',
                popularTypes: ['Luxury Flats', 'Duplex Villas', 'Independent Floors'],
                priceRange: '₹90L - ₹3.8 Cr'
            },
            {
                name: 'Mokila',
                displayName: 'Mokila (Luxury Villa Corridor)',
                subAreas: ['Shankarpally Road', 'Tangatur', 'Pillar 120 Corridor'],
                keywords: 'villas in mokila, gated community villas mokila, villa plots in mokila, luxury duplex mokila',
                popularTypes: ['Luxury Duplex Villas', 'Villa Plots', 'Gated Enclaves'],
                priceRange: '₹1.2 Cr - ₹4.5 Cr'
            },
            {
                name: 'Shankarpally',
                displayName: 'Shankarpally (HMDA & DTCP Plots)',
                subAreas: ['BDL Road', 'IIT Hyderabad Corridor', 'Mokila Extension'],
                keywords: 'plots in shankarpally, hmda plots in shankarpally, open plots shankarpally, dtcp plots near shankarpally',
                popularTypes: ['HMDA Open Plots', 'Farm Plots', 'Budget Villas'],
                priceRange: '₹70L - ₹1.8 Cr'
            },
            {
                name: 'Kollur',
                displayName: 'Kollur & Velimela (ORR Exit 2)',
                subAreas: ['Velimela', 'Edulanagula Pally', 'ORR Service Road'],
                keywords: 'plots in kollur, flats in kollur, kollur orr exit 2 properties, apartments in velimela',
                popularTypes: ['Gated High-Rises', 'HMDA Layouts', 'Townships'],
                priceRange: '₹75L - ₹2.8 Cr'
            },
            {
                name: 'Madhapur',
                displayName: 'Madhapur & Hitec City',
                subAreas: ['Hitec City', 'Cyber Towers', 'Kavuri Hills', 'Ayyappa Society'],
                keywords: 'flats in madhapur, apartments near hitec city, commercial office madhapur, luxury flats hitec city',
                popularTypes: ['Commercial Towers', 'Serviced Apartments', 'Luxury Flats'],
                priceRange: '₹1.2 Cr - ₹5 Cr'
            },
            {
                name: 'Kondapur',
                displayName: 'Kondapur & Kothaguda',
                subAreas: ['Botanical Garden Road', 'Raghavendra Colony', 'Silpa Park'],
                keywords: 'flats in kondapur, 3bhk flats in kondapur, kondapur gated community, botanical garden flats',
                popularTypes: ['3 BHK Flats', '2 BHK Flats', 'Boutique Apartments'],
                priceRange: '₹85L - ₹3.2 Cr'
            },
            {
                name: 'Manikonda',
                displayName: 'Manikonda & Lanco Hills',
                subAreas: ['Lanco Hills', 'Puppalaguda', 'Secretariat Colony'],
                keywords: 'flats in manikonda, apartments in lanco hills, manikonda 2bhk flats, buy flat in manikonda',
                popularTypes: ['High-Rise Apartments', '2 & 3 BHK Flats', 'Commercial'],
                priceRange: '₹75L - ₹2.5 Cr'
            },
            {
                name: 'Nallagandla',
                displayName: 'Nallagandla & Gopanpally',
                subAreas: ['Aparna Sarovar Corridor', 'Gopanpally Thanda', 'HCU Road'],
                keywords: 'flats in nallagandla, apartments near hcu, 3bhk nallagandla, aparna sarovar',
                popularTypes: ['Gated Apartments', '3 BHK Flats', 'Lakeview Homes'],
                priceRange: '₹90L - ₹3.1 Cr'
            },
            {
                name: 'Jubilee Hills',
                displayName: 'Jubilee Hills & Film Nagar',
                subAreas: ['Road No 36', 'Road No 45', 'Film Nagar', 'Prashasan Nagar'],
                keywords: 'villas in jubilee hills, luxury bungalows jubilee hills, commercial space jubilee hills, film nagar flats',
                popularTypes: ['Palatial Villas', 'Ultra-Luxury Penthouses', 'Commercial Hubs'],
                priceRange: '₹3 Cr - ₹6 Cr+'
            },
            {
                name: 'Banjara Hills',
                displayName: 'Banjara Hills',
                subAreas: ['Road No 1', 'Road No 12', 'Taj Krishna Corridor', 'MLA Colony'],
                keywords: 'properties in banjara hills, luxury flats banjara hills, banjara hills apartments, villas in banjara hills',
                popularTypes: ['Luxury Apartments', 'Commercial Showrooms', 'Independent Villas'],
                priceRange: '₹2.5 Cr - ₹6 Cr+'
            },
            {
                name: 'Gandipet',
                displayName: 'Gandipet & Osman Sagar',
                subAreas: ['CBIT Corridor', 'Ocean Park Road', 'Khanapur'],
                keywords: 'villas in gandipet, lake view villas gandipet, luxury farmhouses gandipet, resort villas hyderabad',
                popularTypes: ['Lakeside Villas', 'Luxury Enclaves', 'Farmhouses'],
                priceRange: '₹2 Cr - ₹6 Cr'
            },
            {
                name: 'Miyapur',
                displayName: 'Miyapur & Chandanagar',
                subAreas: ['Miyapur Metro', 'Allwyn Colony', 'Mayuri Nagar'],
                keywords: 'flats in miyapur, miyapur metro apartments, 2bhk flats in miyapur, buy flat in chandanagar',
                popularTypes: ['2 & 3 BHK Flats', 'Gated Communities', 'Metro-Facing Homes'],
                priceRange: '₹70L - ₹1.8 Cr'
            },
            {
                name: 'Patancheru',
                displayName: 'Patancheru & Isnapur',
                subAreas: ['Isnapur Junction', 'Muthangi', 'Pashamylaram Corridor'],
                keywords: 'plots in patancheru, flats in patancheru, isnapur hmda plots, muthangi open plots',
                popularTypes: ['Affordable Flats', 'HMDA Layouts', 'Industrial Land'],
                priceRange: '₹70L - ₹1.6 Cr'
            }
        ]
    },
    {
        id: 'north',
        zone: 'North Hyderabad',
        corridorTitle: 'Medchal Highway, Educational & Green Belt Corridor',
        description: 'Scenic residential corridor along NH-44 featuring plotted developments, education hubs, and affordable luxury apartments.',
        localities: [
            {
                name: 'Kompally',
                displayName: 'Kompally & Suchitra',
                subAreas: ['Suchitra Junction', 'Cine Planet Corridor', 'Dulapally'],
                keywords: 'villas in kompally, flats in kompally, hmda plots in kompally, kompally gated community',
                popularTypes: ['Villas', 'HMDA Plots', '2 & 3 BHK Flats'],
                priceRange: '₹70L - ₹3.2 Cr'
            },
            {
                name: 'Bachupally',
                displayName: 'Bachupally (Education Corridor)',
                subAreas: ['Silver Oaks Road', 'Mallampet', 'Bollaram Road'],
                keywords: 'flats in bachupally, 2bhk in bachupally, 3bhk bachupally, apartments near silver oaks',
                popularTypes: ['2 & 3 BHK Gated Flats', 'Smart Homes', 'Townships'],
                priceRange: '₹70L - ₹1.9 Cr'
            },
            {
                name: 'Pragathi Nagar',
                displayName: 'Pragathi Nagar & JNTU Corridor',
                subAreas: ['Kukatpally Extension', 'Lake View Enclave', 'JNTU Road'],
                keywords: 'flats in pragathi nagar, pragathi nagar apartments for sale, 2bhk flat pragathi nagar',
                popularTypes: ['Residential Flats', 'Independent Floors', '2 BHK Homes'],
                priceRange: '₹70L - ₹1.7 Cr'
            },
            {
                name: 'Nizampet',
                displayName: 'Nizampet & Bandari Layout',
                subAreas: ['Nizampet Village', 'Bandari Layout', 'Venkatraya Nagar'],
                keywords: 'flats in nizampet, nizampet apartments, 2bhk flats in nizampet, nizampet independent house',
                popularTypes: ['Apartments', 'Independent Houses', 'Rental Assets'],
                priceRange: '₹70L - ₹1.6 Cr'
            },
            {
                name: 'Bowrampet',
                displayName: 'Bowrampet & Gandi Maisamma',
                subAreas: ['Gandi Maisamma', 'ORR Exit 5', 'Dundigal Road'],
                keywords: 'villas in bowrampet, flats in bowrampet, bowrampet hmda plots, dundigal plots',
                popularTypes: ['Duplex Villas', 'Affordable Apartments', 'Plotted Townships'],
                priceRange: '₹70L - ₹2.2 Cr'
            },
            {
                name: 'Medchal',
                displayName: 'Medchal & NH-44 Corridor',
                subAreas: ['Medchal Checkpost', 'Kandlakoya IT Park', 'ORR Junction'],
                keywords: 'plots in medchal, hmda plots medchal, kandlakoya it park plots, medchal farmland',
                popularTypes: ['HMDA Open Plots', 'Commercial Land', 'Farmhouses'],
                priceRange: '₹70L - ₹1.9 Cr'
            },
            {
                name: 'Kukatpally',
                displayName: 'Kukatpally & KPHB Colony',
                subAreas: ['KPHB Phase 1 to 9', 'Forum Sujana Corridor', 'Y Junction'],
                keywords: 'flats in kukatpally, kphb colony apartments, commercial space kukatpally, 3bhk in kphb',
                popularTypes: ['Gated Flats', 'Commercial Showrooms', 'Metro-Connected Homes'],
                priceRange: '₹85L - ₹3.5 Cr'
            },
            {
                name: 'Sainikpuri',
                displayName: 'Sainikpuri & AS Rao Nagar',
                subAreas: ['AS Rao Nagar', 'Yapral', 'Defence Colony', 'Vayupuri'],
                keywords: 'independent house in sainikpuri, flats in as rao nagar, sainikpuri villas, yapral plots',
                popularTypes: ['Independent Houses', 'Boutique Apartments', 'Retirement Enclaves'],
                priceRange: '₹75L - ₹2.8 Cr'
            },
            {
                name: 'Bowenpally',
                displayName: 'Bowenpally & Alwal',
                subAreas: ['Old Bowenpally', 'Hasmathpet', 'Alwal Hills', 'Bolarum'],
                keywords: 'properties in bowenpally, flats in alwal, bowenpally plots, independent house in bowenpally',
                popularTypes: ['Residential Homes', 'Commercial Plots', 'Flats'],
                priceRange: '₹75L - ₹2.4 Cr'
            }
        ]
    },
    {
        id: 'south',
        zone: 'South Hyderabad',
        corridorTitle: 'Airport Corridor, Aerospace & Bengaluru Highway Growth',
        description: 'Fastest-appreciating infrastructure corridor backed by Rajiv Gandhi International Airport, Aerospace SEZs, and Outer Ring Road.',
        localities: [
            {
                name: 'Shamshabad',
                displayName: 'Shamshabad (Airport Zone)',
                subAreas: ['Airport Road', 'Mamidipally', 'Satamrai', 'ORR Exit 16'],
                keywords: 'plots in shamshabad, shamshabad open plots near airport, hmda plots shamshabad, villa plots shamshabad',
                popularTypes: ['HMDA Villa Plots', 'Commercial Warehousing', 'Gated Townships'],
                priceRange: '₹75L - ₹3.5 Cr'
            },
            {
                name: 'Adibatla',
                displayName: 'Adibatla (TCS & Aerospace SEZ)',
                subAreas: ['TCS Adibatla', 'Tata Boeing Corridor', 'Kongara Kalan Road'],
                keywords: 'plots in adibatla, hmda plots near tcs adibatla, adibatla open plots, flats in adibatla',
                popularTypes: ['Plotted Townships', 'HMDA Layouts', 'Staff Housing'],
                priceRange: '₹70L - ₹1.8 Cr'
            },
            {
                name: 'Maheshwaram',
                displayName: 'Maheshwaram & Tukkuguda',
                subAreas: ['Fab City', 'Tukkuguda ORR Exit 14', 'Mankhal Industrial Area'],
                keywords: 'plots in maheshwaram, dtcp plots maheshwaram, fab city plots, tukkuguda gated community',
                popularTypes: ['HMDA Layouts', 'Villa Plots', 'Industrial Parcels'],
                priceRange: '₹70L - ₹2.1 Cr'
            },
            {
                name: 'Shadnagar',
                displayName: 'Shadnagar (Bengaluru NH-44 Growth)',
                subAreas: ['Kothur', 'Farooqnagar', 'Timmapur', 'Symbiosis Corridor'],
                keywords: 'plots in shadnagar, dtcp plots in shadnagar, open plots near shadnagar, farmland shadnagar',
                popularTypes: ['DTCP Approved Plots', 'Farmland', 'Highway Commercial'],
                priceRange: '₹70L - ₹1.5 Cr'
            },
            {
                name: 'Rajendra Nagar',
                displayName: 'Rajendra Nagar & Kismatpur',
                subAreas: ['Kismatpur', 'Bandlaguda Jagir', 'Himayat Sagar', 'TSPA Junction'],
                keywords: 'villas in kismatpur, flats in rajendra nagar, bandlaguda jagir apartments, himayat sagar villas',
                popularTypes: ['Gated Villas', 'Lakeview Apartments', 'Plotted Communities'],
                priceRange: '₹85L - ₹3.9 Cr'
            },
            {
                name: 'Tukkuguda',
                displayName: 'Tukkuguda (ORR Exit 14)',
                subAreas: ['Srisailam Highway', 'Fab City Road', 'Foxconn Zone'],
                keywords: 'plots in tukkuguda, villas in tukkuguda, tukkuguda orr exit 14 properties',
                popularTypes: ['Gated Villas', 'Plotted Layouts', 'Commercial'],
                priceRange: '₹75L - ₹2.6 Cr'
            }
        ]
    },
    {
        id: 'east',
        zone: 'East Hyderabad',
        corridorTitle: 'Warangal & Vijayawada Highways, Pocharam IT SEZ Corridor',
        description: 'Rapidly emerging eastern corridor anchored by Infosys SEZ, Uppal commercial center, and Vijayawada Highway connectivity.',
        localities: [
            {
                name: 'Uppal',
                displayName: 'Uppal & Boduppal',
                subAreas: ['Uppal Metro', 'Ramanthapur', 'Boduppal', 'Nagole Corridor'],
                keywords: 'flats in uppal, apartments in boduppal, uppal metro flats, 2bhk in uppal',
                popularTypes: ['2 & 3 BHK Flats', 'Commercial Spaces', 'Independent Houses'],
                priceRange: '₹70L - ₹2.1 Cr'
            },
            {
                name: 'Pocharam',
                displayName: 'Pocharam (Infosys SEZ) & Ghatkesar',
                subAreas: ['Infosys Campus', 'Sanskrithi Township', 'Ghatkesar ORR Exit 9'],
                keywords: 'flats in pocharam, apartments near infosys pocharam, plots in ghatkesar, ghatkesar hmda plots',
                popularTypes: ['IT Professional Housing', 'HMDA Plotted Enclaves', 'Townships'],
                priceRange: '₹70L - ₹1.7 Cr'
            },
            {
                name: 'Peerzadiguda',
                displayName: 'Peerzadiguda & Medipally',
                subAreas: ['Medipally', 'Chengicherla', 'Warangal Highway'],
                keywords: 'flats in peerzadiguda, medipally apartments, peerzadiguda 2bhk, warangal highway plots',
                popularTypes: ['Residential Apartments', 'Independent Houses', 'Plots'],
                priceRange: '₹70L - ₹1.6 Cr'
            },
            {
                name: 'LB Nagar',
                displayName: 'LB Nagar & Nagole',
                subAreas: ['Kothapet', 'Dilsukhnagar', 'Nagole Metro', 'Saroornagar'],
                keywords: 'flats in lb nagar, apartments in nagole, lb nagar commercial space, 3bhk in kothapet',
                popularTypes: ['Metro Connectivity Flats', 'Commercial Hubs', 'Residential Plots'],
                priceRange: '₹75L - ₹2.8 Cr'
            },
            {
                name: 'Hayathnagar',
                displayName: 'Hayathnagar & Vanasthalipuram',
                subAreas: ['Vanasthalipuram', 'Pedda Amberpet', 'Ramoji Film City Corridor'],
                keywords: 'plots in hayathnagar, vanasthalipuram flats, pedda amberpet open plots, vijayawada highway properties',
                popularTypes: ['Plotted Layouts', 'Independent Houses', 'Affordable Flats'],
                priceRange: '₹70L - ₹1.8 Cr'
            }
        ]
    },
    {
        id: 'central',
        zone: 'Central Hyderabad & Secunderabad',
        corridorTitle: 'Prime Heritage, Commercial Core & Diplomatic Hubs',
        description: 'Established heart of the twin cities offering elite connectivity, mature infrastructure, and luxury central residences.',
        localities: [
            {
                name: 'Begumpet',
                displayName: 'Begumpet & Somajiguda',
                subAreas: ['Mayfair Corridor', 'Raj Bhavan Road', 'Prakash Nagar'],
                keywords: 'flats in begumpet, apartments in somajiguda, begumpet commercial office, raj bhavan road property',
                popularTypes: ['Luxury Central Flats', 'Commercial Offices', 'Penthouses'],
                priceRange: '₹1.1 Cr - ₹4.5 Cr'
            },
            {
                name: 'Ameerpet',
                displayName: 'Ameerpet & Punjagutta',
                subAreas: ['Punjagutta Circle', 'Nagarjuna Circle', 'Srinagar Colony'],
                keywords: 'commercial property in ameerpet, flats in punjagutta, srinagar colony apartments',
                popularTypes: ['Commercial Spaces', 'Central Apartments', 'Boutique Floors'],
                priceRange: '₹95L - ₹3.8 Cr'
            },
            {
                name: 'Secunderabad',
                displayName: 'Secunderabad & Marredpally',
                subAreas: ['West Marredpally', 'East Marredpally', 'Sindhi Colony', 'Karkhana'],
                keywords: 'flats in marredpally, properties in secunderabad, independent house secunderabad, karkhana apartments',
                popularTypes: ['Independent Houses', 'Premium Apartments', 'Boutique Villas'],
                priceRange: '₹90L - ₹3.6 Cr'
            },
            {
                name: 'Tarnaka',
                displayName: 'Tarnaka & Habsiguda',
                subAreas: ['Habsiguda', 'Nacharam', 'Osmania University Corridor'],
                keywords: 'flats in tarnaka, habsiguda apartments, independent house in tarnaka',
                popularTypes: ['Residential Flats', 'Independent Houses', 'Academic Enclaves'],
                priceRange: '₹75L - ₹2.2 Cr'
            }
        ]
    }
];

// Flat list of all canonical locality names
const ALL_LOCALITIES = HYDERABAD_CORRIDORS.flatMap(c => c.localities.map(l => l.name));

// Map of canonical locality name to its full metadata
const LOCALITY_MAP = new Map();
HYDERABAD_CORRIDORS.forEach(corridor => {
    corridor.localities.forEach(loc => {
        LOCALITY_MAP.set(loc.name.toLowerCase(), {
            ...loc,
            zoneId: corridor.id,
            zone: corridor.zone,
            corridorTitle: corridor.corridorTitle
        });
    });
});

/**
 * Top SEO high-volume search pills & keywords
 */
const POPULAR_SEO_SEARCH_PILLS = [
    { label: 'Plots in Shankarpally', url: '/properties?locality=Shankarpally&category=residential_plot', tag: 'High ROI' },
    { label: 'Luxury Villas in Kokapet', url: '/properties?locality=Kokapet&category=villa', tag: 'Luxury' },
    { label: '3 BHK in Tellapur', url: '/properties?locality=Tellapur&bedrooms=3&category=apartment', tag: 'Trending' },
    { label: 'Flats in Gachibowli', url: '/properties?locality=Gachibowli&category=apartment', tag: 'IT Hub' },
    { label: 'Villas in Mokila', url: '/properties?locality=Mokila&category=villa', tag: 'Gated' },
    { label: 'HMDA Plots in Shamshabad', url: '/properties?locality=Shamshabad&category=residential_plot', tag: 'Airport' },
    { label: '2 BHK in Bachupally', url: '/properties?locality=Bachupally&bedrooms=2&category=apartment', tag: 'From ₹70L' },
    { label: 'Financial District Flats', url: '/properties?locality=Financial+District', tag: 'Skyline' },
    { label: 'Plots in Kompally', url: '/properties?locality=Kompally&category=residential_plot', tag: 'Clear Title' },
    { label: 'Villas in Narsingi', url: '/properties?locality=Narsingi&category=villa', tag: 'ORR Exit' },
    { label: 'Plots in Kollur', url: '/properties?locality=Kollur&category=residential_plot', tag: 'Neopolis 10m' },
    { label: 'Flats in Manikonda', url: '/properties?locality=Manikonda&category=apartment', tag: 'Family' },
    { label: 'Commercial in Madhapur', url: '/properties?locality=Madhapur&category=commercial', tag: 'Grade A' },
    { label: 'Plots in Adibatla', url: '/properties?locality=Adibatla&category=residential_plot', tag: 'Aerospace' },
    { label: 'DTCP Plots in Shadnagar', url: '/properties?locality=Shadnagar&category=residential_plot', tag: 'Affordable' },
    { label: 'Flats in Pragathi Nagar', url: '/properties?locality=Pragathi+Nagar&category=apartment', tag: 'Metro' },
    { label: 'Villas in Gandipet', url: '/properties?locality=Gandipet&category=villa', tag: 'Lakeside' },
    { label: '4 BHK Luxury Sky Homes', url: '/properties?bedrooms=4&category=apartment', tag: 'Ultra Luxury' }
];

/**
 * Global SEO Meta tags for Hyderabad real estate searches
 */
const HYDERABAD_SEO_META = {
    defaultTitle: 'Verified Real Estate Properties All Over Hyderabad — SV Real Estates',
    defaultKeywords: 'real estate hyderabad, properties in hyderabad, flats in gachibowli, luxury villas in kokapet, hmda open plots in shankarpally, tellapur gated community, shamshabad plots near airport, bachupally 2bhk flats, mokila villas for sale, financial district hyderabad apartments, kompally plots and villas, narsingi luxury flats, shadnagar farmland and plots, adibatla plots, buy house in hyderabad, rera registered projects hyderabad, sv real estate hyderabad',
    defaultDescription: 'Explore verified real estate properties all over Hyderabad (₹70 Lakhs to ₹6 Crore). Discover luxury gated villas, HMDA & DTCP plots, and 2BHK, 3BHK, 4BHK apartments in Kokapet, Tellapur, Gachibowli, Shankarpally, Mokila, Kompally, and Shamshabad with 100% clear titles.'
};

/**
 * Returns metadata for a locality if found (case-insensitive)
 */
function getLocalityInfo(name) {
    if (!name) return null;
    return LOCALITY_MAP.get(String(name).trim().toLowerCase()) || null;
}

/**
 * Returns all corridor groups
 */
function getCorridors() {
    return HYDERABAD_CORRIDORS;
}

/**
 * Returns flat array of all locality objects with zone metadata
 */
function getAllLocalitiesList() {
    return Array.from(LOCALITY_MAP.values());
}

module.exports = {
    HYDERABAD_CORRIDORS,
    ALL_LOCALITIES,
    POPULAR_SEO_SEARCH_PILLS,
    HYDERABAD_SEO_META,
    getLocalityInfo,
    getCorridors,
    getAllLocalitiesList
};
