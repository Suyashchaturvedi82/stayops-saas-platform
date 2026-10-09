const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const repo = require('./auth.repo');

const ACCESS_EXPIRES_SEC = 15 * 60;
const REFRESH_DAYS = 30;

const OPERATOR_ROLES = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'FRONTDESK'];

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

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Register = create identity (if new) + attach RESIDENT membership.
 *
 * Global email identity: the same email may already exist from another
 * workspace. In that case we verify the password against the existing
 * identity and attach a membership instead of rejecting with 409 — this is
 * what allows OWNER in Workspace A and RESIDENT in Workspace B.
 *
 * `role` is never read from the payload: self-registration is always
 * RESIDENT. OWNER only comes from workspace onboarding.
 */
async function register(tenantId, data) {
  if (!tenantId) throw httpError(400, 'Workspace context required to register');

  const roleId = await repo.getRoleId(tenantId, 'RESIDENT');
  if (!roleId) throw httpError(400, 'Tenant roles not configured for this workspace');

  const existing = await repo.getUserByEmail(data.email);
  let userId;

  if (existing) {
    const isValid = await bcrypt.compare(data.password, existing.password_hash);
    if (!isValid) {
      // Do not reveal that the identity exists with a different password.
      throw httpError(409, 'An account with this email already exists. Sign in to join this workspace.');
    }
    userId = existing.id;
  } else {
    const password_hash = await bcrypt.hash(data.password, 10);
    userId = await repo.createUser({ ...data, password_hash });
  }

  await repo.assignMembership(tenantId, userId, roleId);

  return { userId, existing_identity: Boolean(existing) };
}

/**
 * Resolve which membership this login targets.
 * Audience: 'owner' (operator roles) or 'tenant' (resident-facing).
 * Precedence: explicit body tenant_slug (strict) > x-tenant header
 * (soft hint, only honoured if it is a real membership for this
 * audience — stale localStorage must not break login) > single match.
 */
function selectMembership(memberships, audience, requestedSlug, hintTenantId) {
  const allowed = audience === 'owner'
    ? memberships.filter((m) => OPERATOR_ROLES.includes(m.role))
    : memberships.filter((m) => !OPERATOR_ROLES.includes(m.role));

  if (allowed.length === 0) {
    throw httpError(403, audience === 'owner'
      ? 'No owner/operator access found for this account'
      : 'No resident access found for this account');
  }

  if (requestedSlug) {
    const match = allowed.find((m) => m.slug === requestedSlug);
    if (!match) {
      throw httpError(403, audience === 'owner'
        ? 'You do not have operator access in this workspace'
        : 'You do not have resident access in this workspace');
    }
    return match;
  }

  if (hintTenantId) {
    const hinted = allowed.find((m) => Number(m.tenant_id) === Number(hintTenantId));
    if (hinted) return hinted;
  }

  if (allowed.length === 1) return allowed[0];

  const err = httpError(409, 'Multiple workspaces found. Specify tenant_slug to continue.');
  err.details = {
    workspaces: allowed.map((m) => ({ slug: m.slug, name: m.tenant_name, role: m.role })),
  };
  throw err;
}

async function issueSession(user, membership) {
  const roles = await repo.getTenantRoles(membership.tenant_id, user.id);
  if (roles.length === 0) {
    throw httpError(403, 'User has no role in this tenant');
  }

  const tokenPayload = {
    sub: user.id,
    tenant_id: membership.tenant_id,
    roles,
    session_id: `${user.id}:${membership.tenant_id}`,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await repo.createSession({
    tenant_id: membership.tenant_id,
    user_id: user.id,
    device_id: user.device_id,
    refresh_token_hash: hashToken(refreshToken),
    expires_at: expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    accessExpiresIn: ACCESS_EXPIRES_SEC,
    tenant: { id: membership.tenant_id, slug: membership.slug, name: membership.tenant_name },
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      roles,
      audience: OPERATOR_ROLES.some((r) => roles.includes(r)) ? 'owner' : 'tenant',
    },
  };
}

async function login(tenantId, data, audience) {
  const user = await repo.getUserByEmail(data.email);
  if (!user || !user.is_active) {
    throw httpError(401, 'Invalid credentials');
  }

  const isValid = await bcrypt.compare(data.password, user.password_hash);
  if (!isValid) {
    throw httpError(401, 'Invalid credentials');
  }

  const memberships = await repo.getMemberships(user.id);

  // Body slug is an explicit user choice -> strict. Header is only a hint.
  const membership = selectMembership(
    memberships,
    audience,
    data.tenant_slug || null,
    tenantId || null
  );

  user.device_id = data.device_id;
  return issueSession(user, membership);
}

/**
 * Refresh derives identity from the refresh token signature itself —
 * no middleware dependency, so it works after the access token expires.
 */
async function refresh(data) {
  let decoded;
  try {
    decoded = jwt.verify(data.refresh_token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch (_err) {
    throw httpError(401, 'Invalid refresh token');
  }

  const userId = decoded.sub;
  const tenantId = decoded.tenant_id;
  if (!userId || !tenantId) {
    throw httpError(401, 'Invalid refresh token');
  }

  const session = await repo.getSession(tenantId, userId, data.device_id);
  if (!session || session.revoked_at) {
    throw httpError(401, 'Session not active');
  }

  if (hashToken(data.refresh_token) !== session.refresh_token_hash) {
    throw httpError(401, 'Refresh token mismatch');
  }

  // Membership may have been revoked between issuance and refresh.
  const roles = await repo.getTenantRoles(tenantId, userId);
  if (roles.length === 0) {
    throw httpError(403, 'User has no role in this tenant');
  }

  await repo.revokeSession(session.id);

  const tokenPayload = {
    sub: userId,
    tenant_id: tenantId,
    roles,
    session_id: `${userId}:${tenantId}`,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

  await repo.createSession({
    tenant_id: tenantId,
    user_id: userId,
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
  issueSession,
  OPERATOR_ROLES,
};
