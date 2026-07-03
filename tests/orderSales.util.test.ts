import {
  computeOrderProductLineBilling,
  computeOrderProductLineTotal,
  parseUnitDiscountsMap,
  roundOrderMoney,
  sumOrdersSales,
} from '../src/utils/orderSales.util';

describe('orderSales.util', () => {
  describe('parseUnitDiscountsMap', () => {
    it('parses object and JSON string maps', () => {
      expect(parseUnitDiscountsMap({ '24': 10, '32': 20 })).toEqual({ '24': 10, '32': 20 });
      expect(parseUnitDiscountsMap('{"14":50,"23":20}')).toEqual({ '14': 50, '23': 20 });
    });

    it('ignores invalid entries and out-of-range percentages', () => {
      expect(parseUnitDiscountsMap({ '24': -5, '32': 150, x: 'bad' })).toEqual({});
      expect(parseUnitDiscountsMap('not-json')).toEqual({});
    });
  });

  describe('computeOrderProductLineBilling', () => {
    it('applies separate discount % per selected tooth', () => {
      const billing = computeOrderProductLineBilling({
        unitNumbers: '24,32',
        unitPrice: 1000,
        discountPercent: 0,
        unitDiscounts: { '24': 10, '32': 20 },
        product: { price: 1000, discount: 0 },
      });
      expect(billing.units).toBe(2);
      expect(billing.gross).toBe(2000);
      expect(billing.unitDiscountAmount).toBe(300);
      expect(billing.lineTotal).toBe(1700);
    });

    it('combines product discount and per-tooth discounts', () => {
      const billing = computeOrderProductLineBilling({
        unitNumbers: '24,32',
        unitPrice: 1000,
        discountPercent: 10,
        unitDiscounts: { '24': 5, '32': 0 },
        product: { price: 1000, discount: 0 },
      });
      expect(billing.productDiscountAmount).toBe(200);
      expect(billing.unitDiscountAmount).toBe(50);
      expect(billing.lineTotal).toBe(1750);
    });

    it('expands tooth ranges for unit count and billing', () => {
      const billing = computeOrderProductLineBilling({
        unitNumbers: '24-25',
        unitPrice: 500,
        discountPercent: 0,
        unitDiscounts: { '24': 10, '25': 0 },
        product: { price: 500, discount: 0 },
      });
      expect(billing.units).toBe(2);
      expect(billing.gross).toBe(1000);
      expect(billing.unitDiscountAmount).toBe(50);
      expect(billing.lineTotal).toBe(950);
    });

    it('falls back to catalog price and discount when line fields omitted', () => {
      const billing = computeOrderProductLineBilling({
        unitNumbers: '14',
        product: { price: 800, discount: 12.5 },
      });
      expect(billing.rate).toBe(800);
      expect(billing.productDiscountPercent).toBe(12.5);
      expect(billing.lineTotal).toBe(700);
    });

    it('returns zero totals when no teeth selected', () => {
      const billing = computeOrderProductLineBilling({
        unitNumbers: '',
        unitPrice: 1000,
        discountPercent: 10,
        product: { price: 1000, discount: 0 },
      });
      expect(billing.units).toBe(0);
      expect(billing.lineTotal).toBe(0);
    });
  });

  it('computeOrderProductLineTotal matches billing lineTotal', () => {
    const op = {
      unitNumbers: '24',
      unitPrice: 1000,
      discountPercent: 5,
      unitDiscounts: { '24': 10 },
      product: { price: 1000, discount: 0 },
    };
    expect(computeOrderProductLineTotal(op)).toBe(
      computeOrderProductLineBilling(op).lineTotal,
    );
  });

  it('sumOrdersSales aggregates multiple orders', () => {
    const total = sumOrdersSales([
      {
        orderProducts: [
          { unitNumbers: '24', unitPrice: 1000, discountPercent: 0, product: { price: 1000, discount: 0 } },
        ],
      },
      {
        orderProducts: [
          { unitNumbers: '32', unitPrice: 500, discountPercent: 0, product: { price: 500, discount: 0 } },
        ],
      },
    ]);
    expect(total).toBe(1500);
  });

  it('roundOrderMoney rounds to 2 decimal places', () => {
    expect(roundOrderMoney(10.005)).toBe(10.01);
    expect(roundOrderMoney(10.004)).toBe(10);
  });
});
