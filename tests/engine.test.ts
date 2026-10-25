import {
  applyRounding,
  calculateProduct,
  checkTiers,
  defaultModel,
  exampleProducts,
  sensitivity,
  summarise,
} from '../src/engine';
import type { Model, Product, ProductResult } from '../src/engine';

const calc = (m: Model, p: Product): ProductResult => {
  const r = calculateProduct(m, p);
  if (!r.complete) throw new Error(r.statusText);
  return r;
};
const base: Product = { id: 'x', name: 'Test', unitCost: 20, supplierShipping: 0 };

describe('applyRounding', () => {
  it.each([
    [12.341, 'cent', false, 12.34],
    [12.341, 'cent', true, 12.35],
    [12.34, 'cent', true, 12.34],
    [12.0, '99', false, 12.99],
    [12.99, '99', false, 12.99],
    [13.0, '99', false, 13.99],
    [12.96, '95', false, 13.95],
    [12.95, '95', false, 12.95],
    [12.01, 'whole', false, 13],
    [12, 'whole', false, 12],
  ] as const)('%s with %s (up=%s) gives %s', (x, rule, up, want) => {
    expect(applyRounding(x, rule, up)).toBe(want);
  });
});

describe('calculateProduct', () => {
  it('flags incomplete rows', () => {
    const m = defaultModel();
    expect(calculateProduct(m, { id: 'a', name: 'No cost', unitCost: null }).status).toBe('INCOMPLETE');
    expect(calculateProduct(m, { ...base, market: 'Unknown market' }).complete).toBe(false);
    expect(calculateProduct(m, { id: 'b', name: '', unitCost: null }).statusText).toBe('');
  });

  it('profit walk sums to net profit', () => {
    const m = defaultModel();
    for (const p of exampleProducts()) {
      const r = calc(m, p);
      const sum = r.profitWalk.reduce((s, l) => s + l.amount, 0);
      expect(sum).toBeCloseTo(r.netProfit, 9);
    }
  });

  it('break even price gives zero profit before buffer with the expected method', () => {
    const m = defaultModel();
    const be = calc(m, base).breakEvenPrice!;
    const r = calc(m, { ...base, priceOverride: be });
    expect(r.netProfitBeforeBuffer).toBeCloseTo(0, 9);
  });

  it('minimum safe price gives zero worst case profit after buffer', () => {
    const m = defaultModel();
    const safe = calc(m, base).minimumSafePrice!;
    const r = calc(m, { ...base, priceOverride: safe });
    expect(r.netProfitWorst).toBeCloseTo(0, 9);
  });

  it('recommended price meets target margin and minimum profit in the worst case', () => {
    const m = defaultModel();
    for (const unitCost of [1, 5, 20, 80]) {
      const r0 = calc(m, { ...base, unitCost });
      const r = calc(m, { ...base, unitCost, priceOverride: r0.recommendedPrice });
      expect(r.netMarginWorst).toBeGreaterThanOrEqual(m.settings.targetMarginPct - 1e-9);
      expect(r.netProfitWorst).toBeGreaterThanOrEqual(m.settings.minProfitPerOrder - 1e-9);
    }
  });

  it('applies platform commission as a share of net revenue', () => {
    const m = defaultModel();
    const r0 = calc(m, { ...base, priceOverride: 50 });
    m.settings.platformFeePct = 0.15;
    const r1 = calc(m, { ...base, priceOverride: 50 });
    expect(r1.platformPctFee).toBeCloseTo(0.15 * r1.netRevenue, 9);
    expect(r0.netProfit - r1.netProfit).toBeCloseTo(r1.platformPctFee, 9);
    expect(r1.recommendedPrice!).toBeGreaterThan(r0.recommendedPrice!);
  });

  it('charges payment fees on net revenue when asked', () => {
    const m = defaultModel();
    const market = 'Example VAT market (20%, tax inclusive)';
    const p = { ...base, market, priceOverride: 60 };
    const incl = calc(m, p);
    m.settings.paymentFeeBase = 'netRevenue';
    const net = calc(m, p);
    expect(incl.netRevenue).toBeCloseTo(60 * 0.95 / 1.2, 9);
    expect(net.paymentFeeExpected).toBeCloseTo(0.039 * net.netRevenue + 0.3, 9);
    expect(incl.paymentFeeExpected).toBeCloseTo(0.039 * 1.2 * incl.netRevenue + 0.3, 9);
  });

  it('adds sales tax on top when prices exclude tax', () => {
    const m = defaultModel();
    const r = calc(m, { ...base, market: 'Example sales tax market (5%, added at checkout)', priceOverride: 40 });
    expect(r.netRevenue).toBeCloseTo(38, 9);
    expect(r.taxCollected).toBeCloseTo(1.9, 9);
  });

  it('falls back to the expected method when no worst case method is eligible', () => {
    const m = defaultModel();
    m.paymentMethods.forEach((pm) => (pm.includeInWorstCase = false));
    const r = calc(m, base);
    expect(r.worstMethod).toBe(m.settings.expectedPaymentMethod);
    expect(r.paymentFeeWorst).toBeCloseTo(r.paymentFeeExpected, 9);
    expect(r.minimumSafePrice).not.toBeNull();
  });

  it('flags an expected method that is not available in the market', () => {
    const m = defaultModel();
    m.settings.expectedPaymentMethod = 'Bank debit';
    const r = calc(m, { ...base, market: 'Example VAT market (20%, tax inclusive)' });
    expect(r.status).toBe('CHECK_PAYMENT_METHOD');
  });

  it('returns CHECK_INPUTS when percentages reach 100% of revenue', () => {
    const m = defaultModel();
    m.settings.refundPct = 0.9;
    const r = calc(m, base);
    expect(r.status).toBe('CHECK_INPUTS');
    expect(r.recommendedPrice).toBeNull();
  });

  it('raises the published price to the minimum safe price when enabled', () => {
    const m = defaultModel();
    m.pricing.tiers = [{ min: 0, max: 1000, markupPct: 0, markupAmount: 0 }];
    m.pricing.raiseToMinimumSafe = true;
    const r = calc(m, base);
    expect(r.priceSource).toBe('raisedToMinimumSafe');
    expect(r.priceToPublish).toBeGreaterThanOrEqual(r.minimumSafePrice!);
    expect(r.netProfitWorst).toBeGreaterThanOrEqual(-1e-9);
  });

  it('uses each markup basis', () => {
    const m = defaultModel();
    m.pricing.tiers = [{ min: 0, max: 100, markupPct: 0.5, markupAmount: 4 }];
    const price = (basis: Model['pricing']['basis']) => {
      m.pricing.basis = basis;
      return calc(m, base).markupPrice;
    };
    expect(price('pctPlusAmount')).toBe(34);
    expect(price('higherOf')).toBe(30);
    expect(price('pctOnly')).toBe(30);
    expect(price('amountOnly')).toBe(24);
  });

  it('labels competitor position with the band', () => {
    const m = defaultModel();
    const pos = (competitorPrice: number) =>
      calc(m, { ...base, priceOverride: 100, competitorPrice }).competitorPosition;
    expect(pos(80)).toBe('TOO_HIGH');
    expect(pos(100)).toBe('COMPETITIVE');
    expect(pos(120)).toBe('TOO_LOW');
    expect(calc(m, base).competitorPosition).toBe('NO_COMPETITOR_PRICE');
  });
});

describe('portfolio helpers', () => {
  it('summarises products', () => {
    const m = defaultModel();
    const products = [...exampleProducts(), { id: 'n', name: 'Draft', unitCost: null }];
    const s = summarise(m, products);
    expect(s.productsEntered).toBe(3);
    expect(s.byStatus.INCOMPLETE).toBe(1);
    expect(s.totalMonthlyFixed).toBeCloseTo(107, 9);
    expect(s.fixedCostPerOrder).toBeCloseTo(1.07, 9);
    expect(s.ordersToCoverFixed).toBeGreaterThan(0);
  });

  it('runs sensitivity with the price held for cost changes', () => {
    const m = defaultModel();
    const rows = sensitivity(m, base, 'unitCost', [-0.1, 0, 0.1]);
    expect(rows[0].netProfit!).toBeGreaterThan(rows[1].netProfit!);
    expect(rows[1].netProfit!).toBeCloseTo(calc(m, base).netProfit, 9);
    expect(rows[1].netProfit! - rows[2].netProfit!).toBeCloseTo(2 * 1.02, 6); // 10% of 20, plus FX fee
    const price = sensitivity(m, base, 'price', [0.1]);
    expect(price[0].netProfit!).toBeGreaterThan(calc(m, base).netProfit);
  });

  it('checks tiers for gaps and order', () => {
    const m = defaultModel();
    expect(checkTiers(m).every((c) => c === 'OK')).toBe(true);
    m.pricing.tiers[1].min = 6;
    expect(checkTiers(m)[0]).toBe('Gap or overlap with next range');
    m.pricing.tiers[2].max = 1;
    expect(checkTiers(m)[2]).toBe('Maximum is below Minimum');
  });
});
