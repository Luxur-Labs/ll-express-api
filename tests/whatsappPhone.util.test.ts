import { normalizePhoneE164, phonesMatch, toMetaWhatsAppRecipient } from '../src/utils/whatsappPhone.util';

describe('whatsappPhone.util', () => {
  it('normalizes 10-digit Indian numbers', () => {
    expect(normalizePhoneE164('9876543210', '91')).toBe('+919876543210');
  });

  it('keeps E.164 numbers', () => {
    expect(normalizePhoneE164('+919876543210', '91')).toBe('+919876543210');
  });

  it('matches numbers with different formatting', () => {
    expect(phonesMatch('9876543210', '+91 98765 43210', '91')).toBe(true);
  });

  it('formats Meta recipient without plus', () => {
    expect(toMetaWhatsAppRecipient('+919876543210')).toBe('919876543210');
  });
});
