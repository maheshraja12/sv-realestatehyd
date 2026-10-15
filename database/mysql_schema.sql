-- ==============================================================
-- SV Real Estates Hyderabad — Complete MySQL Database Schema
-- Compatible with MySQL 8.0, TiDB Serverless, Aiven, Railway, AWS RDS
-- ==============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table (Admin / Agents)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'agent') NOT NULL DEFAULT 'agent',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Properties Catalog
CREATE TABLE IF NOT EXISTS properties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    category ENUM(
        'villa', 'residential_plot', 'apartment', 'independent_house',
        'commercial', 'agricultural_land', 'rental'
    ) NOT NULL,
    purpose ENUM('sale', 'rent', 'lease') NOT NULL DEFAULT 'sale',
    short_description TEXT NULL,
    description LONGTEXT NULL,
    price DECIMAL(15, 2) NULL,
    price_negotiable TINYINT(1) NOT NULL DEFAULT 0,

    -- Location
    state VARCHAR(100) DEFAULT 'Telangana',
    city VARCHAR(100) DEFAULT 'Hyderabad',
    locality VARCHAR(150) NULL,
    full_address TEXT NULL,
    pin_code VARCHAR(20) NULL,
    map_link TEXT NULL,
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,

    -- Property Specs
    plot_area DECIMAL(10, 2) NULL,
    built_up_area DECIMAL(10, 2) NULL,
    carpet_area DECIMAL(10, 2) NULL,
    area_unit ENUM('sq_ft', 'sq_yd', 'acres', 'guntas', 'cents') DEFAULT 'sq_ft',
    bedrooms INT NULL,
    bathrooms INT NULL,
    balconies INT NULL,
    floors INT NULL,
    facing VARCHAR(30) NULL,
    furnishing ENUM('unfurnished', 'semi_furnished', 'fully_furnished') NULL,
    parking VARCHAR(100) NULL,

    -- Plot Details
    plot_dimensions VARCHAR(100) NULL,
    road_width VARCHAR(50) NULL,
    land_use_category VARCHAR(100) NULL,
    approval_details VARCHAR(255) NULL,

    -- Villa Details
    private_garden TINYINT(1) DEFAULT 0,
    private_pool TINYINT(1) DEFAULT 0,

    -- Media
    virtual_tour_link TEXT NULL,
    brochure_url TEXT NULL,

    -- Amenities (JSON string array)
    amenities JSON NULL,

    -- Status & Publication
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    availability ENUM('available', 'sold', 'rented', 'upcoming') DEFAULT 'available',
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    published_at DATETIME NULL,

    -- SEO
    seo_title VARCHAR(255) NULL,
    seo_description TEXT NULL,

    -- Internal
    admin_notes TEXT NULL,
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_prop_status (status),
    INDEX idx_prop_category (category),
    INDEX idx_prop_locality (locality),
    INDEX idx_prop_featured (is_featured),
    INDEX idx_prop_published (published_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Property Images
CREATE TABLE IF NOT EXISTS property_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    image_url TEXT NOT NULL,
    caption VARCHAR(255) NULL,
    is_cover TINYINT(1) NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    INDEX idx_pi_property (property_id),
    INDEX idx_pi_cover (property_id, is_cover)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Customer Enquiries & Leads (Core CRM)
CREATE TABLE IF NOT EXISTS enquiries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_code VARCHAR(30) NULL,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(30) NOT NULL,
    email VARCHAR(150) NULL,
    appointment_date VARCHAR(50) NULL,
    appointment_time VARCHAR(50) NULL,
    property_requirement VARCHAR(200) NULL,
    property_id INT NULL,
    budget_range VARCHAR(100) NULL,
    message TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'New',
    source VARCHAR(50) DEFAULT 'website',
    assigned_agent_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_enq_status (status),
    INDEX idx_enq_created (created_at DESC),
    INDEX idx_enq_phone (phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Appointments & Site Visits
CREATE TABLE IF NOT EXISTS appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_code VARCHAR(30) NOT NULL UNIQUE,
    property_id INT NULL,
    customer_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(150) NULL,
    requested_date VARCHAR(50) NOT NULL,
    requested_time VARCHAR(50) NOT NULL,
    confirmed_date VARCHAR(50) NULL,
    confirmed_time VARCHAR(50) NULL,
    status ENUM('requested', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'requested',
    notes TEXT NULL,
    assigned_agent_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_apt_status (status),
    INDEX idx_apt_date (requested_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Platform Settings
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255) NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notif_user (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
