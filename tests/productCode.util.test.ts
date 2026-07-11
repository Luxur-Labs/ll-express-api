import { normalizeProductCode, productCodeLookupKey } from '../src/utils/productCode.util';

describe('productCode.util', () => {
  it('removes all whitespace from product codes', () => {
    expect(normalizeProductCode(' AB 12 3 ')).toBe('AB123');
    expect(normalizeProductCode('A\u00a0B\u200bC')).toBe('ABC');
  });

  it('builds case-insensitive lookup keys', () => {
    expect(productCodeLookupKey('ab 12')).toBe('ab12');
    expect(productCodeLookupKey('AB12')).toBe('ab12');
  });
});
