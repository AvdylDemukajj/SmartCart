import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessAuditLog } from '../src/modules/admin/access.js';

test('canAccessAuditLog allows configured admin user', () => {
  const previousAdmin = process.env.SECURITY_AUDIT_ADMIN_USER_ID;
  process.env.SECURITY_AUDIT_ADMIN_USER_ID = 'root-admin';
  try {
    const allowed = canAccessAuditLog({ userId: 'root-admin', method: 'x-user-id', claims: null });
    assert.equal(allowed, true);
  } finally {
    if (previousAdmin === undefined) delete process.env.SECURITY_AUDIT_ADMIN_USER_ID;
    else process.env.SECURITY_AUDIT_ADMIN_USER_ID = previousAdmin;
  }
});

test('canAccessAuditLog allows jwt permission string and array', () => {
  const stringAllowed = canAccessAuditLog({
    userId: 'jwt-user',
    method: 'bearer-jwt',
    claims: { permissions: 'inventory:read security:audit:read' },
  });
  const arrayAllowed = canAccessAuditLog({
    userId: 'jwt-user',
    method: 'bearer-jwt',
    claims: { permissions: ['security:audit:read'] },
  });

  assert.equal(stringAllowed, true);
  assert.equal(arrayAllowed, true);
});
