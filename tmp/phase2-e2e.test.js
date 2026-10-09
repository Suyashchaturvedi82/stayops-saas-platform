/* Phase 2 E2E: booking state machine, race conditions, hold expiry */
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
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const uid = Date.now().toString(36);

const mysql = require(process.cwd() + '/node_modules/mysql2/promise');
require(process.cwd() + '/node_modules/dotenv').config();
let db;
const sql = async (query, params = []) => { const [rows] = await db.execute(query, params); return rows; };

(async () => {
  db = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, port: Number(process.env.DB_PORT || 3306),
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  console.log('== Setup: workspace, room, beds, residents ==');
  const oa = await j('/onboarding', { method: 'POST', body: JSON.stringify({
    tenant_name: `Engine PG ${uid}`, tenant_slug: `engine-${uid}`,
    owner_name: 'Olive Owner', email: `olive.${uid}@test.dev`,
    password: 'password123', phone: '9999999999', device_id: 'dev-o1' }) });
  ok('onboard 201', oa.status === 201, JSON.stringify(oa.body));
  const owner = oa.body.accessToken;
  const tenantId = oa.body.tenant.id;
  const slug = oa.body.tenant.slug;

  const room = await j('/rooms', { method: 'POST', headers: auth(owner),
    body: JSON.stringify({ room_number: `R${uid}`, floor_number: 1, room_type: 'AC', max_occupancy: 3, rent_per_month: 8000 }) });
  ok('room created', room.status === 201, JSON.stringify(room.body));
  const roomId = room.body.roomId;

  const bedIds = [];
  for (const n of ['B1', 'B2', 'B3']) {
    const b = await j('/beds', { method: 'POST', headers: auth(owner),
      body: JSON.stringify({ room_id: roomId, bed_number: `${n}-${uid}`, rent_per_month: 8000 }) });
    ok(`bed ${n} created`, b.status === 201, JSON.stringify(b.body));
    bedIds.push(b.body.bedId);
  }

  const tokens = {};
  for (const r of ['r1', 'r2', 'r3', 'r4']) {
    const reg = await j('/auth/register', { method: 'POST', body: JSON.stringify({
      email: `${r}.${uid}@test.dev`, password: 'password123', first_name: r,
      phone: '7777777777', gender: 'OTHER', tenant_slug: slug }) });
    ok(`register ${r}`, reg.status === 201, JSON.stringify(reg.body));
    const login = await j('/auth/tenant/login', { method: 'POST', body: JSON.stringify({
      email: `${r}.${uid}@test.dev`, password: 'password123', device_id: `dev-${r}` }) });
    ok(`login ${r}`, login.status === 200, JSON.stringify(login.body));
    tokens[r] = login.body.accessToken;
  }

  console.log('== A. Basic hold: AVAILABLE -> HELD ==');
  const hold1 = await j('/bookings', { method: 'POST', headers: auth(tokens.r1),
    body: JSON.stringify({ bed_id: bedIds[0], check_in_date: '2026-11-01' }) });
  ok('r1 hold 201', hold1.status === 201, JSON.stringify(hold1.body));
  ok('status HELD', hold1.body.status === 'HELD');
  ok('hold_expires_at set (~15m)', hold1.body.hold_expires_at && (new Date(hold1.body.hold_expires_at) - Date.now()) > 13 * 60 * 1000, String(hold1.body.hold_expires_at));
  let bed1 = await sql('SELECT status, is_available FROM beds WHERE id = ?', [bedIds[0]]);
  ok('bed1 status=HELD, is_available=0', bed1[0].status === 'HELD' && bed1[0].is_available === 0, JSON.stringify(bed1[0]));
  const redisHold = await sql(`SELECT id FROM bookings WHERE bed_id = ? AND booking_status = 'HELD'`, [bedIds[0]]);
  ok('booking row HELD exists', redisHold.length === 1);

  console.log('== B. Race: 2 users, same bed, concurrent ==');
  const race = await Promise.all([
    j('/bookings', { method: 'POST', headers: auth(tokens.r2), body: JSON.stringify({ bed_id: bedIds[1], check_in_date: '2026-11-01' }) }),
    j('/bookings', { method: 'POST', headers: auth(tokens.r3), body: JSON.stringify({ bed_id: bedIds[1], check_in_date: '2026-11-01' }) }),
  ]);
  const winners = race.filter((r) => r.status === 201);
  const losers = race.filter((r) => r.status !== 201);
  ok('exactly one winner', winners.length === 1, JSON.stringify(race.map((r) => r.status)));
  ok('loser got 409/400', losers.length === 1 && [400, 409].includes(losers[0].status), JSON.stringify(losers[0]?.body));
  const bed2Bookings = await sql(`SELECT id, user_id FROM bookings WHERE bed_id = ? AND booking_status IN ('HELD','PENDING_PAYMENT','BOOKED','OCCUPIED')`, [bedIds[1]]);
  ok('exactly one active booking on bed2', bed2Bookings.length === 1, `count=${bed2Bookings.length}`);
  const winnerIs = winners[0].body.bookingId;
  const r2Booking = await sql(`SELECT id, user_id FROM bookings WHERE bed_id = ? AND booking_status = 'HELD'`, [bedIds[1]]);
  const bed2Holder = r2Booking[0].user_id;

  console.log('== C. Race: same user double-submit ==');
  const dbl = await Promise.all([
    j('/bookings', { method: 'POST', headers: auth(tokens.r3), body: JSON.stringify({ bed_id: bedIds[2], check_in_date: '2026-11-01' }) }),
    j('/bookings', { method: 'POST', headers: auth(tokens.r3), body: JSON.stringify({ bed_id: bedIds[2], check_in_date: '2026-11-01' }) }),
  ]);
  ok('double-submit: one 201', dbl.filter((r) => r.status === 201).length === 1, JSON.stringify(dbl.map((r) => r.status)));
  ok('double-submit: other rejected', dbl.filter((r) => r.status !== 201).every((r) => [400, 409].includes(r.status)));
  const bed3Holds = await sql(`SELECT id FROM bookings WHERE bed_id = ? AND booking_status = 'HELD'`, [bedIds[2]]);
  ok('one HELD booking on bed3', bed3Holds.length === 1, `count=${bed3Holds.length}`);
  const r3BookingId = bed3Holds[0].id;

  console.log('== D. Payment: HELD -> PENDING_PAYMENT ==');
  const holder2 = await sql('SELECT id FROM users WHERE id = ?', [bed2Holder]);
  const pay = await j(`/v1/bookings/${winnerIs}/pay`, { method: 'POST', headers: auth(tokens.r2),
    body: JSON.stringify({ amount: 2000, payment_screenshot_url: 'shot.png', upi_transaction_id: 'upi-1' }) });
  ok('v1 pay 200', pay.status === 200, JSON.stringify(pay.body));
  ok('booking now PENDING_PAYMENT', pay.body.booking?.booking_status === 'PENDING_PAYMENT', pay.body.booking?.booking_status);
  let bed2 = await sql('SELECT status FROM beds WHERE id = ?', [bedIds[1]]);
  ok('bed2 PENDING_PAYMENT', bed2[0].status === 'PENDING_PAYMENT', bed2[0].status);
  const payRows = await sql(`SELECT id FROM payments WHERE booking_id = ?`, [winnerIs]);
  ok('payment row created', payRows.length === 1);

  console.log('== E. Approve: -> BOOKED ==');
  const ap1 = await j(`/bookings/${winnerIs}/approve`, { method: 'PUT', headers: auth(owner) });
  ok('approve PENDING_PAYMENT booking', ap1.status === 200, JSON.stringify(ap1.body));
  let bk2 = await sql('SELECT booking_status FROM bookings WHERE id = ?', [winnerIs]);
  ok('booking2 BOOKED', bk2[0].booking_status === 'BOOKED', bk2[0].booking_status);
  bed2 = await sql('SELECT status, is_available FROM beds WHERE id = ?', [bedIds[1]]);
  ok('bed2 status=BOOKED', bed2[0].status === 'BOOKED' && bed2[0].is_available === 0, JSON.stringify(bed2[0]));
  const res2 = await sql(`SELECT resident_status FROM residents WHERE booking_id = ?`, [winnerIs]);
  ok('resident PENDING_APPROVAL at BOOKED', res2.length === 1 && res2[0].resident_status === 'PENDING_APPROVAL', JSON.stringify(res2));

  // Approve a still-HELD booking directly (chain must pass PENDING_PAYMENT).
  const hold1Id = hold1.body.bookingId;
  const ap2 = await j(`/bookings/${hold1Id}/approve`, { method: 'PUT', headers: auth(owner) });
  ok('approve HELD booking (chain)', ap2.status === 200, JSON.stringify(ap2.body));
  bk2 = await sql('SELECT booking_status FROM bookings WHERE id = ?', [hold1Id]);
  ok('held booking now BOOKED', bk2[0].booking_status === 'BOOKED', bk2[0].booking_status);

  console.log('== F. Check-in: BOOKED -> OCCUPIED ==');
  const ci = await j(`/bookings/${hold1Id}/check-in`, { method: 'PUT', headers: auth(owner) });
  ok('check-in 200', ci.status === 200, JSON.stringify(ci.body));
  const bk1 = await sql('SELECT booking_status FROM bookings WHERE id = ?', [hold1Id]);
  ok('booking1 OCCUPIED', bk1[0].booking_status === 'OCCUPIED', bk1[0].booking_status);
  bed1 = await sql('SELECT status FROM beds WHERE id = ?', [bedIds[0]]);
  ok('bed1 OCCUPIED', bed1[0].status === 'OCCUPIED', bed1[0].status);
  const res1 = await sql(`SELECT resident_status FROM residents WHERE booking_id = ?`, [hold1Id]);
  ok('resident ACTIVE at OCCUPIED', res1[0]?.resident_status === 'ACTIVE', JSON.stringify(res1));

  console.log('== G. Reject: HELD -> REJECTED (bed released) ==');
  const rj = await j(`/bookings/${r3BookingId}/reject`, { method: 'PUT', headers: auth(owner) });
  ok('reject 200', rj.status === 200, JSON.stringify(rj.body));
  const bk3 = await sql('SELECT booking_status FROM bookings WHERE id = ?', [r3BookingId]);
  ok('booking3 REJECTED', bk3[0].booking_status === 'REJECTED', bk3[0].booking_status);
  bed1 = await sql('SELECT status, is_available FROM beds WHERE id = ?', [bedIds[2]]);
  ok('bed3 released to AVAILABLE', bed1[0].status === 'AVAILABLE' && bed1[0].is_available === 1, JSON.stringify(bed1[0]));

  console.log('== H. Checkout: OCCUPIED -> COMPLETED (bed released) ==');
  const active = await j('/residents/active', { headers: auth(owner) });
  ok('active residents list', active.status === 200 && active.body.length >= 1, JSON.stringify(active.body).slice(0, 120));
  const residentRow = (active.body || []).find((r) => r.email === `r1.${uid}@test.dev`);
  ok('found r1 resident', Boolean(residentRow));
  if (residentRow) {
    const co = await j(`/residents/${residentRow.id}/checkout`, { method: 'PUT', headers: auth(owner) });
    ok('checkout 200', co.status === 200, JSON.stringify(co.body));
    const bkDone = await sql('SELECT booking_status FROM bookings WHERE id = ?', [hold1Id]);
    ok('booking1 COMPLETED', bkDone[0].booking_status === 'COMPLETED', bkDone[0].booking_status);
    const bed1Now = await sql('SELECT status, is_available FROM beds WHERE id = ?', [bedIds[0]]);
    ok('bed1 back to AVAILABLE', bed1Now[0].status === 'AVAILABLE' && bed1Now[0].is_available === 1, JSON.stringify(bed1Now[0]));
  }

  console.log('== I. Invalid transitions rejected ==');
  const bad1 = await j(`/bookings/${r3BookingId}/approve`, { method: 'PUT', headers: auth(owner) });
  ok('approve REJECTED booking -> 409', bad1.status === 409, `got ${bad1.status}: ${JSON.stringify(bad1.body)}`);
  const bad2 = await j(`/v1/bookings/${winnerIs}/pay`, { method: 'POST', headers: auth(tokens.r2), body: JSON.stringify({ amount: 100, payment_screenshot_url: 'x.png' }) });
  ok('pay BOOKED booking -> 409', bad2.status === 409, `got ${bad2.status}`);
  const bad3 = await j('/bookings', { method: 'POST', headers: auth(tokens.r2), body: JSON.stringify({ bed_id: bedIds[2], check_in_date: '2026-11-05' }) });
  ok('user with active booking cannot hold again -> 400', bad3.status === 400, `got ${bad3.status}`);

  console.log('== J. Hold expiry: DB sweep (worker, <=75s) ==');
  const holdR4 = await j('/bookings', { method: 'POST', headers: auth(tokens.r4),
    body: JSON.stringify({ bed_id: bedIds[2], check_in_date: '2026-11-10' }) });
  ok('r4 hold bed3 201', holdR4.status === 201, JSON.stringify(holdR4.body));
  await sql(`UPDATE bookings SET hold_expires_at = NOW() - INTERVAL 1 MINUTE WHERE id = ?`, [holdR4.body.bookingId]);
  let expired = false;
  for (let i = 0; i < 18; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const [row] = await sql('SELECT booking_status FROM bookings WHERE id = ?', [holdR4.body.bookingId]);
    if (row.booking_status === 'EXPIRED') { expired = true; break; }
  }
  ok('sweep expired the hold (EXPIRED)', expired);
  const bed3AfterSweep = await sql('SELECT status, is_available FROM beds WHERE id = ?', [bedIds[2]]);
  ok('bed3 released after expiry', bed3AfterSweep[0].status === 'AVAILABLE' && bed3AfterSweep[0].is_available === 1, JSON.stringify(bed3AfterSweep[0]));

  console.log('== K. Lazy expiry: stale hold reaped on next claim ==');
  const holdR4b = await j('/bookings', { method: 'POST', headers: auth(tokens.r4),
    body: JSON.stringify({ bed_id: bedIds[2], check_in_date: '2026-11-11' }) });
  ok('r4 re-hold 201', holdR4b.status === 201, JSON.stringify(holdR4b.body));
  await sql(`UPDATE bookings SET hold_expires_at = NOW() - INTERVAL 1 MINUTE WHERE id = ?`, [holdR4b.body.bookingId]);
  // r4 cannot double-hold (active check), so claim via a fresh user.
  const reg5 = await j('/auth/register', { method: 'POST', body: JSON.stringify({
    email: `r5.${uid}@test.dev`, password: 'password123', first_name: 'r5',
    phone: '7777777777', gender: 'OTHER', tenant_slug: slug }) });
  ok('register r5', reg5.status === 201, JSON.stringify(reg5.body));
  const login5 = await j('/auth/tenant/login', { method: 'POST', body: JSON.stringify({
    email: `r5.${uid}@test.dev`, password: 'password123', device_id: 'dev-r5' }) });
  const holdR5 = await j('/bookings', { method: 'POST', headers: auth(login5.body.accessToken),
    body: JSON.stringify({ bed_id: bedIds[2], check_in_date: '2026-11-12' }) });
  ok('r5 claims stale-held bed', holdR5.status === 201, JSON.stringify(holdR5.body));
  const stale = await sql('SELECT booking_status FROM bookings WHERE id = ?', [holdR4b.body.bookingId]);
  ok('stale hold auto-EXPIRED', stale[0].booking_status === 'EXPIRED', stale[0].booking_status);

  console.log('== L. v1 cancel: HELD -> CANCELLED (bed released) ==');
  const canc = await j(`/v1/bookings/${holdR5.body.bookingId}/cancel`, { method: 'POST', headers: auth(login5.body.accessToken) });
  ok('cancel 200', canc.status === 200, JSON.stringify(canc.body));
  const bed3Final = await sql('SELECT status, is_available FROM beds WHERE id = ?', [bedIds[2]]);
  ok('bed3 AVAILABLE after cancel', bed3Final[0].status === 'AVAILABLE' && bed3Final[0].is_available === 1, JSON.stringify(bed3Final[0]));

  console.log(`\nPHASE 2 RESULT: pass=${pass} fail=${fail}`);
  await db.end();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error('TEST CRASH:', e);
  try { await db?.end(); } catch { /* ignore */ }
  process.exit(1);
});
