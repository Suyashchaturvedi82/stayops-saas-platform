const { z } = require('zod');

// NOTE: `role` is deliberately NOT accepted on register. Roles are never
// trusted from the client: self-registration always yields RESIDENT, and
// OWNER is only ever granted through workspace onboarding.

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    first_name: z.string().min(1),
    last_name: z.string().optional(),
    phone: z.string().min(8),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    // Workspace to join: slug in body, or supplied via x-tenant-slug/id header.
    tenant_slug: z.string().min(1).optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    device_id: z.string().min(4),
    // Optional: disambiguate when the identity holds several memberships
    // for this audience. May also arrive as x-tenant-slug / x-tenant-id.
    tenant_slug: z.string().min(1).optional(),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refresh_token: z.string().min(10),
    device_id: z.string().min(4),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
};
