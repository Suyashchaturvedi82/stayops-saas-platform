-- StayOps AI upgrade migration
-- Run after the original database schema + 2026-02-20 SaaS migration.

CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  title VARCHAR(180) NOT NULL,
  category ENUM('GENERAL','PLUMBING','ELECTRICAL','CLEANING','INTERNET','FOOD','SECURITY') NOT NULL DEFAULT 'GENERAL',
  priority ENUM('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
  status ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  description TEXT NOT NULL,
  assignee_user_id BIGINT NULL,
  due_at DATETIME NULL,
  resolution_note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_maintenance_tenant_status (tenant_id, status),
  INDEX idx_maintenance_tenant_priority (tenant_id, priority),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_rooms_tenant_room ON rooms(tenant_id, room_number);
CREATE INDEX idx_beds_tenant_room ON beds(tenant_id, room_id);
CREATE INDEX idx_bookings_tenant_user_status ON bookings(tenant_id, user_id, booking_status);
CREATE INDEX idx_payments_tenant_user_status ON payments(tenant_id, user_id, payment_status);

ALTER TABLE payments MODIFY booking_id INT NULL;
ALTER TABLE rooms DROP INDEX room_number;
ALTER TABLE rooms ADD UNIQUE KEY uniq_tenant_room_number (tenant_id, room_number);
