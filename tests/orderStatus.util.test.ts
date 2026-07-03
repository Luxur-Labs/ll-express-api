import { isCancelledOrderStatus } from '../src/utils/orderStatus';

describe('orderStatus.util', () => {
  it('detects cancelled statuses from sheet and API values', () => {
    expect(isCancelledOrderStatus('CANCELLED')).toBe(true);
    expect(isCancelledOrderStatus('Cancel')).toBe(true);
    expect(isCancelledOrderStatus('cancelled')).toBe(true);
    expect(isCancelledOrderStatus('NEW')).toBe(false);
    expect(isCancelledOrderStatus(undefined)).toBe(false);
  });
});
