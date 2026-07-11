import { LOGIN_DISABLED_ROLES, isApiAccessRole } from '../src/config/permissions';

describe('permissions role access', () => {
  it('treats DOCTOR and EMPLOYEE as login-disabled', () => {
    expect(LOGIN_DISABLED_ROLES).toEqual(['DOCTOR', 'EMPLOYEE']);
    expect(isApiAccessRole('DOCTOR')).toBe(false);
    expect(isApiAccessRole('EMPLOYEE')).toBe(false);
  });

  it('allows admin portal roles', () => {
    expect(isApiAccessRole('SUPER_ADMIN')).toBe(true);
    expect(isApiAccessRole('LAB_MANAGER')).toBe(true);
    expect(isApiAccessRole('FRONT_OFFICE')).toBe(true);
  });
});
