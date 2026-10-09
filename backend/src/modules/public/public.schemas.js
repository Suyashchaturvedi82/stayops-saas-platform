const { z } = require('zod');

// Query filters for GET /public/pgs — all optional, combined with AND.
const listQuerySchema = z.object({
  query: z.object({
    // Free-text location match against city / locality / title / address.
    q: z.string().min(1).max(200).optional(),
    // Radius search (km) — requires both lat and lng.
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius_km: z.coerce.number().min(0.1).max(200).optional(),
    gender: z.enum(['MALE', 'FEMALE', 'COED']).optional(),
    min_rent: z.coerce.number().min(0).optional(),
    max_rent: z.coerce.number().min(0).optional(),
    room_type: z.enum(['AC', 'NON_AC']).optional(),
    // Comma-separated amenity list, all of which must match.
    amenities: z.string().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),
});

const upsertProfileSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    address_line: z.string().max(255).optional(),
    locality: z.string().max(120).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
    postal_code: z.string().max(20).optional(),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    gender_policy: z.enum(['MALE', 'FEMALE', 'COED', 'ANY']).optional(),
    amenities: z.array(z.string().min(1).max(60)).max(50).optional(),
    images: z.array(z.string().url().max(500)).max(20).optional(),
    contact_phone: z.string().max(15).optional(),
    is_listed: z.boolean().optional(),
  }),
});

const reviewSchema = z.object({
  body: z.object({
    rating: z.coerce.number().int().min(1).max(5),
    title: z.string().max(150).optional(),
    comment: z.string().max(4000).optional(),
  }),
});

const bookingRequestSchema = z.object({
  body: z.object({
    bed_id: z.coerce.number().int().positive(),
    check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required'),
    expected_check_out_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required')
      .optional()
      .nullable(),
    special_requests: z.string().max(2000).optional().nullable(),
  }),
});

module.exports = { listQuerySchema, upsertProfileSchema, reviewSchema, bookingRequestSchema };
