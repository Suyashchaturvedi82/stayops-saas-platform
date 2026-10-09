const db = require('../../config/db');

async function getUserByEmail(email) {
  const [rows] = await db.execute(
    `SELECT id, email, password_hash, first_name, last_name, is_active
     FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function createUser(payload) {
  const [result] = await db.execute(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone, gender)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [payload.email, payload.password_hash, payload.first_name, payload.last_name || null, payload.phone, payload.gender]
  );
  return result.insertId;
}

async function getRoleId(tenantId, roleName) {
  const [rows] = await db.execute(
    `SELECT id FROM tenant_roles WHERE tenant_id = ? AND name = ? LIMIT 1`,
    [tenantId, roleName]
  );
  return rows[0]?.id;
}

/** Attach (or keep) a membership. Global email identity: the same user
 *  row may hold memberships in any number of workspaces. */
async function assignMembership(tenantId, userId, roleId) {
  await db.execute(
    `INSERT INTO tenant_memberships (tenant_id, user_id, role_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE role_id = role_id`,
    [tenantId, userId, roleId]
  );
}

async function getTenantRoles(tenantId, userId) {
  const [rows] = await db.execute(
    `SELECT tr.name
     FROM tenant_memberships tm
     JOIN tenant_roles tr ON tr.id = tm.role_id
     WHERE tm.tenant_id = ? AND tm.user_id = ?`,
    [tenantId, userId]
  );
  return rows.map((row) => row.name);
}

/** All workspaces this identity belongs to, with the role held in each. */
async function getMemberships(userId) {
  const [rows] = await db.execute(
    `SELECT tm.tenant_id, t.slug, t.name AS tenant_name, t.status, tr.name AS role
     FROM tenant_memberships tm
     JOIN tenants t ON t.id = tm.tenant_id
     JOIN tenant_roles tr ON tr.id = tm.role_id
     WHERE tm.user_id = ?
     ORDER BY tm.tenant_id`,
    [userId]
  );
  return rows;
}

async function getTenantBySlug(slug) {
  const [rows] = await db.execute(
    `SELECT id, slug, name, status FROM tenants WHERE slug = ? LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
}

async function getTenantById(tenantId) {
  const [rows] = await db.execute(
    `SELECT id, slug, name, status FROM tenants WHERE id = ? LIMIT 1`,
    [tenantId]
  );
  return rows[0] || null;
}

async function createSession(payload) {
  await db.execute(
    `INSERT INTO auth_sessions (tenant_id, user_id, device_id, refresh_token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [payload.tenant_id, payload.user_id, payload.device_id, payload.refresh_token_hash, payload.expires_at
    ]
  );
}

async function getSession(tenantId, userId, deviceId) {
  const [rows] = await db.execute(
    `SELECT id, refresh_token_hash, expires_at, revoked_at
     FROM auth_sessions
     WHERE tenant_id = ? AND user_id = ? AND device_id = ?
     ORDER BY id DESC LIMIT 1`,
    [tenantId, userId, deviceId]
  );
  return rows[0] || null;
}

async function revokeSession(sessionId) {
  await db.execute(
    `UPDATE auth_sessions SET revoked_at = NOW() WHERE id = ?`,
    [sessionId]
  );
}

module.exports = {
  getUserByEmail,
  createUser,
  getRoleId,
  assignMembership,
  getTenantRoles,
  getMemberships,
  getTenantBySlug,
  getTenantById,
  createSession,
  getSession,
  revokeSession,
};
