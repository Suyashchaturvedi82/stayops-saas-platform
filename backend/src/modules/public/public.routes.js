const express = require('express');
const db = require('../../config/db');
const authSaasMiddleware = require('../../middleware/authSaasMiddleware');
const rbacMiddleware = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');
const machine = require('../bookings/bookingStateMachine');
const { listQuerySchema, upsertProfileSchema, reviewSchema, bookingRequestSchema } = require('./public.schemas');

const router = express.Router();

/**
 * PHASE 3: Public marketplace & tenant discovery.
 *
 * No tenant JWT context is needed to browse — only to request a
 * booking (and then the token's tenant MUST be the PG's tenant,
 * so tenant_id still comes exclusively from the session token).
 */

/* ------------------------------------------------------------------ */
/* Resolve a public PG identifier (slug or numeric tenant id)          */
/* ------------------------------------------------------------------ */
async function resolvePg(idOrSlug) {
  const numeric = /^\d+$/.test(String(idOrSlug));
  // t.* columns come after p.* so profile columns (id, tenant_id) never
  // shadow the tenant identity we compare against the session token.
  const [rows] = await db.execute(
    `SELECT p.*, t.id AS tenant_id, t.slug, t.name, t.status
     FROM pg_profiles p
     JOIN tenants t ON t.id = p.tenant_id
     WHERE ${numeric ? 't.id = ?' : 't.slug = ?'}
     LIMIT 1`,
    [numeric ? Number(idOrSlug) : String(idOrSlug)]
  );
  if (rows.length === 0) return null;
  const { tenant_id: tenantId, slug, name, status, ...profile } = rows[0];
  if (status !== 'ACTIVE' || !profile.is_listed) return null;
  return { tenantId, slug, name, profile };
}

/** 403 unless the session tenant is this PG's workspace. */
function requireWorkspace(pg, req, res) {
  if (Number(req.tenant.id) !== Number(pg.tenantId)) {
    res.status(403).json({
      code: 'WORKSPACE_CONTEXT_REQUIRED',
      message: `Sign in or register for ${pg.name} to continue.`,
      workspace_slug: pg.slug,
    });
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* GET /public/pgs — discovery with filters                            */
/* ------------------------------------------------------------------ */
router.get('/pgs', validateRequest(listQuerySchema), async (req, res, next) => {
  try {
    const q = req.validated.query;
    const where = [`t.status = 'ACTIVE'`, 'p.is_listed = 1'];
    const params = [];

    if (q.q) {
      where.push(`(p.city LIKE ? OR p.locality LIKE ? OR p.title LIKE ? OR p.address_line LIKE ? OR t.name LIKE ?)`);
      const like = `%${q.q}%`;
      params.push(like, like, like, like, like);
    }

    if (q.gender) {
      // Exact policy or open-to-all ('ANY') listings.
      where.push(`p.gender_policy IN (?, 'ANY')`);
      params.push(q.gender);
    }

    if (q.room_type) {
      where.push(`EXISTS (SELECT 1 FROM rooms rm WHERE rm.tenant_id = t.id AND rm.room_type = ?)`);
      params.push(q.room_type);
    }

    const priceSub = `(SELECT MIN(bed.rent_per_month) FROM beds bed JOIN rooms rm ON rm.id = bed.room_id WHERE rm.tenant_id = t.id)`;
    if (q.min_rent !== undefined) {
      where.push(`${priceSub} >= ?`);
      params.push(q.min_rent);
    }
    if (q.max_rent !== undefined) {
      where.push(`${priceSub} <= ?`);
      params.push(q.max_rent);
    }

    if (q.amenities) {
      for (const raw of q.amenities.split(',')) {
        const amenity = raw.trim();
        if (!amenity) continue;
        where.push(`JSON_CONTAINS(p.amenities, ?)`);
        params.push(JSON.stringify(amenity));
      }
    }

    if (q.lat !== undefined && q.lng !== undefined) {
      const radius = q.radius_km !== undefined ? q.radius_km : 25;
      where.push(`p.latitude IS NOT NULL AND p.longitude IS NOT NULL`);
      where.push(
        `(6371 * ACOS(
            COS(RADIANS(?)) * COS(RADIANS(p.latitude)) * COS(RADIANS(p.longitude) - RADIANS(?))
            + SIN(RADIANS(?)) * SIN(RADIANS(p.latitude))
         )) <= ?`
      );
      params.push(q.lat, q.lng, q.lat, radius);
    }

    const limit = q.limit !== undefined ? q.limit : 20;
    const offset = q.offset !== undefined ? q.offset : 0;

    const [rows] = await db.execute(
      `SELECT t.id, t.slug, t.name, p.title, p.description, p.address_line, p.locality, p.city, p.state,
              p.latitude, p.longitude, p.gender_policy, p.amenities, p.images,
              (SELECT ROUND(AVG(rv.rating), 1) FROM pg_reviews rv WHERE rv.tenant_id = t.id) AS rating_avg,
              (SELECT COUNT(*) FROM pg_reviews rv WHERE rv.tenant_id = t.id) AS rating_count,
              ${priceSub} AS price_from,
              (SELECT COUNT(*) FROM beds bed JOIN rooms rm ON rm.id = bed.room_id WHERE rm.tenant_id = t.id) AS beds_total,
              (SELECT COUNT(*) FROM beds bed JOIN rooms rm ON rm.id = bed.room_id WHERE rm.tenant_id = t.id AND bed.status = 'AVAILABLE') AS beds_available
       FROM tenants t
       JOIN pg_profiles p ON p.tenant_id = t.id
       WHERE ${where.join(' AND ')}
       ORDER BY (rating_avg IS NULL), rating_avg DESC, t.name ASC
       LIMIT ${Math.max(1, Math.min(Number(limit), 100))} OFFSET ${Math.max(0, Number(offset))}`,
      params
    );

    res.json({ count: rows.length, pgs: rows.map((row) => ({
      ...row,
      rating_avg: row.rating_avg === null ? null : Number(row.rating_avg),
      price_from: row.price_from === null ? null : Number(row.price_from),
      beds_total: Number(row.beds_total) || 0,
      beds_available: Number(row.beds_available) || 0,
    })) });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /public/pgs/:id — full details, reviews, availability           */
/* ------------------------------------------------------------------ */
router.get('/pgs/:id', async (req, res, next) => {
  try {
    const pg = await resolvePg(req.params.id);
    if (!pg) return res.status(404).json({ message: 'PG not found' });

    const [[rating]] = await db.execute(
      `SELECT ROUND(AVG(rating), 1) AS average, COUNT(*) AS count FROM pg_reviews WHERE tenant_id = ?`,
      [pg.tenantId]
    );

    const [reviews] = await db.execute(
      `SELECT rv.rating, rv.title, rv.comment, rv.created_at,
              CONCAT(u.first_name, ' ', LEFT(COALESCE(u.last_name, ''), 1), '.') AS reviewer
       FROM pg_reviews rv
       JOIN users u ON u.id = rv.user_id
       WHERE rv.tenant_id = ?
       ORDER BY rv.id DESC
       LIMIT 10`,
      [pg.tenantId]
    );

    const [roomTypes] = await db.execute(
      `SELECT rm.room_type,
              COUNT(DISTINCT rm.id) AS rooms,
              MIN(bed.rent_per_month) AS rent_min,
              MAX(bed.rent_per_month) AS rent_max,
              SUM(CASE WHEN bed.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS beds_available,
              COUNT(bed.id) AS beds_total
       FROM rooms rm
       LEFT JOIN beds bed ON bed.room_id = rm.id
       WHERE rm.tenant_id = ?
       GROUP BY rm.room_type
       ORDER BY rent_min ASC`,
      [pg.tenantId]
    );

    const [[avail]] = await db.execute(
      `SELECT COUNT(*) AS beds_total,
              SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) AS beds_available
       FROM beds WHERE tenant_id = ?`,
      [pg.tenantId]
    );

    res.json({
      pg: {
        id: pg.tenantId,
        slug: pg.slug,
        name: pg.name,
        title: pg.profile.title,
        description: pg.profile.description,
        address_line: pg.profile.address_line,
        locality: pg.profile.locality,
        city: pg.profile.city,
        state: pg.profile.state,
        postal_code: pg.profile.postal_code,
        latitude: pg.profile.latitude,
        longitude: pg.profile.longitude,
        gender_policy: pg.profile.gender_policy,
        amenities: pg.profile.amenities || [],
        images: pg.profile.images || [],
        contact_phone: pg.profile.contact_phone,
      },
      rating: { average: rating.average, count: rating.count },
      reviews,
      room_types: roomTypes.map((rt) => ({
        room_type: rt.room_type,
        rooms: Number(rt.rooms) || 0,
        rent_min: rt.rent_min === null ? null : Number(rt.rent_min),
        rent_max: rt.rent_max === null ? null : Number(rt.rent_max),
        beds_available: Number(rt.beds_available) || 0,
        beds_total: Number(rt.beds_total) || 0,
      })),
      availability: {
        beds_total: Number(avail.beds_total) || 0,
        beds_available: Number(avail.beds_available) || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* POST /public/pgs/:id/booking-requests                               */
/* Search -> details -> login/register -> request -> owner approves.   */
/* ------------------------------------------------------------------ */
router.post(
  '/pgs/:id/booking-requests',
  authSaasMiddleware,
  validateRequest(bookingRequestSchema),
  async (req, res, next) => {
    try {
      const pg = await resolvePg(req.params.id);
      if (!pg) return res.status(404).json({ message: 'PG not found' });
      if (!requireWorkspace(pg, req, res)) return;

      const { bed_id, check_in_date, expected_check_out_date, special_requests } = req.validated.body;
      const booking = await machine.holdBed({
        tenantId: pg.tenantId,
        userId: req.auth.userId,
        bedId: bed_id,
        checkInDate: check_in_date,
        expectedCheckOutDate: expected_check_out_date || null,
        specialRequests: special_requests || null,
      });

      res.status(201).json({
        message: `Booking requested. Your bed is held for ${machine.HOLD_TTL_MINUTES} minutes while ${pg.name} reviews it.`,
        booking: {
          id: booking.id,
          status: booking.booking_status,
          bed_id: booking.bed_id,
          check_in_date: booking.check_in_date,
          hold_expires_at: booking.hold_expires_at,
        },
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
      next(err);
    }
  }
);

/* ------------------------------------------------------------------ */
/* POST /public/pgs/:id/reviews — only residents who stayed           */
/* ------------------------------------------------------------------ */
router.post('/pgs/:id/reviews', authSaasMiddleware, validateRequest(reviewSchema), async (req, res, next) => {
  try {
    const pg = await resolvePg(req.params.id);
    if (!pg) return res.status(404).json({ message: 'PG not found' });
    if (!requireWorkspace(pg, req, res)) return;

    const { rating, title, comment } = req.validated.body;
    const userId = req.auth.userId;

    const [stayed] = await db.execute(
      `SELECT id FROM bookings
       WHERE tenant_id = ? AND user_id = ? AND booking_status IN ('BOOKED', 'OCCUPIED', 'COMPLETED')
       ORDER BY id DESC LIMIT 1`,
      [pg.tenantId, userId]
    );
    if (stayed.length === 0) {
      return res.status(403).json({ message: 'Only residents who completed a stay can review this PG' });
    }

    await db.execute(
      `INSERT INTO pg_reviews (tenant_id, user_id, booking_id, rating, title, comment)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), title = VALUES(title), comment = VALUES(comment)`,
      [pg.tenantId, userId, stayed[0].id, rating, title || null, comment || null]
    );

    const [[agg]] = await db.execute(
      `SELECT ROUND(AVG(rating), 1) AS average, COUNT(*) AS count FROM pg_reviews WHERE tenant_id = ?`,
      [pg.tenantId]
    );
    res.status(201).json({ message: 'Review saved', rating: agg });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/* PUT /public/pgs/me — owner-managed listing (upsert)                 */
/* ------------------------------------------------------------------ */
router.put('/pgs/me', authSaasMiddleware, rbacMiddleware('OWNER'), validateRequest(upsertProfileSchema), async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const b = req.validated.body;

    const [[existing]] = await db.execute('SELECT * FROM pg_profiles WHERE tenant_id = ? LIMIT 1', [tenantId]);
    // Request body wins, then the stored value, then NULL — never undefined
    // (mysql2 rejects undefined bind parameters).
    const pick = (v, fallback) => (v !== undefined ? v : fallback !== undefined ? fallback : null);
    const merged = {
      title: pick(b.title, existing?.title),
      description: pick(b.description, existing?.description),
      address_line: pick(b.address_line, existing?.address_line),
      locality: pick(b.locality, existing?.locality),
      city: pick(b.city, existing?.city),
      state: pick(b.state, existing?.state),
      postal_code: pick(b.postal_code, existing?.postal_code),
      latitude: pick(b.latitude, existing?.latitude),
      longitude: pick(b.longitude, existing?.longitude),
      gender_policy: pick(b.gender_policy, existing?.gender_policy) ?? 'ANY',
      amenities: JSON.stringify(pick(b.amenities, existing?.amenities) || []),
      images: JSON.stringify(pick(b.images, existing?.images) || []),
      contact_phone: pick(b.contact_phone, existing?.contact_phone),
      is_listed: b.is_listed !== undefined ? (b.is_listed ? 1 : 0) : existing?.is_listed ?? 1,
    };

    if (existing) {
      await db.execute(
        `UPDATE pg_profiles SET title = ?, description = ?, address_line = ?, locality = ?, city = ?,
                state = ?, postal_code = ?, latitude = ?, longitude = ?, gender_policy = ?,
                amenities = ?, images = ?, contact_phone = ?, is_listed = ?
         WHERE tenant_id = ?`,
        [merged.title, merged.description, merged.address_line, merged.locality, merged.city,
         merged.state, merged.postal_code, merged.latitude, merged.longitude, merged.gender_policy,
         merged.amenities, merged.images, merged.contact_phone, merged.is_listed, tenantId]
      );
    } else {
      await db.execute(
        `INSERT INTO pg_profiles (tenant_id, title, description, address_line, locality, city, state,
                postal_code, latitude, longitude, gender_policy, amenities, images, contact_phone, is_listed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, merged.title, merged.description, merged.address_line, merged.locality, merged.city,
         merged.state, merged.postal_code, merged.latitude, merged.longitude, merged.gender_policy,
         merged.amenities, merged.images, merged.contact_phone, merged.is_listed]
      );
    }

    const [[saved]] = await db.execute('SELECT * FROM pg_profiles WHERE tenant_id = ? LIMIT 1', [tenantId]);
    res.json({ message: 'PG listing updated', profile: saved });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
