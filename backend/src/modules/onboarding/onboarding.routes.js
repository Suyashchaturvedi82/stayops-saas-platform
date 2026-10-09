const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');

const router = express.Router();

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 100);
}

function sign(payload, expiresIn) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET, { expiresIn });
}

router.post('/', async (req, res, next) => {
  const {
    tenant_name,
    tenant_slug,
    owner_name,
    email,
    password,
    phone,
    gender = 'OTHER',
    device_id = `web-${Date.now()}`,
  } = req.body;

  if (!tenant_name || !owner_name || !email || !password || !phone || password.length < 8) {
    return res.status(400).json({
      message: 'Workspace name, owner name, email, phone and an 8+ character password are required.',
    });
  }

  if (!(process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET)) {
    console.error('Onboarding failed: JWT_ACCESS_SECRET / JWT_SECRET env var is missing');
    return res.status(500).json({ message: 'Server auth configuration is missing.' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const slug = slugify(tenant_slug || tenant_name);

    const [[existingTenant]] = await conn.execute(
      'SELECT id FROM tenants WHERE slug = ? LIMIT 1',
      [slug]
    );
    if (existingTenant) {
      const error = new Error('Workspace slug already exists. Try another name.');
      error.statusCode = 409;
      throw error;
    }

    // Global email identity: an existing person may onboard a NEW workspace
    // (becoming its OWNER). Reuse the identity when the password matches.
    const [[existingUser]] = await conn.execute(
      'SELECT id, password_hash FROM users WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()]
    );
    if (existingUser && !(await bcrypt.compare(password, existingUser.password_hash))) {
      const error = new Error('An account already exists for this email. Sign in instead.');
      error.statusCode = 409;
      throw error;
    }

    const [tenantResult] = await conn.execute(
      `INSERT INTO tenants (name, slug, status) VALUES (?, ?, 'ACTIVE')`,
      [tenant_name.trim(), slug]
    );
    const tenantId = tenantResult.insertId;

    const roles = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'FRONTDESK', 'RESIDENT'];
    for (const role of roles) {
      await conn.execute(
        `INSERT INTO tenant_roles (tenant_id, name) VALUES (?, ?)`,
        [tenantId, role]
      );
    }

    const parts = owner_name.trim().split(/\s+/);
    const firstName = parts.shift();
    const lastName = parts.join(' ') || null;

    let userId;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      const [userResult] = await conn.execute(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, gender)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [email.trim().toLowerCase(), passwordHash, firstName, lastName, phone.trim(), gender]
      );
      userId = userResult.insertId;
    }

    const [[ownerRole]] = await conn.execute(
      `SELECT id FROM tenant_roles WHERE tenant_id = ? AND name = 'OWNER' LIMIT 1`,
      [tenantId]
    );
    await conn.execute(
      `INSERT INTO tenant_memberships (tenant_id, user_id, role_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE role_id = role_id`,
      [tenantId, userId, ownerRole.id]
    );

    const payload = {
      sub: userId,
      tenant_id: tenantId,
      roles: ['OWNER'],
      session_id: `${userId}:${device_id}`,
    };
    const accessToken = sign(payload, 15 * 60);
    const refreshToken = sign(payload, '30d');
    const hash = require('crypto').createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await conn.execute(
      `INSERT INTO auth_sessions (tenant_id, user_id, device_id, refresh_token_hash, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, userId, device_id, hash, expiresAt]
    );

    await conn.commit();

    res.status(201).json({
      accessToken,
      refreshToken,
      accessExpiresIn: 15 * 60,
      tenant: { id: tenantId, name: tenant_name.trim(), slug },
      user: {
        id: userId,
        email: email.trim().toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        roles: ['OWNER'],
      },
    });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    console.error('Onboarding error:', err.code, err.sqlMessage || err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Workspace or account already exists.' });
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;