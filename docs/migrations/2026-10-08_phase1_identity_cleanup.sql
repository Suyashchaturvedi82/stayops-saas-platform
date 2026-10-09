-- =============================================================
-- PHASE 1: Canonical identity model + global email identity
--
-- Decisions:
--   * Global identity: one `users` row per email (email stays
--     globally unique as THE identity key). Multi-tenancy is
--     expressed ONLY through `tenant_memberships`.
--   * Canonical chain:
--       users -> tenant_memberships -> tenant_roles -> tenants
--   * Legacy removed:
--       - tables: roles, user_roles, tenant_user_roles,
--                 legacy polluted tenant_roles (name/role/user_id)
--       - columns: users.tenant_id, users.name
--
-- Safe to re-run: every step is guarded by information_schema
-- checks or IF [NOT] EXISTS. The runner (fix-db-2.js) splits
-- statements on semicolons and strips full-line comment rows, so
-- no statement below may embed a semicolon inside a string
-- literal. Dynamic SQL strings are written double-quoted with
-- single-quoted SQL literals inside them.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Backfill users.first_name / users.name from legacy users.name
-- -------------------------------------------------------------
SET @c_name := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'name');

SET @s := IF(@c_name > 0, "UPDATE users SET first_name = TRIM(SUBSTRING_INDEX(name, ' ', 1)) WHERE name IS NOT NULL AND name <> '' AND (first_name IS NULL OR first_name = '')", 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @s := IF(@c_name > 0, "UPDATE users SET last_name = NULLIF(TRIM(SUBSTRING(name, CHAR_LENGTH(first_name) + 1)), '') WHERE name IS NOT NULL AND name <> '' AND (last_name IS NULL OR last_name = '') AND name LIKE CONCAT(first_name, ' %')", 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

-- -------------------------------------------------------------
-- 2. Detect legacy (polluted) tenant_roles shape and move it aside.
--    Legacy base shape has user_id/role columns -> rename out of
--    the way so the canonical catalog can be created.
-- -------------------------------------------------------------
SET @legacy_tr := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenant_roles' AND COLUMN_NAME = 'user_id');

SET @s := IF(@legacy_tr > 0, 'RENAME TABLE tenant_roles TO tenant_roles_legacy', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

-- -------------------------------------------------------------
-- 3. Canonical tenant_roles catalog: (tenant_id, role name) only.
--    No-op when the SaaS-migration shape already exists.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_roles (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  name ENUM('OWNER','MANAGER','ACCOUNTANT','FRONTDESK','RESIDENT') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_tenant_role (tenant_id, name),
  CONSTRAINT fk_tenant_roles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Seed all five roles for every existing tenant (idempotent).
INSERT IGNORE INTO tenant_roles (tenant_id, name)
SELECT t.id, rn.role_name
FROM tenants t
CROSS JOIN (
  SELECT 'OWNER' AS role_name UNION ALL
  SELECT 'MANAGER' UNION ALL
  SELECT 'ACCOUNTANT' UNION ALL
  SELECT 'FRONTDESK' UNION ALL
  SELECT 'RESIDENT'
) rn;

-- -------------------------------------------------------------
-- 4. Canonical membership join: tenant_memberships.
--    Replaces tenant_user_roles (Phase 1 decision: rename).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_memberships (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_tenant_user_role (tenant_id, user_id, role_id),
  KEY idx_membership_user (user_id),
  CONSTRAINT fk_membership_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_role FOREIGN KEY (role_id) REFERENCES tenant_roles (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 5. Guards used by the backfill statements below.
-- -------------------------------------------------------------
SET @has_ltr := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenant_roles_legacy');
SET @has_tur := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenant_user_roles');
SET @c_tenant_col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'tenant_id');

-- -------------------------------------------------------------
-- 6a. Backfill memberships from legacy tenant_user_roles when the
--     legacy tenant_roles shape was present (role_id -> legacy id).
--     Maps legacy names ('admin', 'ADMIN', enum names) to canonical.
-- -------------------------------------------------------------
SET @s := IF(@has_ltr > 0 AND @has_tur > 0, "INSERT IGNORE INTO tenant_memberships (tenant_id, user_id, role_id) SELECT tur.tenant_id, tur.user_id, tr.id FROM tenant_user_roles tur JOIN tenant_roles_legacy ltr ON ltr.id = tur.role_id JOIN tenant_roles tr ON tr.tenant_id = tur.tenant_id AND tr.name = CASE WHEN UPPER(ltr.name) IN ('OWNER','MANAGER','ACCOUNTANT','FRONTDESK','RESIDENT') THEN UPPER(ltr.name) WHEN UPPER(COALESCE(ltr.role, '')) IN ('OWNER','MANAGER','ACCOUNTANT','FRONTDESK','RESIDENT') THEN UPPER(ltr.role) WHEN UPPER(COALESCE(ltr.name, '')) IN ('ADMIN','SUPERADMIN') OR UPPER(COALESCE(ltr.role, '')) IN ('ADMIN','SUPERADMIN') THEN 'OWNER' ELSE 'RESIDENT' END WHERE tur.role_id IS NOT NULL", 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

-- -------------------------------------------------------------
-- 6b. Backfill memberships from tenant_user_roles when the SaaS
--     (clean) tenant_roles shape was present (role_id -> id direct).
-- -------------------------------------------------------------
SET @s := IF(@has_ltr = 0 AND @has_tur > 0, "INSERT IGNORE INTO tenant_memberships (tenant_id, user_id, role_id) SELECT tur.tenant_id, tur.user_id, tur.role_id FROM tenant_user_roles tur JOIN tenant_roles tr ON tr.id = tur.role_id AND tr.tenant_id = tur.tenant_id WHERE tur.role_id IS NOT NULL", 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

-- -------------------------------------------------------------
-- 6c. Backfill memberships from legacy per-user rows that lived
--     inside the polluted tenant_roles table (user_id NOT NULL).
-- -------------------------------------------------------------
SET @ltr_user := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenant_roles_legacy' AND COLUMN_NAME = 'user_id');

SET @s := IF(@ltr_user > 0, "INSERT IGNORE INTO tenant_memberships (tenant_id, user_id, role_id) SELECT ltr.tenant_id, ltr.user_id, tr.id FROM tenant_roles_legacy ltr JOIN tenant_roles tr ON tr.tenant_id = ltr.tenant_id AND tr.name = CASE WHEN UPPER(COALESCE(ltr.name, '')) IN ('OWNER','MANAGER','ACCOUNTANT','FRONTDESK','RESIDENT') THEN UPPER(ltr.name) WHEN UPPER(COALESCE(ltr.role, '')) IN ('OWNER','MANAGER','ACCOUNTANT','FRONTDESK','RESIDENT') THEN UPPER(ltr.role) WHEN UPPER(COALESCE(ltr.name, '')) IN ('ADMIN','SUPERADMIN') OR UPPER(COALESCE(ltr.role, '')) IN ('ADMIN','SUPERADMIN') THEN 'OWNER' ELSE 'RESIDENT' END WHERE ltr.user_id IS NOT NULL", 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

-- -------------------------------------------------------------
-- 6d. Users still pinned via users.tenant_id were created by the
--     legacy platform onboarding (= workspace owner) and have no
--     membership yet -> attach as OWNER. Never upgrades a user who
--     already holds any membership in that tenant.
-- -------------------------------------------------------------
SET @s := IF(@c_tenant_col > 0, "INSERT IGNORE INTO tenant_memberships (tenant_id, user_id, role_id) SELECT u.tenant_id, u.id, tr.id FROM users u JOIN tenant_roles tr ON tr.tenant_id = u.tenant_id AND tr.name = 'OWNER' WHERE u.tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.tenant_id = u.tenant_id AND m.user_id = u.id)", 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

-- -------------------------------------------------------------
-- 7. Drop users.tenant_id (FK first, then column).
-- -------------------------------------------------------------
SET @fk_tenant := (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'tenant_id' AND REFERENCED_TABLE_NAME = 'tenants' LIMIT 1);

SET @s := IF(@c_tenant_col = 0, 'SELECT 1', IF(@fk_tenant IS NOT NULL, CONCAT('ALTER TABLE users DROP FOREIGN KEY `', @fk_tenant, '`'), 'SELECT 1'));
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @s := IF(@c_tenant_col > 0, 'ALTER TABLE users DROP COLUMN tenant_id', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

-- -------------------------------------------------------------
-- 8. Drop users.name (duplicate of first_name/last_name, backfilled in 1).
-- -------------------------------------------------------------
SET @c_name2 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'name');

SET @s := IF(@c_name2 > 0, 'ALTER TABLE users DROP COLUMN name', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

-- -------------------------------------------------------------
-- 9. Drop legacy tables. Order matters: user_roles references
--    roles, so user_roles must go first.
-- -------------------------------------------------------------
DROP TABLE IF EXISTS tenant_user_roles;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS tenant_roles_legacy;
