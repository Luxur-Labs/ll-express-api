import { canUpdateOrder, hasPermission } from '../src/config/permissions';
import type { AuthUser } from '../src/types/auth';

function user(role: AuthUser['role'], id = 'user-1'): AuthUser {
  return { id, email: `${role}@test.com`, role };
}

describe('order permissions by role', () => {
  describe('orders.create', () => {
    it.each([
      ['SUPER_ADMIN', true],
      ['LAB_MANAGER', true],
      ['FRONT_OFFICE', true],
      ['DOCTOR', false],
      ['EMPLOYEE', false],
    ] as const)('%s => %s', (role, allowed) => {
      expect(hasPermission(role, 'orders.create')).toBe(allowed);
    });
  });

  describe('orders.update', () => {
    it.each([
      ['SUPER_ADMIN', true],
      ['LAB_MANAGER', true],
      ['FRONT_OFFICE', false],
      ['DOCTOR', false],
    ] as const)('%s has global orders.update => %s', (role, allowed) => {
      expect(hasPermission(role, 'orders.update')).toBe(allowed);
    });
  });

  describe('canUpdateOrder', () => {
    it('allows SUPER_ADMIN and LAB_MANAGER on any order', () => {
      expect(canUpdateOrder(user('SUPER_ADMIN'), { createdById: 'other' })).toBe(true);
      expect(canUpdateOrder(user('LAB_MANAGER'), { createdById: 'other' })).toBe(true);
    });

    it('allows FRONT_OFFICE only on orders they created', () => {
      const frontOffice = user('FRONT_OFFICE', 'fo-1');
      expect(canUpdateOrder(frontOffice, { createdById: 'fo-1' })).toBe(true);
      expect(canUpdateOrder(frontOffice, { createdById: 'fo-2' })).toBe(false);
      expect(canUpdateOrder(frontOffice, { createdById: null })).toBe(false);
    });

    it('denies DOCTOR and EMPLOYEE', () => {
      expect(canUpdateOrder(user('DOCTOR'), { createdById: 'user-1' })).toBe(false);
      expect(canUpdateOrder(user('EMPLOYEE'), { createdById: 'user-1' })).toBe(false);
    });
  });
});
