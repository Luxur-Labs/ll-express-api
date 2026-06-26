import {
  countToothUnits,
  expandToothNumbers,
  LOWER_ARCH_TEETH,
  normalizeToothNumberString,
  UPPER_ARCH_TEETH,
} from '../src/utils/toothNumber.util';

describe('toothNumber.util', () => {
  it('expands a single range', () => {
    expect(expandToothNumbers('24-27')).toEqual([24, 25, 26, 27]);
    expect(normalizeToothNumberString('24-27')).toBe('24,25,26,27');
  });

  it('expands mixed singles and ranges', () => {
    expect(expandToothNumbers('43 45-46')).toEqual([43, 45, 46]);
    expect(normalizeToothNumberString('43 45-46')).toBe('43,45,46');
  });

  it('expands multiple ranges', () => {
    expect(expandToothNumbers('14-18 25-27')).toEqual([14, 15, 16, 17, 18, 25, 26, 27]);
    expect(normalizeToothNumberString('14-18 25-27')).toBe('14,15,16,17,18,25,26,27');
  });

  it('handles reversed ranges and en-dash', () => {
    expect(expandToothNumbers('27-24')).toEqual([24, 25, 26, 27]);
    expect(expandToothNumbers('45–46')).toEqual([45, 46]);
  });

  it('counts expanded units', () => {
    expect(countToothUnits('14-18 25-27')).toBe(8);
    expect(countToothUnits('')).toBe(0);
  });

  it('maps text-only upper/lower arch labels to FDI ranges', () => {
    const upperSorted = [...UPPER_ARCH_TEETH].sort((a, b) => a - b);
    const lowerSorted = [...LOWER_ARCH_TEETH].sort((a, b) => a - b);
    const bothSorted = [...upperSorted, ...lowerSorted];

    expect(expandToothNumbers('Upper Night Guard')).toEqual(upperSorted);
    expect(expandToothNumbers('lower')).toEqual(lowerSorted);
    expect(expandToothNumbers('Upper and Lower Essix retainers')).toEqual(bothSorted);
    expect(expandToothNumbers('upper&lower')).toEqual(bothSorted);
    expect(normalizeToothNumberString('Lower CD')).toBe(lowerSorted.join(','));
  });

  it('does not map arch labels when digits are present', () => {
    expect(expandToothNumbers('Upper 24')).toEqual([24]);
    expect(expandToothNumbers('24-27')).toEqual([24, 25, 26, 27]);
  });

  it('returns empty for text without upper/lower and no digits', () => {
    expect(expandToothNumbers('RPD')).toEqual([]);
    expect(expandToothNumbers('Model Charges')).toEqual([]);
  });
});
