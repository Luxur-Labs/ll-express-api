const RANGE_SEP = /[-–—−]/;

/** FDI permanent dentition arch ranges (lab convention). */
export const UPPER_ARCH_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_ARCH_TEETH = [38, 37, 36, 35, 34, 33, 32, 31, 41, 42, 43, 44, 45, 46, 47, 48];

function hasDigit(s: string): boolean {
  return /\d/.test(s);
}

/**
 * When the cell is text-only and mentions upper/lower, map to full arch teeth.
 * Examples: "Upper Night Guard" -> 18-28, "lower" -> 38-48, "Upper and Lower" -> both arches.
 */
export function expandArchLabelToothNumbers(input: string): number[] | null {
  const raw = String(input ?? '').trim();
  if (!raw || hasDigit(raw)) return null;

  const text = raw.toLowerCase();
  const hasUpper = /\bupper\b/.test(text);
  const hasLower = /\blower\b/.test(text);
  if (!hasUpper && !hasLower) return null;

  const nums: number[] = [];
  if (hasUpper) nums.push(...UPPER_ARCH_TEETH);
  if (hasLower) nums.push(...LOWER_ARCH_TEETH);
  return [...new Set(nums)].sort((a, b) => a - b);
}

/**
 * Expand sheet tooth values into individual FDI numbers.
 * Examples:
 * - "24-27" -> [24, 25, 26, 27]
 * - "43 45-46" -> [43, 45, 46]
 * - "14-18 25-27" -> [14, 15, 16, 17, 18, 25, 26, 27]
 * - "Upper Night Guard" -> upper arch (18-28)
 */
export function expandToothNumbers(input: string): number[] {
  const raw = String(input ?? '').trim();
  if (!raw) return [];

  const archTeeth = expandArchLabelToothNumbers(raw);
  if (archTeeth) return archTeeth;

  const tokens = raw
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const nums: number[] = [];

  for (const token of tokens) {
    const parts = token.split(RANGE_SEP).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 1) {
      const n = parseInt(parts[0], 10);
      if (Number.isFinite(n)) nums.push(n);
      continue;
    }
    if (parts.length === 2) {
      let start = parseInt(parts[0], 10);
      let end = parseInt(parts[1], 10);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      if (start > end) [start, end] = [end, start];
      for (let i = start; i <= end; i++) nums.push(i);
    }
  }

  return [...new Set(nums)].sort((a, b) => a - b);
}

/** Canonical comma-separated tooth list for storage (sorted, de-duplicated). */
export function normalizeToothNumberString(input: string | null | undefined): string {
  if (input === null || input === undefined) return '';
  return expandToothNumbers(String(input)).join(',');
}

export function countToothUnits(input: string | null | undefined): number {
  if (!input?.trim()) return 0;
  return expandToothNumbers(input).length;
}
