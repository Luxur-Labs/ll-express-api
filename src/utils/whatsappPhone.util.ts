/** E.164 for WhatsApp; 10-digit local numbers get default country code (e.g. 91). */
export function normalizePhoneE164(
  raw: string | null | undefined,
  defaultCountryCode = '91',
): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits.length) return null;
  if (raw.trim().startsWith('+')) {
    return `+${digits}`;
  }
  const cc = defaultCountryCode.replace(/\D/g, '') || '91';
  if (digits.length === 10) {
    return `+${cc}${digits}`;
  }
  return `+${digits}`;
}

/** Meta Cloud API expects digits only (no +), e.g. 919876543210 */
export function toMetaWhatsAppRecipient(e164: string): string {
  return e164.replace(/\D/g, '');
}

export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
  defaultCountryCode = '91',
): boolean {
  const na = normalizePhoneE164(a, defaultCountryCode);
  const nb = normalizePhoneE164(b, defaultCountryCode);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.slice(-10) === nb.slice(-10);
}
