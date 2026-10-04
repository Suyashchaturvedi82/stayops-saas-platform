const repo = require('./tenant.repo');

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 100);
}

async function createTenant(data) {
  const slug = data.slug || slugify(data.name);
  const tenantId = await repo.createTenant({ name: data.name, slug });
  await repo.createDefaultRoles(tenantId);
  return { tenantId, slug };
}

async function listTenants() {
  return repo.listTenants();
}

module.exports = {
  createTenant,
  listTenants,
};
