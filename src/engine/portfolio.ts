import { calculateProduct, fixedCostPerOrder, totalMonthlyFixed } from './calc';
import type { Model, Product, ProductResult, StatusCode } from './types';

export interface PortfolioSummary {
  productsEntered: number;
  byStatus: Record<StatusCode, number>;
  markupBelowMinimumSafe: number;
  averagePrice: number | null;
  averageNetProfit: number | null;
  averageNetMargin: number | null;
  totalMonthlyFixed: number;
  fixedCostPerOrder: number;
  ordersToCoverFixed: number | null; // null = not achievable at the average contribution
  competitor: { tooHigh: number; competitive: number; tooLow: number; none: number; averageDiff: number | null; medianDiff: number | null };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function summarise(model: Model, products: Product[]): PortfolioSummary {
  const done = products.map((p) => calculateProduct(model, p)).filter((r): r is ProductResult => r.complete);
  const byStatus = {
    INCOMPLETE: products.length - done.length,
    CHECK_INPUTS: 0,
    CHECK_PAYMENT_METHOD: 0,
    LOSS: 0,
    WARNING: 0,
    AT_RISK: 0,
    BELOW_TARGET: 0,
    CAUTION: 0,
    VIABLE: 0,
  } as Record<StatusCode, number>;
  done.forEach((r) => byStatus[r.status]++);
  const fixed = totalMonthlyFixed(model);
  const avgContribution = avg(done.map((r) => r.contributionPerOrder));
  const diffs = done.map((r) => r.competitorDiffPct).filter((d): d is number => d != null);
  return {
    productsEntered: done.length,
    byStatus,
    markupBelowMinimumSafe: done.filter((r) => r.markupBelowMinimumSafe).length,
    averagePrice: avg(done.map((r) => r.priceToPublish)),
    averageNetProfit: avg(done.map((r) => r.netProfit)),
    averageNetMargin: avg(done.map((r) => r.netMargin)),
    totalMonthlyFixed: fixed,
    fixedCostPerOrder: fixedCostPerOrder(model),
    ordersToCoverFixed: avgContribution != null && avgContribution > 0 ? fixed / avgContribution : null,
    competitor: {
      tooHigh: done.filter((r) => r.competitorPosition === 'TOO_HIGH').length,
      competitive: done.filter((r) => r.competitorPosition === 'COMPETITIVE').length,
      tooLow: done.filter((r) => r.competitorPosition === 'TOO_LOW').length,
      none: done.filter((r) => r.competitorPosition === 'NO_COMPETITOR_PRICE').length,
      averageDiff: avg(diffs),
      medianDiff: median(diffs),
    },
  };
}

export type SensitivityVariable = 'price' | 'unitCost' | 'adCost' | 'refundPct';

/** Net margin at the price to publish when one input moves by each relative step (0.1 = +10%). */
export function sensitivity(
  model: Model,
  product: Product,
  variable: SensitivityVariable,
  steps: number[],
): { step: number; netProfit: number | null; netMargin: number | null }[] {
  const base = calculateProduct(model, product);
  return steps.map((step) => {
    let m = model;
    let p = product;
    if (variable === 'price' && base.complete) p = { ...product, priceOverride: base.priceToPublish * (1 + step) };
    if (variable === 'unitCost') p = { ...product, unitCost: (product.unitCost ?? 0) * (1 + step) };
    if (variable === 'adCost') {
      const ad = product.adCostPerOrder ?? 0;
      // With no ad cost entered, steps are read as ad cost = step x price to publish.
      const v = ad > 0 ? ad * (1 + step) : base.complete ? Math.max(0, step) * base.priceToPublish : 0;
      p = { ...product, adCostPerOrder: v };
    }
    if (variable === 'refundPct') m = { ...model, settings: { ...model.settings, refundPct: model.settings.refundPct * (1 + step) } };
    // Keep the published price fixed when cost, ads or refunds move.
    if (variable !== 'price' && base.complete && !(num(product.priceOverride) > 0)) p = { ...p, priceOverride: base.priceToPublish };
    const r = calculateProduct(m, p);
    return { step, netProfit: r.complete ? r.netProfit : null, netMargin: r.complete ? r.netMargin : null };
  });
}

const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export type TierCheck = 'OK' | 'Fill all four columns' | 'Maximum is below Minimum' | 'Gap or overlap with next range';

export function checkTiers(model: Model): TierCheck[] {
  const tiers = model.pricing.tiers;
  return tiers.map((t, i) => {
    if (![t.min, t.max, t.markupPct, t.markupAmount].every((v) => typeof v === 'number' && Number.isFinite(v)))
      return 'Fill all four columns';
    if (t.max < t.min) return 'Maximum is below Minimum';
    const next = tiers[i + 1];
    if (next) {
      const gap = Math.round((next.min - t.max) * 100) / 100;
      if (gap !== 0 && gap !== 0.01) return 'Gap or overlap with next range';
    }
    return 'OK';
  });
}
