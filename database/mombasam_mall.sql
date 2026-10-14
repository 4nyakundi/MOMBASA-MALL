-- ============================================================
--  MOMBASA MALL â€” FULL MYSQL DATABASE SCHEMA
--  Database : mombasam_mall
--  User     : mombasam_admall
--  Password : @dmin26PHP
--  Generated: 2026-10-14
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+03:00";
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS `mombasam_mall`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `mombasam_mall`;

-- ============================================================
-- TABLE 1: admin_users
-- Stores dashboard administrator accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name`     VARCHAR(150) NOT NULL,
  `email`         VARCHAR(200) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'bcrypt hash',
  `phone`         VARCHAR(30)  DEFAULT NULL,
  `role`          ENUM('superadmin','admin','editor','moderator') NOT NULL DEFAULT 'editor',
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
  `last_login`    DATETIME DEFAULT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_role`  (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed initial admin and staff accounts
-- Supports both primary admin and legacy admin accounts
INSERT IGNORE INTO `admin_users` (`full_name`, `email`, `password_hash`, `phone`, `role`, `is_active`)
VALUES 
(
  'Mall Super Administrator',
  'admin@mombasamall.co.ke',
  '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  '+254 790 964 002',
  'superadmin',
  1
),
(
  'Mombasa Mall Legacy Admin',
  'mombasamall01@gmail.com',
  '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  '+254 790 964 002',
  'superadmin',
  1
),
(
  'Amina Hassan',
  'events@mombasamall.co.ke',
  '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  '+254 712 345 678',
  'editor',
  1
),
(
  'David Mwangi',
  'advertising@mombasamall.co.ke',
  '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  '+254 722 987 654',
  'moderator',
  1
);


-- ============================================================
-- TABLE 2: stores
-- Mall tenant directory â€” 51 stores across 5 floors
-- ============================================================
CREATE TABLE IF NOT EXISTS `stores` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(200) NOT NULL,
  `unit_number` VARCHAR(50)  DEFAULT NULL COMMENT 'e.g. GF-04, 1F-12',
  `floor`       ENUM('Ground Floor','First Floor','Second Floor','Third Floor','Basement Parking') NOT NULL DEFAULT 'Ground Floor',
  `category`    ENUM('retail','food','services','tech','beauty','fashion') NOT NULL DEFAULT 'retail',
  `phone`       VARCHAR(30)  DEFAULT NULL,
  `email`       VARCHAR(200) DEFAULT NULL,
  `website`     VARCHAR(255) DEFAULT NULL,
  `description` TEXT         DEFAULT NULL,
  `logo_url`    VARCHAR(500) DEFAULT NULL,
  `status`      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `sort_order`  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_floor`    (`floor`),
  KEY `idx_category` (`category`),
  KEY `idx_status`   (`status`),
  KEY `idx_sort`     (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE 3: store_photos
-- Multiple photos per store
-- ============================================================
CREATE TABLE IF NOT EXISTS `store_photos` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`   INT UNSIGNED NOT NULL,
  `image_url`  VARCHAR(500) NOT NULL,
  `caption`    VARCHAR(255) DEFAULT NULL,
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_store_id` (`store_id`),
  CONSTRAINT `fk_store_photos_store`
    FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE 4: contact_leads
-- From: about-us.html #contact-enquiry-form
-- Fields: name, email, phone, subject, message
-- ============================================================
CREATE TABLE IF NOT EXISTS `contact_leads` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ref_code`    VARCHAR(30)  NOT NULL UNIQUE COMMENT 'Auto-generated: CLxxx',
  `name`        VARCHAR(150) NOT NULL,
  `email`       VARCHAR(200) NOT NULL,
  `phone`       VARCHAR(30)  DEFAULT NULL,
  `subject`     ENUM(
                  'General Inquiry',
                  'Leasing Inquiry',
                  'Store Information',
                  'Events',
                  'Complaint',
                  'Other'
                ) NOT NULL DEFAULT 'General Inquiry',
  `message`     TEXT NOT NULL,
  `status`      ENUM('new','contacted','closed') NOT NULL DEFAULT 'new',
  `admin_notes` TEXT DEFAULT NULL,
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status`       (`status`),
  KEY `idx_submitted_at` (`submitted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE 5: led_leads
-- From: led-advertising/index.html #led-form
-- Fields: brand, contact, email, phone, package, duration, notes
-- ============================================================
CREATE TABLE IF NOT EXISTS `led_leads` (
  `id`                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ref_code`              VARCHAR(30)  NOT NULL UNIQUE COMMENT 'Auto-generated: LEDxxx',
  `business_name`         VARCHAR(200) NOT NULL COMMENT 'Brand / Campaign Name',
  `contact_name`          VARCHAR(150) NOT NULL,
  `email`                 VARCHAR(200) NOT NULL,
  `phone`                 VARCHAR(30)  NOT NULL,
  `package_requested`     ENUM(
                            'Full Package (Outdoor + Indoor Network)',
                            'Outdoor Mega Screen (1280x720px)',
                            'Indoor Screen Network (4 Screens)'
                          ) NOT NULL DEFAULT 'Full Package (Outdoor + Indoor Network)',
  `duration_requested`    ENUM(
                            '2 Weeks Duration',
                            '1 Month (30 Days)',
                            'Quarterly (3 Months)'
                          ) NOT NULL DEFAULT '1 Month (30 Days)',
  `duration_code`         VARCHAR(5) DEFAULT '1m' COMMENT '2w | 1m | 3m',
  `slot_length`           VARCHAR(80) DEFAULT '15s every 3m (24/7)',
  `estimated_cost_kes`    DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Excl. VAT',
  `estimated_cost_vat`    DECIMAL(12,2) DEFAULT 0.00 COMMENT 'VAT at 16%',
  `estimated_cost_total`  DECIMAL(12,2) DEFAULT 0.00 COMMENT 'Incl. VAT',
  `notes`                 TEXT DEFAULT NULL COMMENT 'Campaign notes & preferred start date',
  `status`                ENUM('new','contacted','won','lost') NOT NULL DEFAULT 'new',
  `admin_notes`           TEXT DEFAULT NULL,
  `submitted_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status`        (`status`),
  KEY `idx_submitted_at`  (`submitted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE 6: activation_leads
-- From: activations/index.html #activation-booking-form
-- Covers 4 zones: Atrium, Forecourt, Kiosk, Family Zone
-- ============================================================
CREATE TABLE IF NOT EXISTS `activation_leads` (
  `id`                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ref_code`             VARCHAR(30)  NOT NULL UNIQUE COMMENT 'Auto-generated: ACTxxx',
  `company_name`         VARCHAR(200) NOT NULL,
  `contact_name`         VARCHAR(150) NOT NULL,
  `email`                VARCHAR(200) NOT NULL,
  `phone`                VARCHAR(30)  NOT NULL,
  `activation_type`      ENUM(
                           'Central Atrium Showcase',
                           'Outdoor Forecourt Roadshow',
                           'Pop-Up Retail Kiosk',
                           'Sampling & Product Demo',
                           'Family Zone Sponsorship'
                         ) NOT NULL DEFAULT 'Central Atrium Showcase',
  `booking_start_date`   DATE NOT NULL,
  `duration_days`        SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `booking_end_date`     DATE GENERATED ALWAYS AS
                           (DATE_ADD(`booking_start_date`, INTERVAL (`duration_days` - 1) DAY)) STORED
                         COMMENT 'Computed from start + duration',
  `concept_description`  TEXT NOT NULL,
  `status`               ENUM('new','contacted','won','lost') NOT NULL DEFAULT 'new',
  `admin_notes`          TEXT DEFAULT NULL,
  `submitted_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status`             (`status`),
  KEY `idx_booking_start_date` (`booking_start_date`),
  KEY `idx_submitted_at`       (`submitted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE 7: playon_bookings
-- From: playon/index.html #bookingForm
-- Kids indoor playground bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS `playon_bookings` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ref_code`            VARCHAR(30)  NOT NULL UNIQUE COMMENT 'Auto-generated: POxxx',
  `parent_name`         VARCHAR(150) NOT NULL,
  `phone`               VARCHAR(30)  NOT NULL,
  `email`               VARCHAR(200) NOT NULL,
  `booking_type`        ENUM(
                          'session',
                          'birthday',
                          'school',
                          'private'
                        ) NOT NULL DEFAULT 'session',
  `booking_date`        DATE NOT NULL,
  `session_time`        VARCHAR(80)  NOT NULL COMMENT 'e.g. 2:00 PM - 4:00 PM',
  `child_count`         TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `adult_count`         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `is_weekend`          TINYINT(1) GENERATED ALWAYS AS
                          (DAYOFWEEK(`booking_date`) IN (1, 7)) STORED
                        COMMENT '1 if Saturday or Sunday',
  `price_per_child`     SMALLINT UNSIGNED GENERATED ALWAYS AS
                          (IF(DAYOFWEEK(`booking_date`) IN (1, 7), 1500, 1000)) STORED
                        COMMENT 'KES 1000 weekday, 1500 weekend',
  `price_adults`        SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'KES 500 per adult',
  `estimated_total_kes` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `special_requests`    TEXT DEFAULT NULL,
  `status`              ENUM('new','confirmed','cancelled') NOT NULL DEFAULT 'new',
  `admin_notes`         TEXT DEFAULT NULL,
  `submitted_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status`       (`status`),
  KEY `idx_booking_date` (`booking_date`),
  KEY `idx_submitted_at` (`submitted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE 8: events
-- Admin-managed mall events calendar
-- ============================================================
CREATE TABLE IF NOT EXISTS `events` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`          VARCHAR(250) NOT NULL,
  `venue`          VARCHAR(200) DEFAULT 'Mombasa Mall',
  `event_date`     DATETIME NOT NULL,
  `event_end_date` DATETIME DEFAULT NULL,
  `description`    TEXT DEFAULT NULL,
  `image_url`      VARCHAR(500) DEFAULT NULL,
  `status`         ENUM('upcoming','past','cancelled') NOT NULL DEFAULT 'upcoming',
  `created_by`     INT UNSIGNED DEFAULT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status`     (`status`),
  KEY `idx_event_date` (`event_date`),
  CONSTRAINT `fk_events_admin`
    FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE 9: event_photos
-- ============================================================
CREATE TABLE IF NOT EXISTS `event_photos` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id`   INT UNSIGNED NOT NULL,
  `image_url`  VARCHAR(500) NOT NULL,
  `caption`    VARCHAR(255) DEFAULT NULL,
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_event_id` (`event_id`),
  CONSTRAINT `fk_event_photos_event`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE 10: blog_posts
-- Mall journal & articles
-- ============================================================
CREATE TABLE IF NOT EXISTS `blog_posts` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`          VARCHAR(300) NOT NULL,
  `slug`           VARCHAR(350) NOT NULL UNIQUE,
  `excerpt`        TEXT DEFAULT NULL,
  `body`           LONGTEXT DEFAULT NULL,
  `image_url`      VARCHAR(500) DEFAULT NULL,
  `author`         VARCHAR(150) DEFAULT 'Mombasa Mall Team',
  `published_date` DATE DEFAULT NULL,
  `status`         ENUM('published','draft') NOT NULL DEFAULT 'draft',
  `created_by`     INT UNSIGNED DEFAULT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_slug`   (`slug`),
  KEY   `idx_status`      (`status`),
  KEY   `idx_published`   (`published_date`),
  CONSTRAINT `fk_blog_admin`
    FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE 11: reviews
-- Customer testimonials & moderation queue
-- ============================================================
CREATE TABLE IF NOT EXISTS `reviews` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reviewer_name`    VARCHAR(150) NOT NULL,
  `reviewer_email`   VARCHAR(200) DEFAULT NULL,
  `store_id`         INT UNSIGNED DEFAULT NULL COMMENT 'Nullable â€” general mall review',
  `store_name_typed` VARCHAR(200) DEFAULT NULL COMMENT 'What visitor typed if no store_id',
  `rating`           TINYINT UNSIGNED NOT NULL DEFAULT 5
                       COMMENT '1â€“5 stars',
  `review_text`      TEXT NOT NULL,
  `status`           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `admin_notes`      TEXT DEFAULT NULL,
  `submitted_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status`    (`status`),
  KEY `idx_store_id`  (`store_id`),
  KEY `idx_rating`    (`rating`),
  CONSTRAINT `fk_reviews_store`
    FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_rating` CHECK (`rating` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE 12: gallery
-- Photo gallery â€” admin managed
-- ============================================================
CREATE TABLE IF NOT EXISTS `gallery` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`       VARCHAR(200) DEFAULT NULL,
  `image_url`   VARCHAR(500) NOT NULL,
  `category`    VARCHAR(100) DEFAULT 'General',
  `caption`     TEXT DEFAULT NULL,
  `sort_order`  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `uploaded_by` INT UNSIGNED DEFAULT NULL,
  `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category`    (`category`),
  KEY `idx_sort_order`  (`sort_order`),
  CONSTRAINT `fk_gallery_admin`
    FOREIGN KEY (`uploaded_by`) REFERENCES `admin_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE 13: activity_log
-- Audit trail for all admin actions
-- ============================================================
CREATE TABLE IF NOT EXISTS `activity_log` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_id`     INT UNSIGNED DEFAULT NULL,
  `action`       VARCHAR(100) NOT NULL COMMENT 'e.g. create_store, update_lead_status',
  `entity_type`  VARCHAR(60)  DEFAULT NULL COMMENT 'e.g. stores, led_leads',
  `entity_id`    INT UNSIGNED DEFAULT NULL,
  `details`      TEXT DEFAULT NULL COMMENT 'JSON snapshot or human-readable diff',
  `ip_address`   VARCHAR(45) DEFAULT NULL,
  `performed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_id`     (`admin_id`),
  KEY `idx_entity`       (`entity_type`, `entity_id`),
  KEY `idx_performed_at` (`performed_at`),
  CONSTRAINT `fk_actlog_admin`
    FOREIGN KEY (`admin_id`) REFERENCES `admin_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- VIEWS â€” Useful dashboard shortcuts
-- ============================================================

-- Dashboard summary metrics view
CREATE OR REPLACE VIEW `v_dashboard_metrics` AS
SELECT
  (SELECT COUNT(*) FROM `stores`           WHERE status = 'active')       AS total_active_stores,
  (SELECT COUNT(*) FROM `contact_leads`)                                   AS total_contact_leads,
  (SELECT COUNT(*) FROM `led_leads`)                                       AS total_led_leads,
  (SELECT COUNT(*) FROM `activation_leads`)                                AS total_activation_leads,
  (SELECT COUNT(*) FROM `playon_bookings`)                                 AS total_playon_bookings,
  (SELECT COUNT(*) FROM `contact_leads`    WHERE status = 'new')           AS new_contact_leads,
  (SELECT COUNT(*) FROM `led_leads`        WHERE status = 'new')           AS new_led_leads,
  (SELECT COUNT(*) FROM `activation_leads` WHERE status = 'new')           AS new_activation_leads,
  (SELECT COUNT(*) FROM `playon_bookings`  WHERE status = 'new')           AS new_playon_bookings,
  (SELECT COUNT(*) FROM `events`           WHERE status = 'upcoming')      AS upcoming_events,
  (SELECT COUNT(*) FROM `reviews`          WHERE status = 'pending')       AS pending_reviews,
  (SELECT COUNT(*) FROM `blog_posts`       WHERE status = 'published')     AS published_articles;


-- All leads unified view (for global inbox)
CREATE OR REPLACE VIEW `v_all_leads` AS
  SELECT 
    id, 
    ref_code, 
    _utf8mb4 'contact' COLLATE utf8mb4_unicode_ci AS lead_type, 
    name AS primary_name, 
    email, 
    phone,
    CAST(NULL AS CHAR(200) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS company, 
    CAST(subject AS CHAR(100) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS category, 
    CAST(status AS CHAR(30) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS status, 
    submitted_at
  FROM `contact_leads`
UNION ALL
  SELECT 
    id, 
    ref_code, 
    _utf8mb4 'led' COLLATE utf8mb4_unicode_ci AS lead_type, 
    contact_name AS primary_name, 
    email, 
    phone,
    CAST(business_name AS CHAR(200) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS company, 
    CAST(package_requested AS CHAR(100) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS category, 
    CAST(status AS CHAR(30) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS status, 
    submitted_at
  FROM `led_leads`
UNION ALL
  SELECT 
    id, 
    ref_code, 
    _utf8mb4 'activation' COLLATE utf8mb4_unicode_ci AS lead_type, 
    contact_name AS primary_name, 
    email, 
    phone,
    CAST(company_name AS CHAR(200) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS company, 
    CAST(activation_type AS CHAR(100) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS category, 
    CAST(status AS CHAR(30) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS status, 
    submitted_at
  FROM `activation_leads`
UNION ALL
  SELECT 
    id, 
    ref_code, 
    _utf8mb4 'playon' COLLATE utf8mb4_unicode_ci AS lead_type, 
    parent_name AS primary_name, 
    email, 
    phone,
    CAST(NULL AS CHAR(200) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS company, 
    CAST(booking_type AS CHAR(100) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS category, 
    CAST(status AS CHAR(30) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS status, 
    submitted_at
  FROM `playon_bookings`;


-- ============================================================
-- END OF SCHEMA
-- ============================================================


-- ============================================================
-- AUTHORITATIVE SEED DATA (MIGRATED FROM FIREBASE / STORES.JSON)
-- ============================================================

-- SEED STORES & PHOTOS
INSERT IGNORE INTO `stores` (`id`, `name`, `unit_number`, `floor`, `category`, `phone`, `email`, `website`, `description`, `logo_url`, `status`, `sort_order`) VALUES
(1, 'Naivas', 'G-01', 'Ground Floor', 'retail', '+254 790 964 002', 'customercare@naivas.co.ke', 'https://www.instagram.com/naivas_supermarket', '24/7 anchor hypermarket featuring fresh bakery, organic produce, butchery, pharmacy, liquor store and home essentials.', '/assets/store-previews/g-01.webp', 'active', 1),
(2, 'Chicken Inn', 'G-02', 'Ground Floor', 'food', '+254 790 964 002', 'info@chickeninn.co.ke', 'https://www.instagram.com/chickeninnke/', 'Famous crisp, juicy fried chicken, delicious burgers, seasoned chips and signature family meal combos.', '/assets/store-previews/g-02.webp', 'active', 2),
(3, 'Creamy Inn', 'G-03', 'Ground Floor', 'food', '+254 790 964 002', 'info@creamyinn.co.ke', 'https://www.instagram.com/CreamyInn_ke', 'Indulgent soft-serve ice creams, decadent sundaes, thick milkshakes, Belgian waffles and dessert treats.', '/assets/store-previews/g-03.webp', 'active', 3),
(4, 'Pizza Inn', 'G-04', 'Ground Floor', 'food', '+254 790 964 002', 'info@pizzainn.co.ke', 'https://www.instagram.com/pizzainn_ke', 'Freshly rolled artisan dough pizzas, classic pepperoni, peri-peri chicken and famous Buy-One-Get-One-Free specials.', '/assets/store-previews/g-04.webp', 'active', 4),
(5, 'Naivas First Floor', 'F-01', 'First Floor', 'retail', '+254 790 964 002', 'customercare@naivas.co.ke', 'https://www.instagram.com/naivas_supermarket', 'Anchor level 1 department store carrying home appliances, electronics, kitchenware, bedding and lifestyle goods.', '/assets/store-previews/f-01.webp', 'active', 5),
(6, 'Hallahulah Game Shop', 'F-02', 'First Floor', 'tech', '+254 790 964 002', 'info@mombasamall.co.ke', '', 'Top-tier video games store offering PlayStation 5, Xbox, Nintendo consoles, controllers, VR gear and gaming accessories.', '/assets/store-previews/f-02.webp', 'active', 6),
(7, 'Daliah Human Wigs', 'F-03', 'First Floor', 'fashion', '+254 790 964 002', 'info@daliahwigs.co.ke', 'https://www.instagram.com/daliah_human_hair', '100% Virgin human hair extensions, lace front wigs, custom closures, hair maintenance products and professional styling.', '/assets/store-previews/f-03.webp', 'active', 7),
(8, 'Payless', 'F-04', 'First Floor', 'fashion', '+254 790 964 002', 'info@payless.co.ke', 'https://www.instagram.com/payless_001', 'Affordable trendsetting footwear, designer smartphones, phone accessories and family essentials.', '/assets/store-previews/f-04.webp', 'active', 8),
(9, 'Grand Computer', 'F-05', 'First Floor', 'tech', '+254 790 964 002', 'sales@grandcomputer.co.ke', 'https://www.instagram.com/grand_computer', 'Laptops, high-performance desktops, monitors, computer peripherals, hardware upgrades and certified repair services.', '/assets/store-previews/f-05.webp', 'active', 9),
(10, 'Tickles and Giggles', 'F-06', 'First Floor', 'fashion', '+254 790 964 002', 'kids@ticklesandgiggles.co.ke', 'https://www.instagram.com/ticklesandgiggles_kids_kenya', 'Adorable children''s clothing, baby essentials, educational toys, school bags and toddler accessories.', '/assets/store-previews/f-06.webp', 'active', 10),
(11, 'Namada Healthcare', 'F-07', 'First Floor', 'services', '+254 790 964 002', 'care@namada.co.ke', '', 'Retail and dispensing pharmacy, medical diagnostic testing, wellness supplements and personal care essentials.', '/assets/store-previews/f-07.webp', 'active', 11),
(12, 'Online Holidays', 'F-08', 'First Floor', 'services', '+254 790 964 002', 'travel@onlineholidays.co.ke', '', 'Domestic and international holiday packages, flight ticketing, safari expeditions, hotel bookings and visa concierge.', '/assets/store-previews/f-08.webp', 'active', 12),
(13, 'West 11', 'F-09', 'First Floor', 'fashion', '+254 790 964 002', 'info@west11.co.ke', 'https://www.instagram.com/west11sports', 'Contemporary fashion, streetwear apparel, designer accessories and coastal lifestyle collections.', '/assets/store-previews/f-09.webp', 'active', 13),
(14, '7day Mensware', 'F-10', 'First Floor', 'fashion', '+254 790 964 002', 'info@7daymenswear.co.ke', 'https://www.instagram.com/7daymenswear', 'Sharp formal suits, blazers, smart-casual shirts, trousers, designer shoes and men''s grooming accessories.', '/assets/store-previews/f-10.webp', 'active', 14),
(15, 'KG Cosmetics', 'F-11', 'First Floor', 'beauty', '+254 790 964 002', 'beauty@kgcosmetics.co.ke', 'https://www.instagram.com/kg_beauty_cosmetics', 'Original designer perfumes, branded makeup, organic skincare routines, beauty tools and luxury fragrances.', '/assets/store-previews/f-11.webp', 'active', 15),
(16, 'Lovisa', 'F-12', 'First Floor', 'fashion', '+254 790 964 002', 'info@lovisa.co.ke', 'https://www.instagram.com/lovisa.msa', 'On-trend fashion jewellery, sterling silver, gold-plated earrings, bridal accessories, hair styling clips and body jewellery.', '/assets/store-previews/f-12.webp', 'active', 16),
(17, 'Fakri Timezone', 'F-13', 'First Floor', 'fashion', '+254 790 964 002', 'info@fakritimezone.co.ke', '', 'Luxury wristwatches, chronographs, designer sunglasses, prescription optical frames and watch battery/strap servicing.', '/assets/store-previews/f-13.webp', 'active', 17),
(18, 'Dendri', 'F-14', 'First Floor', 'fashion', '+254 790 964 002', 'info@denri.co.ke', 'https://www.instagram.com/denri_africa', 'Proudly Kenyan handcrafted leather handbags, backpacks, travel duffels, laptop sleeves and leather wallets.', '/assets/store-previews/f-14.webp', 'active', 18),
(19, 'NCBA Bank', 'F-15', 'First Floor', 'services', '+254 790 964 002', 'contact@ncbagroup.com', 'https://www.instagram.com/ncbabankkenya', 'Full-service retail and corporate banking, foreign currency exchange, asset financing, loan desks and 24/7 ATM lobby.', '/assets/store-previews/f-15.webp', 'active', 19),
(20, 'Diamond Tech', 'F-16', 'First Floor', 'tech', '+254 790 964 002', 'sales@diamondtech.co.ke', 'https://www.instagram.com/diamondtechmsa', 'CCTV camera security systems, biometric access controls, network routers, intercoms, alarm systems and IT hardware.', '/assets/store-previews/f-16.webp', 'active', 20),
(21, 'Africa Collectives (Pop shop)', 'F-17', 'First Floor', 'fashion', '+254 790 964 002', 'info@mombasamall.co.ke', '', 'Authentic African handwoven baskets, beaded jewellery, carved wooden artefacts, coastal artwork and souvenirs.', '/assets/store-previews/f-17.webp', 'active', 21),
(22, 'Play On (Game Area)', 'S-01', 'Second Floor', 'food', '+254 790 964 002', 'play@mombasamall.co.ke', '/playon/index.html', 'Mombasa''s largest family fun center! Features soft play slides, ball pits, VR rollercoasters, arcade games and party rooms.', '/assets/store-previews/s-01.webp', 'active', 22),
(23, 'Creamy Inn, Chicken Inn, Pizza Inn (kiosk)', 'S-02', 'Second Floor', 'food', '+254 790 964 002', 'info@simbisa.co.ke', 'https://www.instagram.com/chickeninnke/', 'Convenient second-floor express counter serving pizza slices, fried chicken snacks, soft-serve cones and cold drinks.', '/assets/store-previews/s-02.webp', 'active', 23),
(24, 'Jumia / Skyve shot / Xtigi Service Center', 'S-03', 'Second Floor', 'tech', '+254 790 964 002', 'care@jumia.co.ke', 'https://www.instagram.com/jumiakenya', 'Official Jumia parcel drop-off and pickup hub, Skyve professional photography studio, and certified Xtigi repair center.', '/assets/store-previews/s-03.webp', 'active', 24),
(25, 'World Designers', 'S-04', 'Second Floor', 'fashion', '+254 790 964 002', 'info@worlddesigners.co.ke', 'https://www.instagram.com/worlddesigners', 'Bespoke tailoring, custom evening wear, African print fashion, bridal garments and exquisite alterations.', '/assets/store-previews/s-04.webp', 'active', 25),
(26, 'SAS Beauty', 'S-05', 'Second Floor', 'beauty', '+254 790 964 002', 'info@sasbeauty.co.ke', 'https://www.instagram.com/sasbeauty3', 'Full-service beauty center offering hair braiding, wig styling, blowouts, manicure, pedicure, and bridal glam makeup.', '/assets/store-previews/s-05.webp', 'active', 26),
(27, 'Novum', 'S-06', 'Second Floor', 'beauty', '+254 790 964 002', 'info@novumbeauty.co.ke', 'https://www.instagram.com/novum_beauty_parlour', 'Sanctuary for rejuvenating facials, deep tissue massage, gel nails, lash extensions and professional waxing services.', '/assets/store-previews/s-06.webp', 'active', 27),
(28, 'Ident Smile', 'S-07', 'Second Floor', 'services', '+254 790 964 002', 'info@identsmiles.co.ke', 'https://www.instagram.com/identsmiles_dental_clinic', 'Comprehensive modern dental clinic: teeth whitening, orthodontics, fillings, dental checkups, cleaning and root canals.', '/assets/store-previews/s-07.webp', 'active', 28),
(29, 'Tawal ICT Solution', 'S-08', 'Second Floor', 'tech', '+254 790 964 002', 'info@tawalaict.co.ke', 'https://www.instagram.com/tawalaictsolutions', 'Smart enterprise ICT solutions, custom software deployment, networking, hardware repairs and office tech supplies.', '/assets/store-previews/s-08.webp', 'active', 29),
(30, 'Mintos Salon Spa Barbershop', 'S-09', 'Second Floor', 'beauty', '+254 790 964 002', 'royalty@mintosalon.co.ke', 'https://www.instagram.com/mintos_salon_spa', 'Premium executive barbershop, hot towel shaves, luxury hair treatments, therapeutic spa sessions and beard care.', '/assets/store-previews/s-09.webp', 'active', 30),
(31, 'SSB', 'S-10', 'Second Floor', 'fashion', '+254 790 964 002', 'info@ssb.co.ke', 'https://www.instagram.com/ssb.products', 'Trendsetting fashion boutique offering chic ladies'' outfits, handbags, cosmetics and statement accessories.', '/assets/store-previews/s-10.webp', 'active', 31),
(32, 'Rudra', 'S-11', 'Second Floor', 'fashion', '+254 790 964 002', 'info@rudrawear.co.ke', 'https://www.instagram.com/rudrawear', 'Indian ethnic wear, silk sarees, kurtis, embroidered fabrics, bridal lehengas and festival collections.', '/assets/store-previews/s-11.webp', 'active', 32),
(33, 'West 11 Sports', 'S-12', 'Second Floor', 'fashion', '+254 790 964 002', 'sports@west11.co.ke', 'https://www.instagram.com/west11sports', 'Athletic footwear, training apparel, gym wear, football jerseys, sports gear and fitness accessories.', '/assets/store-previews/s-12.webp', 'active', 33),
(34, 'Osona Yarns', 'S-13', 'Second Floor', 'fashion', '+254 790 964 002', 'info@osonayarns.co.ke', 'https://www.instagram.com/osonayarns', 'Knitting and crochet yarns, haberdashery, sewing threads, embroidery materials and DIY craft kits.', '/assets/store-previews/s-13.webp', 'active', 34),
(35, 'Afribot Robotics', 'S-14', 'Second Floor', 'tech', '+254 790 964 002', 'skills@afribot.co.ke', '', 'STEM educational academy providing kids and teens coding, Arduino robotics, 3D printing and AI tech workshops.', '/assets/store-previews/s-14.webp', 'active', 35),
(36, 'Luxe Kaftan', 'S-15', 'Second Floor', 'fashion', '+254 790 964 002', 'bridal@luxekaftans.co.ke', 'https://www.instagram.com/luxekaftanskenya', 'Exclusive Swahili bridal kaftans, silk abayas, embellished evening gowns and coastal royal couture.', '/assets/store-previews/s-15.webp', 'active', 36),
(37, 'Malkia', 'S-16', 'Second Floor', 'fashion', '+254 790 964 002', 'info@malkiaboutique.co.ke', 'https://www.instagram.com/malkiaa.boutique', 'Modern modest fashion, stylish abayas, hijabs, evening dresses and luxury Arabian accessories.', '/assets/store-previews/s-16.webp', 'active', 37),
(38, 'Michael Boutique', 'S-17', 'Second Floor', 'fashion', '+254 790 964 002', 'info@michaelsbouquet.co.ke', 'https://www.instagram.com/michaelsbouquet', 'Sophisticated women''s apparel, cocktail dresses, formal office wear and designer handbags.', '/assets/store-previews/s-17.webp', 'active', 38),
(39, 'Oraimo (upcoming)', 'S-18', 'Second Floor', 'tech', '+254 790 964 002', 'info@oraimo.co.ke', 'https://www.instagram.com/oraimoclub', 'Official smart accessories store: high-capacity power banks, wireless earbuds, smartwatches and fast chargers.', '/assets/store-previews/s-18.webp', 'active', 39),
(40, 'Keswick', 'S-19', 'Second Floor', 'retail', '+254 790 964 002', 'sales@keswickbooks.co.ke', 'https://www.instagram.com/keswickbooks', 'Christian literature, Bibles, motivational books, children''s storybooks, gift stationery and music.', '/assets/store-previews/s-19.webp', 'active', 40),
(41, 'Gamers Vault', 'T-01', 'Third Floor', 'tech', '+254 790 964 002', 'esports@gamersvault.co.ke', 'https://www.instagram.com/gamersvaultke', 'Coastal Kenya''s flagship esports arena! PS5 4K lounges, high-refresh gaming PCs, EA FC tournaments and VR.', '/assets/store-previews/t-01.webp', 'active', 41),
(42, 'Legacy Gym', 'T-02', 'Third Floor', 'services', '+254 790 964 002', 'fitness@legacygym.co.ke', 'https://www.instagram.com/legacyfitnessclub', 'State-of-the-art gym club: cardio machines, free weights, Olympic lifting racks, aerobics, sauna and personal trainers.', '/assets/store-previews/t-02.webp', 'active', 42),
(43, 'Westerwelle Foundation', 'T-03', 'Third Floor', 'services', '+254 790 964 002', 'mombasa@westerwelle-foundation.com', 'https://www.instagram.com/westerwellefoundation', 'International startup hub offering premium coworking desks, private meeting suites, fast Wi-Fi, event training and accelerator programs.', '/assets/store-previews/t-03.webp', 'active', 43),
(44, 'Equity Afia CBD', 'T-04', 'Third Floor', 'services', '+254 790 964 002', 'customercare@equityafia.co.ke', 'https://www.instagram.com/equityafiamwembetayari', 'Modern outpatient health center: general doctor consultations, laboratory diagnosis, fully stocked pharmacy and dental checkups.', '/assets/store-previews/t-04.webp', 'active', 44),
(45, 'Valet & Parking Services', 'B-01', 'Basement Parking', 'services', '+254 790 964 002', 'parking@mombasamall.co.ke', 'https://www.instagram.com/mombasamall_/', 'Professional valet concierge desk, contactless ticket validation, accessible parking assistance and guest transport drop-off.', '/assets/store-previews/b-01.webp', 'active', 45),
(46, 'Secure Basement Parking Deck', 'B-02', 'Basement Parking', 'services', '+254 790 964 002', 'parking@mombasamall.co.ke', 'https://www.instagram.com/mombasamall_/', 'Over 400+ well-lit, secure vehicle parking bays with 24/7 CCTV surveillance, automated access booms and firefighting systems.', '/assets/store-previews/b-02.webp', 'active', 46);

INSERT IGNORE INTO `store_photos` (`store_id`, `image_url`, `caption`, `sort_order`) VALUES
(1, '/assets/lifestyle/naivas.webp', 'Storefront / Display', 1),
(2, '/assets/store-previews/g-02.webp', 'Storefront / Display', 1),
(3, '/assets/store-previews/g-03.webp', 'Storefront / Display', 1),
(4, '/assets/store-previews/g-04.webp', 'Storefront / Display', 1),
(5, '/assets/lifestyle/naivas.webp', 'Storefront / Display', 1),
(6, '/assets/store-previews/f-02.webp', 'Storefront / Display', 1),
(7, '/assets/store-previews/f-03.webp', 'Storefront / Display', 1),
(8, '/assets/store-previews/f-04.webp', 'Storefront / Display', 1),
(9, '/assets/lifestyle/grand-computer.webp', 'Storefront / Display', 1),
(10, '/assets/store-previews/f-06.webp', 'Storefront / Display', 1),
(11, '/assets/store-previews/f-07.webp', 'Storefront / Display', 1),
(12, '/assets/store-previews/f-08.webp', 'Storefront / Display', 1),
(13, '/assets/store-previews/f-09.webp', 'Storefront / Display', 1),
(14, '/assets/store-previews/f-10.webp', 'Storefront / Display', 1),
(15, '/assets/store-previews/f-11.webp', 'Storefront / Display', 1),
(16, '/assets/store-previews/f-12.webp', 'Storefront / Display', 1),
(17, '/assets/store-previews/f-13.webp', 'Storefront / Display', 1),
(18, '/assets/store-previews/f-14.webp', 'Storefront / Display', 1),
(19, '/assets/store-previews/f-15.webp', 'Storefront / Display', 1),
(20, '/assets/store-previews/f-16.webp', 'Storefront / Display', 1),
(21, '/assets/store-previews/f-17.webp', 'Storefront / Display', 1),
(22, '/assets/store-previews/s-01.webp', 'Storefront / Display', 1),
(23, '/assets/store-previews/s-02.webp', 'Storefront / Display', 1),
(24, '/assets/store-previews/s-03.webp', 'Storefront / Display', 1),
(25, '/assets/store-previews/s-04.webp', 'Storefront / Display', 1),
(26, '/assets/store-previews/s-05.webp', 'Storefront / Display', 1),
(27, '/assets/store-previews/s-06.webp', 'Storefront / Display', 1),
(28, '/assets/store-previews/s-07.webp', 'Storefront / Display', 1),
(29, '/assets/store-previews/s-08.webp', 'Storefront / Display', 1),
(30, '/assets/store-previews/s-09.webp', 'Storefront / Display', 1),
(31, '/assets/store-previews/s-10.webp', 'Storefront / Display', 1),
(32, '/assets/lifestyle/rudra.webp', 'Storefront / Display', 1),
(33, '/assets/store-previews/s-12.webp', 'Storefront / Display', 1),
(34, '/assets/store-previews/s-13.webp', 'Storefront / Display', 1),
(35, '/assets/store-previews/s-14.webp', 'Storefront / Display', 1),
(36, '/assets/store-previews/s-15.webp', 'Storefront / Display', 1),
(37, '/assets/store-previews/s-16.webp', 'Storefront / Display', 1),
(38, '/assets/store-previews/s-17.webp', 'Storefront / Display', 1),
(39, '/assets/store-previews/s-18.webp', 'Storefront / Display', 1),
(40, '/assets/store-previews/s-19.webp', 'Storefront / Display', 1),
(41, '/assets/store-previews/t-01.webp', 'Storefront / Display', 1),
(42, '/assets/store-previews/t-02.webp', 'Storefront / Display', 1),
(43, '/assets/store-previews/t-03.webp', 'Storefront / Display', 1),
(44, '/assets/store-previews/t-04.webp', 'Storefront / Display', 1),
(45, '/assets/store-previews/b-01.webp', 'Storefront / Display', 1),
(46, '/assets/store-previews/b-02.webp', 'Storefront / Display', 1);


-- SEED EVENTS
INSERT IGNORE INTO `events` (`id`, `title`, `venue`, `event_date`, `event_end_date`, `description`, `image_url`, `status`, `created_by`) VALUES
(1, 'Summer Family Day & Kids Carnival', 'Mombasa Mall Atrium', '2026-09-05 10:00:00', NULL, 'Join us at the Play-On Kids Zone for free face painting, magic shows, bouncy castles, and local youth music performances.', NULL, 'upcoming', 1),
(2, 'East African Fashion Pop-up Weekend', 'Mombasa Mall Atrium', '2026-09-18 10:00:00', NULL, 'Browse and buy collections from over 15 local and regional designers showcasing custom-made apparel, kaftans, and hand-woven bags.', NULL, 'upcoming', 1),
(3, 'Swahili Foodie & Spice Market', 'Mombasa Mall Atrium', '2026-10-02 10:00:00', NULL, 'Savor authentic coastal dishes, spicy street food, and chef-led cooking demos in our main atrium and food court.', NULL, 'upcoming', 1),
(4, 'Back-to-School Mega Sale', 'Mombasa Mall', '2026-07-10 10:00:00', NULL, 'Unbeatable discounts on books, stationery, and uniforms across major retail stores.', NULL, 'past', 1),
(5, 'Mombasa Tech Innovation Night', 'Mombasa Mall', '2026-06-22 10:00:00', NULL, 'Co-hosted by Westerwelle Startup Haus, bringing together over 120 tech developers and startup founders in Mombasa.', NULL, 'past', 1);

-- SEED BLOG POSTS
INSERT IGNORE INTO `blog_posts` (`id`, `title`, `slug`, `excerpt`, `body`, `image_url`, `author`, `published_date`, `status`, `created_by`) VALUES
(1, 'Welcome to Westerwelle Startup Haus Mombasa', 'westerwelle-coworking-launch', 'Discover the newly launched co-working space and tech incubator on the third floor of Mombasa Mall, offering prime office suites, meeting rooms, and startup support.', 'Discover the newly launched co-working space and tech incubator on the third floor of Mombasa Mall, offering prime office suites, meeting rooms, and startup support.', NULL, 'Mombasa Mall Editorial', '2026-08-10', 'published', 1),
(2, 'Fresh Grocery Shopping Made Easy at Naivas Anchor', 'naivas-grocery-shopping', 'Explore the massive Naivas Supermarket on the ground floor of Mombasa Mall, featuring fresh produce, a bakery, butchery, and a fully-stocked homeware section.', 'Explore the massive Naivas Supermarket on the ground floor of Mombasa Mall, featuring fresh produce, a bakery, butchery, and a fully-stocked homeware section.', NULL, 'Mombasa Mall Editorial', '2026-08-01', 'published', 1),
(3, 'Planning the Perfect Family Weekend at Play-On Zone', 'family-weekend-play-on', 'From indoor soft playgrounds to child-safe ball pits and interactive crafts, discover why Play-On at Mombasa Mall is the family destination of choice.', 'From indoor soft playgrounds to child-safe ball pits and interactive crafts, discover why Play-On at Mombasa Mall is the family destination of choice.', NULL, 'Mombasa Mall Editorial', '2026-07-22', 'published', 1),
(4, 'How Digital LED Screens Can Boost Your Brand Exposure', 'boost-brand-led-screens', 'Learn about our dual-sided high-definition digital billboards in the main atrium and food court, and how flexible advertising loops can scale your business.', 'Learn about our dual-sided high-definition digital billboards in the main atrium and food court, and how flexible advertising loops can scale your business.', NULL, 'Mombasa Mall Editorial', '2026-07-08', 'published', 1);

-- SEED REVIEWS
INSERT IGNORE INTO `reviews` (`id`, `reviewer_name`, `reviewer_email`, `store_id`, `store_name_typed`, `rating`, `review_text`, `status`, `admin_notes`) VALUES
(1, 'Aisha Omar', NULL, NULL, 'Mombasa Mall', 5, 'Mombasa Mall has completely transformed my shopping routine. Naivas on the ground floor is incredibly convenient, and NCBA bank is right next door.', 'approved', 'Featured customer testimonial'),
(2, 'Peter Mwangi', NULL, NULL, 'Mombasa Mall', 4, 'Basement parking is spacious, safe, and secure. The automated entry ticketer is fast, and security guards are always helpful.', 'approved', 'Featured customer testimonial'),
(3, 'Joy Kerubo', NULL, NULL, 'Mombasa Mall', 5, 'Westerwelle Startup Haus on the third floor is Mombasa''s best coworking incubator! Superfast internet, quiet meeting rooms, and amazing tech events.', 'approved', 'Featured customer testimonial'),
(4, 'Ali Hassan', NULL, NULL, 'Mombasa Mall', 5, 'The food court on the second floor offers a fantastic mix of local Swahili dishes and fast food. Play-On Kids Zone kept my children fully entertained while I shopped.', 'approved', 'Featured customer testimonial'),
(5, 'Fatma', NULL, NULL, 'Mombasa Mall', 5, 'Loved the weekend designer fashion pop-up markets! Got a beautiful local kaftan.', 'approved', 'Verified shopper feedback'),
(6, 'Kiprotich', NULL, NULL, 'Mombasa Mall', 5, 'Convenient location in Mwembe Tayari. Very easy to access via public transport or private drive.', 'approved', 'Verified shopper feedback'),
(7, 'Emily', NULL, NULL, 'Mombasa Mall', 5, 'Equity Afia Clinic on the ground floor offers quick and affordable checkups. So glad to have it in the mall.', 'approved', 'Verified shopper feedback');


