import {
  getOrderProductValidationError,
  normalizeEnterReason,
  requiresEnterReason,
} from '../src/utils/orderProductFields';

describe('orderProductFields', () => {
  const baseProduct = {
    productId: '11111111-1111-1111-1111-111111111111',
    shadeType: 'A1',
    finishingInstructions: 'Polish',
    componentDetails: 'Ti',
    incaseOfAllAbutments: 'Separate',
    occlusalStaining: 'Light',
    ponticDesign: 'Ovate',
    repeatCorrections: 'New',
    enterReason: '',
  };

  it('does not require enterReason for New lines', () => {
    expect(requiresEnterReason('New')).toBe(false);
    expect(getOrderProductValidationError(baseProduct)).toBeNull();
  });

  it('requires enterReason for Repeat and Corrections', () => {
    expect(requiresEnterReason('Repeat')).toBe(true);
    expect(requiresEnterReason('Corrections')).toBe(true);

    expect(
      getOrderProductValidationError({ ...baseProduct, repeatCorrections: 'Repeat', enterReason: '' }),
    ).toContain('Enter reason is required');

    expect(
      getOrderProductValidationError({
        ...baseProduct,
        repeatCorrections: 'Corrections',
        enterReason: 'Shade Mismatch',
      }),
    ).toBeNull();
  });

  it('normalizes enterReason to empty for New', () => {
    expect(normalizeEnterReason('New', 'ignored')).toBe('');
    expect(normalizeEnterReason('Repeat', 'Fitting Issue')).toBe('Fitting Issue');
  });
});
