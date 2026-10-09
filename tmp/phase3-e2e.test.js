/* Phase 3 E2E: public marketplace discovery, details, booking request flow */
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

(async () => {
  console.log('== Setup: PG workspace with profile ==');
  const oa = await j('/onboarding', { method: 'POST', body: JSON.stringify({
    tenant_name: `Market PG ${uid}`, tenant_slug: `market-${uid}`,
    owner_name: 'Maya Manager', email: `maya.${uid}@test.dev`,
    password: 'password123', phone: '9999999999', device_id: 'dev-m1' }) });
  ok('onboard 201', oa.status === 201, JSON.stringify(oa.body));
  const owner = oa.body.accessToken;
  const slug = oa.body.tenant.slug;

  const room = await j('/rooms', { method: 'POST', headers: auth(owner),
    body: JSON.stringify({ room_number: `M${uid}`, floor_number: 2, room_type: 'AC', max_occupancy: 2, rent_per_month: 9500 }) });
  ok('room created (AC)', room.status === 201, JSON.stringify(room.body));
  const bed = await j('/beds', { method: 'POST', headers: auth(owner),
    body: JSON.stringify({ room_id: room.body.roomId, bed_number: `MB1-${uid}`, rent_per_month: 9500 }) });
  ok('bed created', bed.status === 201, JSON.stringify(bed.body));
  const bedId = bed.body.bedId;

  const prof = await j('/public/pgs/me', { method: 'PUT', headers: auth(owner), body: JSON.stringify({
    title: `Sunrise Haven ${uid}`,
    description: 'Cozy student PG with fast WiFi and homely food.',
    city: 'Pune', locality: 'Kothrud', address_line: '12, Lake Road',
    latitude: 18.5074, longitude: 73.8077,
    gender_policy: 'COED',
    amenities: ['WiFi', 'Laundry', 'Meals'],
    contact_phone: '9123456780',
    is_listed: true }) });
  ok('profile upsert 200', prof.status === 200, JSON.stringify(prof.body).slice(0, 200));
  ok('profile saved city', prof.body.profile?.city === 'Pune', String(prof.body.profile?.city));

  const otherOwner = await j('/onboarding', { method: 'POST', body: JSON.stringify({
    tenant_name: `Other PG ${uid}`, tenant_slug: `other-${uid}`,
    owner_name: 'Otto Owner', email: `otto.${uid}@test.dev`,
    password: 'password123', phone: '8888888888', device_id: 'dev-ot1' }) });
  ok('second workspace 201', otherOwner.status === 201, JSON.stringify(otherOwner.body));
  const otherToken = otherOwner.body.accessToken;
  const otherSlug = otherOwner.body.tenant.slug;
  await j('/public/pgs/me', { method: 'PUT', headers: auth(otherToken), body: JSON.stringify({
    title: `Faraway Hostel ${uid}`, city: 'Delhi', locality: 'Saket',
    latitude: 28.5245, longitude: 77.2066, gender_policy: 'MALE',
    amenities: ['Parking'], is_listed: true }) });

  console.log('== A. GET /public/pgs (no auth) with filters ==');
  const all = await j('/public/pgs');
  ok('lists PGs without auth', all.status === 200 && all.body.pgs.length >= 2, `count=${all.body.count}`);
  const mine = all.body.pgs.find((p) => p.slug === slug);
  ok('our PG listed with price/availability', mine && Number(mine.price_from) === 9500 && mine.beds_available >= 1, JSON.stringify(mine ?? null).slice(0, 200));

  const byCity = await j('/public/pgs?q=Pune');
  ok('filter q=Pune finds ours', byCity.body.pgs.some((p) => p.slug === slug), `count=${byCity.body.count}`);
  ok('filter q=Pune excludes Delhi', !byCity.body.pgs.some((p) => p.slug === otherSlug));

  const byGender = await j('/public/pgs?gender=COED');
  ok('filter gender=COED finds ours', byGender.body.pgs.some((p) => p.slug === slug));
  ok('filter gender=COED excludes MALE-only', !byGender.body.pgs.some((p) => p.slug === otherSlug));
  const genderAny = await j('/public/pgs?gender=FEMALE');
  ok('gender=FEMALE still shows ANY-policy PGs', Array.isArray(genderAny.body.pgs));

  const byRent = await j('/public/pgs?min_rent=9000&max_rent=10000');
  ok('filter rent 9000-10000 finds ours', byRent.body.pgs.some((p) => p.slug === slug), JSON.stringify(byRent.body.pgs.map((p) => [p.slug, p.price_from])).slice(0, 200));
  const outOfRange = await j('/public/pgs?min_rent=20000');
  ok('filter min_rent=20000 excludes ours', !outOfRange.body.pgs.some((p) => p.slug === slug));

  const byType = await j('/public/pgs?room_type=AC');
  ok('filter room_type=AC finds ours', byType.body.pgs.some((p) => p.slug === slug));
  const nonAc = await j('/public/pgs?room_type=NON_AC');
  ok('filter room_type=NON_AC excludes ours', !nonAc.body.pgs.some((p) => p.slug === slug));

  const byAmenity = await j('/public/pgs?amenities=WiFi,Laundry');
  ok('filter amenities (AND) finds ours', byAmenity.body.pgs.some((p) => p.slug === slug));
  const missingAmenity = await j('/public/pgs?amenities=WiFi,Pool');
  ok('filter amenities missing Pool excludes ours', !missingAmenity.body.pgs.some((p) => p.slug === slug));

  const byRadius = await j('/public/pgs?lat=18.52&lng=73.86&radius_km=30');
  ok('radius 30km from Pune finds ours', byRadius.body.pgs.some((p) => p.slug === slug), `count=${byRadius.body.count}`);
  ok('radius excludes Delhi PG', !byRadius.body.pgs.some((p) => p.slug === otherSlug));

  const combined = await j('/public/pgs?q=Pune&gender=COED&min_rent=9000&max_rent=10000&room_type=AC&amenities=WiFi&lat=18.5&lng=73.8&radius_km=50');
  ok('all filters combined still finds ours', combined.body.pgs.some((p) => p.slug === slug), JSON.stringify(combined.body).slice(0, 240));

  console.log('== B. GET /public/pgs/:id details ==');
  const det = await j(`/public/pgs/${slug}`);
  ok('details 200', det.status === 200, JSON.stringify(det.body).slice(0, 200));
  ok('details: profile fields', det.body.pg?.city === 'Pune' && det.body.pg?.gender_policy === 'COED');
  ok('details: amenities parsed', Array.isArray(det.body.pg?.amenities) && det.body.pg.amenities.includes('WiFi'));
  ok('details: rating starts 0/null', det.body.rating?.count === 0, JSON.stringify(det.body.rating));
  ok('details: room_types with rent + availability',
    det.body.room_types?.length === 1 && Number(det.body.room_types[0].rent_min) === 9500 && det.body.room_types[0].beds_available === 1,
    JSON.stringify(det.body.room_types));
  ok('details: availability totals', det.body.availability?.beds_total >= 1 && det.body.availability?.beds_available >= 1, JSON.stringify(det.body.availability));
  const missing = await j('/public/pgs/does-not-exist');
  ok('unknown slug 404', missing.status === 404, `got ${missing.status}`);

  console.log('== C. Booking request flow (login -> request -> approve) ==');
  // Stranger logged into ANOTHER workspace requests a bed here.
  const strangerReg = await j('/auth/register', { method: 'POST', body: JSON.stringify({
    email: `stranger.${uid}@test.dev`, password: 'password123', first_name: 'Sam',
    phone: '7777777777', gender: 'OTHER', tenant_slug: otherSlug }) });
  ok('stranger registers in other workspace', strangerReg.status === 201, JSON.stringify(strangerReg.body));
  const strangerLogin = await j('/auth/tenant/login', { method: 'POST', body: JSON.stringify({
    email: `stranger.${uid}@test.dev`, password: 'password123', device_id: 'dev-s1' }) });
  const strangerTok = strangerLogin.body.accessToken;

  const wrongWs = await j(`/public/pgs/${slug}/booking-requests`, { method: 'POST', headers: auth(strangerTok),
    body: JSON.stringify({ bed_id: bedId, check_in_date: '2026-12-01' }) });
  ok('wrong workspace -> 403 WORKSPACE_CONTEXT_REQUIRED', wrongWs.status === 403 && wrongWs.body.code === 'WORKSPACE_CONTEXT_REQUIRED' && wrongWs.body.workspace_slug === slug,
    JSON.stringify(wrongWs.body));

  // Tenant registers into THIS workspace, then requests the bed.
  const reg = await j('/auth/register', { method: 'POST', body: JSON.stringify({
    email: `tess.${uid}@test.dev`, password: 'password123', first_name: 'Tess',
    phone: '7777777777', gender: 'FEMALE', tenant_slug: slug }) });
  ok('tenant registers into PG workspace', reg.status === 201, JSON.stringify(reg.body));
  const login = await j('/auth/tenant/login', { method: 'POST', body: JSON.stringify({
    email: `tess.${uid}@test.dev`, password: 'password123', device_id: 'dev-t1' }) });
  const tok = login.body.accessToken;

  const req1 = await j(`/public/pgs/${slug}/booking-requests`, { method: 'POST', headers: auth(tok),
    body: JSON.stringify({ bed_id: bedId, check_in_date: '2026-12-01', special_requests: 'Quiet room please' }) });
  ok('booking request 201', req1.status === 201, JSON.stringify(req1.body).slice(0, 260));
  ok('request held with TTL', req1.body.booking?.status === 'HELD' && req1.body.booking?.hold_expires_at, JSON.stringify(req1.body.booking));

  const detAfterHold = await j(`/public/pgs/${slug}`);
  ok('availability reflects hold (0 available)', detAfterHold.body.availability?.beds_available === 0, JSON.stringify(detAfterHold.body.availability));

  const ap = await j(`/bookings/${req1.body.booking.id}/approve`, { method: 'PUT', headers: auth(owner) });
  ok('owner approves request', ap.status === 200, JSON.stringify(ap.body));
  const apd = await j('/v1/bookings', { headers: auth(owner) });
  const mineBooking = (apd.body || []).find((b) => b.id === req1.body.booking.id);
  ok('booking now BOOKED', mineBooking?.booking_status === 'BOOKED', String(mineBooking?.booking_status));

  console.log('== D. Reviews ==');
  const denied = await j(`/public/pgs/${slug}/reviews`, { method: 'POST', headers: auth(strangerTok),
    body: JSON.stringify({ rating: 5, comment: 'Never stayed but 5 stars' }) });
  ok('non-resident review -> 403', denied.status === 403, `got ${denied.status}`);

  const rev = await j(`/public/pgs/${slug}/reviews`, { method: 'POST', headers: auth(tok),
    body: JSON.stringify({ rating: 5, title: 'Great place', comment: 'Clean rooms and warm staff.' }) });
  ok('resident review 201', rev.status === 201, JSON.stringify(rev.body));
  ok('aggregated rating returned', Number(rev.body.rating?.average) === 5 && rev.body.rating?.count === 1, JSON.stringify(rev.body.rating));

  const det2 = await j(`/public/pgs/${slug}`);
  ok('details now show rating 5.0', Number(det2.body.rating?.average) === 5 && det2.body.rating?.count === 1, JSON.stringify(det2.body.rating));
  ok('reviews list includes comment', det2.body.reviews?.some((r) => r.comment === 'Clean rooms and warm staff.' && r.reviewer?.startsWith('Tess')),
    JSON.stringify(det2.body.reviews).slice(0, 200));
  const listed2 = await j('/public/pgs?q=Pune');
  const mine2 = listed2.body.pgs.find((p) => p.slug === slug);
  ok('list shows rating_avg 5.0', Number(mine2?.rating_avg) === 5, String(mine2?.rating_avg));

  console.log('== E. Unlist (is_listed=false) ==');
  const unlist = await j('/public/pgs/me', { method: 'PUT', headers: auth(owner), body: JSON.stringify({ is_listed: false }) });
  ok('unlist 200', unlist.status === 200, JSON.stringify(unlist.body).slice(0, 120));
  const after = await j('/public/pgs');
  ok('unlisted PG gone from discovery', !after.body.pgs.some((p) => p.slug === slug));
  const detGone = await j(`/public/pgs/${slug}`);
  ok('unlisted PG details 404', detGone.status === 404, `got ${detGone.status}`);

  console.log(`\nPHASE 3 RESULT: pass=${pass} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH:', e); process.exit(1); });
