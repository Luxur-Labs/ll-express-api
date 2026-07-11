/** Strip all whitespace from product codes for consistent matching and storage. */
export function normalizeProductCode(value: unknown): string {
  return String(value ?? '')
    .replace(/[\s\u00a0\u200b-\u200d\ufeff]+/g, '')
    .trim();
}

/** Case-insensitive lookup key for product code maps. */
export function productCodeLookupKey(value: unknown): string {
  return normalizeProductCode(value).toLowerCase();
}
