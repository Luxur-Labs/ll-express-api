/** True when order lifecycle status is cancelled (sheet may use "Cancel" or "CANCELLED"). */
export function isCancelledOrderStatus(status?: string | null): boolean {
  if (!status) return false;
  const normalized = status.trim().toUpperCase().replace(/\s+/g, '_');
  return normalized === 'CANCELLED' || normalized === 'CANCEL';
}
