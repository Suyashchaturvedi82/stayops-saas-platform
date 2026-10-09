// Operator (owner-side) roles shared by routing, login and guards.
export const OPERATOR_ROLES = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'FRONTDESK'];

export function isOperator(user) {
  return (user?.roles || []).some((role) => OPERATOR_ROLES.includes(role));
}

/** Where a signed-in user lands: operators to admin, residents to dashboard. */
export function landingPathFor(user, fallback) {
  return fallback || (isOperator(user) ? '/admin/overview' : '/dashboard');
}
