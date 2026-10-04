const db = require('../../config/db');

async function getUserByEmail(email) {
  const [rows] = await db.execute(
    `SELECT id, email, password_hash, first_name, last_name
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

async function assignTenantRole(tenantId, userId, roleId) {
  await db.execute(
    `INSERT INTO tenant_user_roles (tenant_id, user_id, role_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE role_id = role_id`,
    [tenantId, userId, roleId]
  );
}

async function getTenantRoles(tenantId, userId) {
  const [rows] = await db.execute(
    `SELECT tr.name
     FROM tenant_user_roles tur
     JOIN tenant_roles tr ON tr.id = tur.role_id
     WHERE tur.tenant_id = ? AND tur.user_id = ?`,
    [tenantId, userId]
  );
  return rows.map((row) => row.name);
}

async function createSession(payload) {
  await db.execute(
    `INSERT INTO auth_sessions (tenant_id, user_id, device_id, refresh_token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [payload.tenant_id, payload.user_id, payload.device_id, payload.refresh_token_hash, payload.expires_at]
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
  assignTenantRole,
  getTenantRoles,
  createSession,
  getSession,
  revokeSession,
};
