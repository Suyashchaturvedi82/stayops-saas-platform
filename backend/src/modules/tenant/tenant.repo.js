const db = require('../../config/db');

async function createTenant(payload) {
  const [result] = await db.execute(
    `INSERT INTO tenants (name, slug, status) VALUES (?, ?, 'ACTIVE')`,
    [payload.name, payload.slug]
  );
  return result.insertId;
}

async function listTenants() {
  const [rows] = await db.execute('SELECT id, name, slug, status, created_at FROM tenants ORDER BY id DESC');
  return rows;
}

async function createDefaultRoles(tenantId) {
  const roles = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'FRONTDESK', 'RESIDENT'];
  for (const role of roles) {
    await db.execute(
      `INSERT INTO tenant_roles (tenant_id, name)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE name = name`,
      [tenantId, role]
    );
  }
}

module.exports = {
  createTenant,
  listTenants,
  createDefaultRoles,
};
