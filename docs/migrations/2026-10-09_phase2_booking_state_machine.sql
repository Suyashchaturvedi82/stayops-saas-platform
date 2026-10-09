-- =============================================================
-- PHASE 2: Booking engine state machine + hold TTL
--
-- Strict chain for beds / bookings:
--   AVAILABLE -> HELD (15-minute TTL) -> PENDING_PAYMENT
--             -> BOOKED -> OCCUPIED
-- Terminal booking states: REJECTED / CANCELLED / EXPIRED /
-- COMPLETED release the bed back to AVAILABLE.
--
-- Legacy states (PENDING / APPROVED) are kept in the ENUM so
-- pre-existing rows keep working. The legacy paths still move
-- through the same guarded transitions.
--
-- Runner rules (fix-db-2.js): statements split on semicolons,
-- full-line comments stripped, no semicolons inside string
-- literals, dynamic SQL strings double-quoted with
-- single-quoted SQL literals inside. Safe to re-run.
-- =============================================================

-- -------------------------------------------------------------
-- 1. beds.status: the bed-side view of the state machine.
-- -------------------------------------------------------------
SET @has_status := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'beds' AND COLUMN_NAME = 'status');

SET @s := IF(@has_status = 0, "ALTER TABLE beds ADD COLUMN status ENUM('AVAILABLE','HELD','PENDING_PAYMENT','BOOKED','OCCUPIED') NOT NULL DEFAULT 'AVAILABLE'", 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

-- -------------------------------------------------------------
-- 2. Backfill bed status from legacy is_available flag.
--    Idempotent: only touches beds still marked AVAILABLE.
-- -------------------------------------------------------------
SET @s := IF(@has_status = 0, "UPDATE beds SET status = 'OCCUPIED' WHERE is_available = 0 AND status = 'AVAILABLE'", 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

-- -------------------------------------------------------------
-- 3. Extend bookings.booking_status with the new states.
--    Keeps every legacy value so old rows remain valid.
-- -------------------------------------------------------------
SET @enum_ready := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'booking_status' AND COLUMN_TYPE LIKE '%HELD%');

SET @s := IF(@enum_ready = 0, "ALTER TABLE bookings MODIFY booking_status ENUM('HELD','PENDING_PAYMENT','BOOKED','OCCUPIED','PENDING','APPROVED','REJECTED','CANCELLED','COMPLETED','EXPIRED') NOT NULL DEFAULT 'PENDING'", 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

-- -------------------------------------------------------------
-- 4. Indexes that the engine and the expiry sweep rely on.
--    (Runner also tolerates 1061 duplicate-key skips.)
-- -------------------------------------------------------------
SET @idx1 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND INDEX_NAME = 'idx_bookings_hold_expiry');
SET @s := IF(@idx1 = 0, 'CREATE INDEX idx_bookings_hold_expiry ON bookings (tenant_id, booking_status, hold_expires_at)', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @idx2 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'beds' AND INDEX_NAME = 'idx_beds_tenant_status');
SET @s := IF(@idx2 = 0, 'CREATE INDEX idx_beds_tenant_status ON beds (tenant_id, status)', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;
