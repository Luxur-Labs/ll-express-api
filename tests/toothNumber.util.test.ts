import {
  countToothUnits,
  expandToothNumbers,
  normalizeToothNumberString,
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
});
