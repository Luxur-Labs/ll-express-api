const RANGE_SEP = /[-–—−]/;

/**
 * Expand sheet tooth values into individual FDI numbers.
 * Examples:
 * - "24-27" -> [24, 25, 26, 27]
 * - "43 45-46" -> [43, 45, 46]
 * - "14-18 25-27" -> [14, 15, 16, 17, 18, 25, 26, 27]
 */
export function expandToothNumbers(input: string): number[] {
  const raw = String(input ?? '').trim();
  if (!raw) return [];

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
