const db = require('../config/db');

function requireTenant(req) {
  if (!req.tenant?.id) {
    const error = new Error('Tenant context is missing');
    error.statusCode = 400;
    throw error;
  }
  return req.tenant.id;
}

async function executeTenantQuery(sql, params, tenantId) {
  if (!sql.toLowerCase().includes('tenant_id')) {
    const error = new Error('Unsafe query blocked: tenant_id condition is required');
    error.statusCode = 500;
    throw error;
  }
  return db.execute(sql, [...params, tenantId]);
}

module.exports = {
  requireTenant,
  executeTenantQuery,
};
