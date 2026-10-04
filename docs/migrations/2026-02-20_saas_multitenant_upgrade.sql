-- SaaS multi-tenant upgrade migration

CREATE TABLE IF NOT EXISTS tenants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  status ENUM('ACTIVE','SUSPENDED') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  name ENUM('OWNER','MANAGER','ACCOUNTANT','FRONTDESK','RESIDENT') NOT NULL,
  UNIQUE KEY uniq_tenant_role (tenant_id, name),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_user_roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  UNIQUE KEY uniq_user_role_tenant (tenant_id, user_id, role_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  device_id VARCHAR(128) NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_session_lookup (tenant_id, user_id, device_id)
);

ALTER TABLE rooms ADD COLUMN tenant_id BIGINT NULL;
ALTER TABLE beds ADD COLUMN tenant_id BIGINT NULL;
ALTER TABLE bookings ADD COLUMN tenant_id BIGINT NULL;
ALTER TABLE residents ADD COLUMN tenant_id BIGINT NULL;
ALTER TABLE payments ADD COLUMN tenant_id BIGINT NULL;
ALTER TABLE mess_plans ADD COLUMN tenant_id BIGINT NULL;
ALTER TABLE mess_subscriptions ADD COLUMN tenant_id BIGINT NULL;
ALTER TABLE mess_daily_logs ADD COLUMN tenant_id BIGINT NULL;

CREATE INDEX idx_rooms_tenant ON rooms(tenant_id);
CREATE INDEX idx_beds_tenant ON beds(tenant_id);
CREATE INDEX idx_bookings_tenant_status ON bookings(tenant_id, booking_status);
CREATE INDEX idx_residents_tenant_status ON residents(tenant_id, resident_status);
CREATE INDEX idx_payments_tenant_status ON payments(tenant_id, payment_status);
CREATE INDEX idx_mess_plans_tenant ON mess_plans(tenant_id);
CREATE INDEX idx_mess_sub_tenant_status ON mess_subscriptions(tenant_id, subscription_status);
CREATE INDEX idx_mess_logs_tenant_date ON mess_daily_logs(tenant_id, meal_date);

CREATE TABLE IF NOT EXISTS plans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL,
  bed_limit INT NULL,
  features JSON NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  plan_id BIGINT NOT NULL,
  status ENUM('TRIAL','ACTIVE','PAST_DUE','CANCELLED') NOT NULL,
  started_at DATETIME NOT NULL,
  current_period_end DATETIME NOT NULL,
  cancelled_at DATETIME NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  resident_user_id BIGINT NULL,
  invoice_no VARCHAR(64) NOT NULL,
  status ENUM('DRAFT','ISSUED','PAID','VOID','OVERDUE') NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  balance_due DECIMAL(12,2) NOT NULL,
  UNIQUE KEY uniq_tenant_invoice_no (tenant_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  invoice_id BIGINT NOT NULL,
  item_type ENUM('RENT','MESS','LATE_FEE','OTHER') NOT NULL,
  description VARCHAR(255) NOT NULL,
  qty DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  booking_id BIGINT NULL,
  resident_user_id BIGINT NULL,
  entry_type ENUM('DEBIT','CREDIT') NOT NULL,
  category ENUM('RENT','MESS','PAYMENT','REFUND','LATE_FEE','ADJUSTMENT') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  occurred_at DATETIME NOT NULL,
  reference_type VARCHAR(64),
  reference_id BIGINT
);

CREATE TABLE IF NOT EXISTS late_fees (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  invoice_id BIGINT NOT NULL,
  rule_id BIGINT NULL,
  amount DECIMAL(12,2) NOT NULL,
  applied_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS refunds (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  payment_id BIGINT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('PENDING','SUCCESS','FAILED') NOT NULL,
  gateway_refund_id VARCHAR(128) NULL
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  channel ENUM('EMAIL','WHATSAPP','SMS') NOT NULL,
  key_name VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NULL,
  body TEXT NOT NULL,
  UNIQUE KEY uniq_template (tenant_id, channel, key_name)
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  channel ENUM('EMAIL','WHATSAPP','SMS','INAPP') NOT NULL,
  template_key VARCHAR(100),
  payload JSON NOT NULL,
  status ENUM('QUEUED','SENT','FAILED') NOT NULL DEFAULT 'QUEUED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  notification_id BIGINT NOT NULL,
  provider_message_id VARCHAR(128) NULL,
  status ENUM('SENT','DELIVERED','READ','FAILED') NOT NULL,
  raw_response JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  actor_user_id BIGINT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id BIGINT NULL,
  before_state JSON NULL,
  after_state JSON NULL,
  ip VARCHAR(64),
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NULL,
  user_id BIGINT NULL,
  event_type VARCHAR(100) NOT NULL,
  severity ENUM('LOW','MEDIUM','HIGH') NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NULL,
  provider VARCHAR(50) NOT NULL,
  event_id VARCHAR(128) NOT NULL,
  payload JSON NOT NULL,
  processed_at DATETIME NULL,
  UNIQUE KEY uniq_provider_event (provider, event_id)
);

CREATE TABLE IF NOT EXISTS fact_bookings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  booking_id BIGINT NOT NULL,
  date_key DATE NOT NULL,
  status VARCHAR(32) NOT NULL,
  room_id BIGINT,
  bed_id BIGINT
);

CREATE TABLE IF NOT EXISTS fact_payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  payment_id BIGINT NOT NULL,
  date_key DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(32) NOT NULL,
  category VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  trigger_type ENUM('CRON','EVENT') NOT NULL,
  trigger_config JSON NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  action_config JSON NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);
