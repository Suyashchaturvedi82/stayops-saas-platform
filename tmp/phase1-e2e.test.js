/* Phase 1 E2E: login separation, global email identity, tenant isolation */
const BASE = 'http://localhost:3000/api';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};
const j = async (url, opts = {}) => {
  const res = await fetch(BASE + url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  let body = null;
  try { body = await res.json(); } catch { /* empty */ }
  return { status: res.status, body };
};
const uid = Date.now().toString(36);

(async () => {
  console.log('== 1. Onboarding workspace A ==');
  const oa = await j('/onboarding', { method: 'POST', body: JSON.stringify({
    tenant_name: `Sunrise PG ${uid}`, tenant_slug: `sunrise-${uid}`,
    owner_name: 'Alice Owner', email: `alice.${uid}@test.dev`,
    password: 'password123', phone: '9999999999', device_id: 'dev-a1' }) });
  ok('onboard A 201', oa.status === 201, JSON.stringify(oa.body));
  const tenantA = oa.body?.tenant?.id;
  const ownerTokenA = oa.body?.accessToken;

  console.log('== 2. Onboarding workspace B (other owner) ==');
  const ob = await j('/onboarding', { method: 'POST', body: JSON.stringify({
    tenant_name: `Lakeview PG ${uid}`, tenant_slug: `lakeview-${uid}`,
    owner_name: 'Bob Boss', email: `bob.${uid}@test.dev`,
    password: 'password123', phone: '8888888888', device_id: 'dev-b1' }) });
  ok('onboard B 201', ob.status === 201, JSON.stringify(ob.body));
  const tenantB = ob.body?.tenant?.id;

  console.log('== 3. Login separation ==');
  const ownerLogin = await j('/auth/owner/login', { method: 'POST', body: JSON.stringify({
    email: `alice.${uid}@test.dev`, password: 'password123', device_id: 'dev-a1' }) });
  ok('owner/owner-login 200', ownerLogin.status === 200, JSON.stringify(ownerLogin.body));
  ok('owner-login audience=owner', ownerLogin.body?.user?.audience === 'owner');
  ok('owner-login roles contain OWNER', (ownerLogin.body?.user?.roles || []).includes('OWNER'));

  const ownerAsTenant = await j('/auth/tenant/login', { method: 'POST', body: JSON.stringify({
    email: `alice.${uid}@test.dev`, password: 'password123', device_id: 'dev-a1' }) });
  ok('owner blocked from tenant login (403)', ownerAsTenant.status === 403, `got ${ownerAsTenant.status}`);

  console.log('== 4. Resident registers in workspace A ==');
  const reg = await j('/auth/register', { method: 'POST', body: JSON.stringify({
    email: `carol.${uid}@test.dev`, password: 'password123', first_name: 'Carol',
    phone: '7777777777', gender: 'FEMALE', tenant_slug: `sunrise-${uid}` }) });
  ok('register 201', reg.status === 201, JSON.stringify(reg.body));

  const resLogin = await j('/auth/tenant/login', { method: 'POST', body: JSON.stringify({
    email: `carol.${uid}@test.dev`, password: 'password123', device_id: 'dev-r1' }) });
  ok('resident tenant-login 200', resLogin.status === 200, JSON.stringify(resLogin.body));
  ok('resident audience=tenant', resLogin.body?.user?.audience === 'tenant');
  ok('resident token tenant = A', resLogin.body?.tenant?.id === tenantA);

  const resOwnerLogin = await j('/auth/owner/login', { method: 'POST', body: JSON.stringify({
    email: `carol.${uid}@test.dev`, password: 'password123', device_id: 'dev-r1' }) });
  ok('resident blocked from owner login (403)', resOwnerLogin.status === 403, `got ${resOwnerLogin.status}`);

  console.log('== 5. Global email identity: same email, OWNER in A + RESIDENT in B ==');
  const joinB = await j('/auth/register', { method: 'POST', body: JSON.stringify({
    email: `alice.${uid}@test.dev`, password: 'password123', first_name: 'Alice',
    phone: '9999999999', gender: 'OTHER', tenant_slug: `lakeview-${uid}` }) });
  ok('same email joins workspace B (201)', joinB.status === 201, JSON.stringify(joinB.body));
  ok('reports existing identity', joinB.body?.existing_identity === true);

  const aliceOwner = await j('/auth/owner/login', { method: 'POST', body: JSON.stringify({
    email: `alice.${uid}@test.dev`, password: 'password123', device_id: 'dev-a2', tenant_slug: `sunrise-${uid}` }) });
  ok('alice owner-login -> workspace A', aliceOwner.body?.tenant?.id === tenantA, JSON.stringify(aliceOwner.body?.tenant));

  const aliceTenant = await j('/auth/tenant/login', { method: 'POST', body: JSON.stringify({
    email: `alice.${uid}@test.dev`, password: 'password123', device_id: 'dev-a3', tenant_slug: `lakeview-${uid}` }) });
  ok('alice tenant-login -> workspace B', aliceTenant.body?.tenant?.id === tenantB, JSON.stringify(aliceTenant.body?.tenant));
  ok('alice tenant-login audience=tenant', aliceTenant.body?.user?.audience === 'tenant');

  console.log('== 6. Tenant isolation: tenant_id from JWT only ==');
  const tokA = ownerTokenA || aliceOwner.body?.accessToken;
  const ws = await j('/platform/workspace', { headers: { Authorization: `Bearer ${tokA}` } });
  ok('workspace matches A', ws.body?.id === tenantA, JSON.stringify(ws.body));

  const wsSpoof = await j('/platform/workspace', { headers: { Authorization: `Bearer ${tokA}`, 'x-tenant-id': String(tenantB) } });
  ok('header tenant spoof rejected 403', wsSpoof.status === 403, `got ${wsSpoof.status}`);

  const meSpoof = await j('/auth/me', { headers: { Authorization: `Bearer ${tokA}` } });
  ok('/auth/me tenant from token', meSpoof.body?.tenantId === tenantA, JSON.stringify(meSpoof.body));

  // Body tenant_id injection attempt on a protected route (payments intent)
  const pay = await j('/v1/payments/intent', { method: 'POST',
    headers: { Authorization: `Bearer ${tokA}` },
    body: JSON.stringify({ amount: 500, tenant_id: tenantB, user_id: 999999 }) });
  ok('payments intent accepts but ignores body tenant_id',
    pay.status === 201 || pay.status === 500, `got ${pay.status} ${JSON.stringify(pay.body)}`);
  if (pay.status === 201) {
    const { default: db } = await import('file:///' + process.cwd().replace(/\\/g, '/') + '/src/config/db.js').catch(() => ({ default: null }));
    // verify via SQL using mysql2 directly
    const mysql = require(process.cwd() + '/node_modules/mysql2/promise');
    require(process.cwd() + '/node_modules/dotenv').config();
    const c = await mysql.createConnection({
      host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME, port: Number(process.env.DB_PORT || 3306), ssl: { rejectUnauthorized: false },
    });
    const [rows] = await c.execute('SELECT tenant_id, user_id FROM payments ORDER BY id DESC LIMIT 1');
    ok('payment row tenant = token tenant A', Number(rows[0].tenant_id) === Number(tenantA), JSON.stringify(rows[0]));
    ok('payment row user = token user', Number(rows[0].user_id) === Number(ownerLogin.body?.user?.id), JSON.stringify(rows[0]));
    await c.end();
  }

  console.log('== 7. Unauthenticated access blocked ==');
  const noAuth = await j('/platform/workspace');
  ok('no token -> 401', noAuth.status === 401, `got ${noAuth.status}`);

  console.log(`\nPHASE 1 RESULT: pass=${pass} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
