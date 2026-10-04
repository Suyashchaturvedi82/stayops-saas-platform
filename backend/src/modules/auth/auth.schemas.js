const { z } = require('zod');

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    first_name: z.string().min(1),
    last_name: z.string().optional(),
    phone: z.string().min(8),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    role: z.enum(['OWNER', 'MANAGER', 'ACCOUNTANT', 'FRONTDESK', 'RESIDENT']).optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    device_id: z.string().min(4),
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
