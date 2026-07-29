import { clinicRequestOtpSchema, clinicVerifyOtpSchema, clinicPasswordLoginSchema, clinicSetPasswordSchema, clinicResetPasswordSchema } from '../src/schemas/clinicAuth.schema';

describe('clinicAuth.schema', () => {
  it('accepts clinic request OTP payload', () => {
    const result = clinicRequestOtpSchema.safeParse({
      body: { contactNumber: '9876543210' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts reset OTP purpose', () => {
    const result = clinicRequestOtpSchema.safeParse({
      body: { contactNumber: '9876543210', purpose: 'reset' },
    });
    expect(result.success).toBe(true);
  });

  it('requires 6-digit code for verify', () => {
    const bad = clinicVerifyOtpSchema.safeParse({
      body: { contactNumber: '9876543210', code: '12345' },
    });
    expect(bad.success).toBe(false);

    const good = clinicVerifyOtpSchema.safeParse({
      body: { contactNumber: '9876543210', code: '123456' },
    });
    expect(good.success).toBe(true);
  });

  it('validates password login and reset payloads', () => {
    expect(
      clinicPasswordLoginSchema.safeParse({
        body: { contactNumber: '9876543210', password: 'secret123' },
      }).success,
    ).toBe(true);

    expect(
      clinicResetPasswordSchema.safeParse({
        body: {
          contactNumber: '9876543210',
          code: '123456',
          currentPassword: 'oldpass12',
          newPassword: 'newpass12',
          confirmPassword: 'newpass12',
        },
      }).success,
    ).toBe(true);
  });

  it('validates set password confirmation', () => {
    const result = clinicSetPasswordSchema.safeParse({
      body: { newPassword: 'newpass12', confirmPassword: 'newpass12' },
    });
    expect(result.success).toBe(true);
  });
});
