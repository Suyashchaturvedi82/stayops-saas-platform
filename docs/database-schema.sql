-- =====================================================
-- ENUM DEFINITIONS (DOCUMENTATION)
-- =====================================================
-- Booking Status:
-- PENDING, APPROVED, REJECTED, CANCELLED, COMPLETED
--
-- Payment Status:
-- PENDING, VERIFIED, REJECTED, FAILED
--
-- Resident Status:
-- PENDING_APPROVAL, ACTIVE, CHECKED_OUT
--
-- Mess Plan Type:
-- SUBSCRIPTION, PAY_PER_MEAL
--
-- Meal Type:
-- BREAKFAST, LUNCH, DINNER
-- =====================================================


-- =====================================================
-- USERS & ROLES
-- =====================================================

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    phone VARCHAR(15) NOT NULL,
    gender ENUM('MALE', 'FEMALE', 'OTHER') NOT NULL,
    date_of_birth DATE,
    address TEXT,
    occupation VARCHAR(100),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(15),
    profile_image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name ENUM('USER', 'ADMIN') NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_role (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- =====================================================
-- ROOMS & BEDS (SOURCE OF TRUTH = BEDS)
-- =====================================================

CREATE TABLE rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    floor_number INT NOT NULL,
    room_type ENUM('AC', 'NON_AC') NOT NULL,
    max_occupancy INT NOT NULL,
    rent_per_month DECIMAL(10,2) NOT NULL,
    amenities JSON,
    is_available BOOLEAN DEFAULT TRUE
        COMMENT 'Derived from bed availability, not source of truth',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE beds (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL,
    bed_number VARCHAR(20) NOT NULL,
    rent_per_month DECIMAL(10,2) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_room_bed (room_id, bed_number),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- =====================================================
-- BOOKINGS (BED LEVEL)
-- =====================================================

CREATE TABLE bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bed_id INT NOT NULL,
    user_id INT NOT NULL,
    check_in_date DATE NOT NULL,
    expected_check_out_date DATE,
    actual_check_out_date DATE,
    booking_status ENUM(
        'PENDING',
        'APPROVED',
        'REJECTED',
        'CANCELLED',
        'COMPLETED'
    ) DEFAULT 'PENDING',
    hold_expires_at TIMESTAMP NULL
        COMMENT 'Auto release bed if not approved in time',
    advance_amount DECIMAL(10,2) DEFAULT 0,
    total_rent DECIMAL(10,2),
    special_requests TEXT,
    admin_notes TEXT,
    admin_approved_by INT,
    admin_approved_at TIMESTAMP NULL,
    cancelled_by INT,
    cancelled_at TIMESTAMP NULL,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bed_id) REFERENCES beds(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (admin_approved_by) REFERENCES users(id),
    FOREIGN KEY (cancelled_by) REFERENCES users(id)
);

-- =====================================================
-- RESIDENTS (LIFECYCLE TRACKING)
-- =====================================================

CREATE TABLE residents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    user_id INT NOT NULL,
    bed_id INT NOT NULL,
    move_in_date DATE NOT NULL,
    expected_move_out_date DATE,
    actual_move_out_date DATE,
    resident_status ENUM(
        'PENDING_APPROVAL',
        'ACTIVE',
        'CHECKED_OUT'
    ) DEFAULT 'PENDING_APPROVAL',
    security_deposit DECIMAL(10,2),
    refundable_amount DECIMAL(10,2) DEFAULT 0,
    final_settlement_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (bed_id) REFERENCES beds(id)
);

-- =====================================================
-- PAYMENTS
-- =====================================================

CREATE TABLE payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    user_id INT NOT NULL,
    payment_for ENUM(
        'ADVANCE',
        'RENT',
        'SECURITY_DEPOSIT',
        'MESS_SUBSCRIPTION',
        'MEAL_PAYMENT',
        'OTHER'
    ) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_status ENUM(
        'PENDING',
        'VERIFIED',
        'REJECTED',
        'FAILED'
    ) DEFAULT 'PENDING',
    upi_transaction_id VARCHAR(100),
    payment_screenshot_url VARCHAR(500),
    admin_verified_by INT,
    admin_verified_at TIMESTAMP NULL,
    admin_rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (admin_verified_by) REFERENCES users(id)
);

-- =====================================================
-- MESS SYSTEM
-- =====================================================

CREATE TABLE mess_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    plan_name VARCHAR(100) NOT NULL,
    plan_type ENUM('SUBSCRIPTION', 'PAY_PER_MEAL') NOT NULL,
    meals_per_day TINYINT,
    price_per_month DECIMAL(10,2),
    price_per_meal DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mess_subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    mess_plan_id INT NOT NULL,
    booking_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    subscription_status ENUM(
        'ACTIVE',
        'EXPIRED',
        'CANCELLED'
    ) DEFAULT 'ACTIVE',
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    payment_status ENUM('PENDING', 'PAID', 'PARTIAL') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (mess_plan_id) REFERENCES mess_plans(id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE TABLE mess_daily_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    meal_date DATE NOT NULL,
    meal_type ENUM('BREAKFAST', 'LUNCH', 'DINNER') NOT NULL,
    mess_plan_id INT,
    booking_id INT,
    meal_price DECIMAL(10,2),
    payment_id INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_meal (user_id, meal_date, meal_type),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (mess_plan_id) REFERENCES mess_plans(id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (payment_id) REFERENCES payments(id)
);

-- =====================================================
-- ADMIN AUDIT LOG
-- =====================================================

CREATE TABLE admin_actions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_user_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_table VARCHAR(50) NOT NULL,
    target_id INT NOT NULL,
    old_values JSON,
    new_values JSON,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_user_id) REFERENCES users(id)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_bookings_status ON bookings(booking_status);
CREATE INDEX idx_beds_availability ON beds(room_id, is_available);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_residents_status ON residents(resident_status);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
