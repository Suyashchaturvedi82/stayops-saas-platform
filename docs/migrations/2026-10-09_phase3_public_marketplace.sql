-- =============================================================
-- PHASE 3: Public marketplace (tenant discovery)
--
-- pg_profiles: public-facing listing data per workspace (a PG).
-- pg_reviews:  resident reviews tied to a real booking.
--
-- Public endpoints (GET /public/pgs, GET /public/pgs/:id) read
-- ONLY from these tables + rooms/beds — no tenant JWT context
-- required until a booking is actually requested.
--
-- Runner rules (fix-db-2.js): statements split on semicolons,
-- full-line comments stripped, no semicolons inside string
-- literals or comments, dynamic SQL strings double-quoted with
-- single-quoted SQL literals inside. Safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS pg_profiles (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  title VARCHAR(255) NULL,
  description TEXT NULL,
  address_line VARCHAR(255) NULL,
  locality VARCHAR(120) NULL,
  city VARCHAR(120) NULL,
  state VARCHAR(120) NULL,
  postal_code VARCHAR(20) NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  gender_policy ENUM('MALE','FEMALE','COED','ANY') NOT NULL DEFAULT 'ANY',
  amenities JSON NULL,
  images JSON NULL,
  contact_phone VARCHAR(15) NULL,
  is_listed TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_pg_profile_tenant (tenant_id),
  KEY idx_pg_city (city),
  KEY idx_pg_listed (is_listed),
  CONSTRAINT fk_pg_profile_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pg_reviews (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  booking_id INT NOT NULL,
  rating TINYINT NOT NULL,
  title VARCHAR(150) NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_pg_review_booking (booking_id),
  KEY idx_pg_review_tenant (tenant_id),
  CONSTRAINT fk_pg_review_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
  CONSTRAINT fk_pg_review_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_pg_review_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
  CONSTRAINT chk_pg_review_rating CHECK (rating >= 1 AND rating <= 5)
) ENGINE=InnoDB;

-- Every existing workspace becomes discoverable with a basic
-- listing (owner can refine or unlist it via PUT /public/pgs/me).
SET @seeded := (SELECT COUNT(*) FROM pg_profiles);

SET @s := IF(@seeded = 0, "INSERT IGNORE INTO pg_profiles (tenant_id, title, amenities, images, gender_policy, is_listed) SELECT id, name, '[]', '[]', 'ANY', 1 FROM tenants", 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;
