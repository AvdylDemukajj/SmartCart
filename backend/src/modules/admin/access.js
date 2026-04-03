function normalizePermissions(permissionsClaim) {
  if (typeof permissionsClaim === 'string') {
    return permissionsClaim
      .split(/[,\s]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (Array.isArray(permissionsClaim)) {
    return permissionsClaim
      .filter((entry) => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeRoles(roleClaim, rolesClaim) {
  const roles = [];
  if (typeof roleClaim === 'string') roles.push(roleClaim.trim());
  if (Array.isArray(rolesClaim)) {
    for (const role of rolesClaim) {
      if (typeof role === 'string' && role.trim()) roles.push(role.trim());
    }
  }
  return roles;
}

export function canAccessAuditLog(authContext) {
  if (!authContext?.userId) return false;
  const defaultAdmin = process.env.SECURITY_AUDIT_ADMIN_USER_ID ?? 'admin';
  const configuredAdmins = (process.env.SECURITY_AUDIT_ADMIN_USERS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const adminUsers = new Set([defaultAdmin, ...configuredAdmins]);
  if (adminUsers.has(authContext.userId)) return true;
  if (authContext.method !== 'bearer-jwt' || !authContext.claims) return false;

  const roles = normalizeRoles(authContext.claims.role, authContext.claims.roles);
  if (roles.some((role) => ['admin', 'security_admin', 'platform_admin'].includes(role))) return true;

  const permissions = normalizePermissions(authContext.claims.permissions);
  return permissions.includes('security:audit:read');
}
