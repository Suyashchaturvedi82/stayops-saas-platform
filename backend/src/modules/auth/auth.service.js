const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const repo = require('./auth.repo');

const ACCESS_EXPIRES_SEC = 15 * 60;
const REFRESH_DAYS = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_SEC,
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: `${REFRESH_DAYS}d`,
  });
}

async function register(tenantId, data) {
  const existing = await repo.getUserByEmail(data.email);
  if (existing) {
    const error = new Error('User already exists');
    error.statusCode = 409;
    throw error;
  }

  const password_hash = await bcrypt.hash(data.password, 10);
  const userId = await repo.createUser({ ...data, password_hash });

  const roleName = data.role || 'RESIDENT';
  const roleId = await repo.getRoleId(tenantId, roleName);
  if (!roleId) {
    const error = new Error(`Tenant role ${roleName} not configured`);
    error.statusCode = 400;
    throw error;
  }

  await repo.assignTenantRole(tenantId, userId, roleId);

  return { userId };
}

async function login(tenantId, data) {
  const user = await repo.getUserByEmail(data.email);
  if (!user) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const isValid = await bcrypt.compare(data.password, user.password_hash);
  if (!isValid) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const roles = await repo.getTenantRoles(tenantId, user.id);
  if (roles.length === 0) {
    const error = new Error('User has no role in this tenant');
    error.statusCode = 403;
    throw error;
  }

  const tokenPayload = {
    sub: user.id,
    tenant_id: tenantId,
    roles,
    session_id: `${user.id}:${data.device_id}`,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await repo.createSession({
    tenant_id: tenantId,
    user_id: user.id,
    device_id: data.device_id,
    refresh_token_hash: hashToken(refreshToken),
    expires_at: expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    accessExpiresIn: ACCESS_EXPIRES_SEC,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      roles,
    },
  };
}

async function refresh(tenantId, authUserId, data) {
  let decoded;
  try {
    decoded = jwt.verify(data.refresh_token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch (_err) {
    const error = new Error('Invalid refresh token');
    error.statusCode = 401;
    throw error;
  }

  if (Number(decoded.tenant_id) !== Number(tenantId) || Number(decoded.sub) !== Number(authUserId)) {
    const error = new Error('Refresh token does not belong to this tenant/user');
    error.statusCode = 403;
    throw error;
  }

  const session = await repo.getSession(tenantId, authUserId, data.device_id);
  if (!session || session.revoked_at) {
    const error = new Error('Session not active');
    error.statusCode = 401;
    throw error;
  }

  if (hashToken(data.refresh_token) !== session.refresh_token_hash) {
    const error = new Error('Refresh token mismatch');
    error.statusCode = 401;
    throw error;
  }

  await repo.revokeSession(session.id);

  const roles = await repo.getTenantRoles(tenantId, authUserId);
  const tokenPayload = {
    sub: authUserId,
    tenant_id: tenantId,
    roles,
    session_id: `${authUserId}:${data.device_id}`,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

  await repo.createSession({
    tenant_id: tenantId,
    user_id: authUserId,
    device_id: data.device_id,
    refresh_token_hash: hashToken(refreshToken),
    expires_at: expiresAt,
  });

  return { accessToken, refreshToken, accessExpiresIn: ACCESS_EXPIRES_SEC };
}

module.exports = {
  register,
  login,
  refresh,
};
