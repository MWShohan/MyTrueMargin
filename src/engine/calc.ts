import type {
  CompetitorPosition,
  Market,
  Model,
  PaymentMethod,
  PriceSource,
  PriceTier,
  Product,
  ProfitLine,
  Result,
  Rounding,
  StatusCode,
} from './types';

const EPS = 1e-9;
const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round = (x: number, dp: number): number => {
  const f = 10 ** dp;
  return Math.round((x + Math.sign(x) * EPS) * f) / f;
};
const roundUpCent = (x: number): number => Math.ceil(round(x, 6) * 100 - EPS) / 100;

/** Applies a price ending. 'cent' rounds to the nearest cent, or up when `up` is set. */
export function applyRounding(x: number, rule: Rounding, up: boolean): number {
  switch (rule) {
    case '99':
      return round(Math.ceil(round(x, 4) + 0.01) - 0.01, 2);
    case '95':
      return round(Math.ceil(round(x, 4) + 0.05) - 0.05, 2);
    case 'whole':
      return Math.ceil(round(x, 4) - EPS);
    default:
      return up ? roundUpCent(x) : round(x, 2);
  }
}

export function totalMonthlyFixed(model: Model): number {
  return model.fixedCosts.reduce((s, c) => s + num(c.monthly), 0);
}

export function fixedCostPerOrder(model: Model): number {
  const orders = num(model.settings.monthlyOrders);
  return orders > 0 ? totalMonthlyFixed(model) / orders : 0;
}

export function variableCostPerOrderFromList(model: Model): number {
  return model.fixedCosts.reduce((s, c) => s + num(c.perOrder), 0);
}

export function findTierIndex(tiers: PriceTier[], cost: number): number {
  const count = tiers.filter((t) => Number.isFinite(t.min) && t.min <= cost + EPS).length;
  return Math.max(1, count) - 1;
}

export function markupAmount(model: Model, cost: number, tier: PriceTier | undefined): number {
  if (!tier) return 0;
  const pct = cost * num(tier.markupPct);
  const amt = num(tier.markupAmount);
  switch (model.pricing.basis) {
    case 'higherOf':
      return Math.max(pct, amt);
    case 'pctOnly':
      return pct;
    case 'amountOnly':
      return amt;
    default:
      return pct + amt;
  }
}

function methodAvailable(m: PaymentMethod, domestic: boolean): boolean {
  return m.availability === 'all' || (m.availability === 'domestic' ? domestic : !domestic);
}
function methodPct(m: PaymentMethod, domestic: boolean): number {
  return (domestic ? num(m.domesticPct) : num(m.internationalPct)) + num(m.extraPct);
}
function methodFixed(m: PaymentMethod, domestic: boolean): number {
  return domestic ? num(m.domesticFixed) : num(m.internationalFixed);
}

const STATUS_TEXT: Record<Exclude<StatusCode, 'INCOMPLETE'>, string> = {
  CHECK_INPUTS: 'CHECK INPUTS: costs and fees exceed 100% of revenue',
  CHECK_PAYMENT_METHOD: 'CHECK PAYMENT METHOD: expected method not available in this market',
  LOSS: 'LOSS: price is below break even with {expected}',
  WARNING: 'WARNING: loss if customer pays by {worst}',
  AT_RISK: 'AT RISK: {worst} leaves less than the risk buffer',
  BELOW_TARGET: 'BELOW TARGET: target missed if customer pays by {worst}',
  CAUTION: 'CAUTION: break even ROAS above limit',
  VIABLE: 'VIABLE: safe under every payment method',
};

export function calculateProduct(model: Model, product: Product): Result {
  const s = model.settings;
  const p = model.pricing;
  const marketName = product.market?.trim() ? product.market.trim() : s.defaultMarket;
  const market: Market | undefined = model.markets.find((m) => m.name === marketName);
  const unitCost = product.unitCost;
  if (!product.name?.trim() && unitCost == null) {
    return { complete: false, status: 'INCOMPLETE', statusText: '' };
  }
  if (!market || typeof unitCost !== 'number' || !Number.isFinite(unitCost) || unitCost < 0) {
    return { complete: false, status: 'INCOMPLETE', statusText: 'Complete the product cost (and a valid market)' };
  }

  const domestic = market.region === 'domestic';
  const t = num(market.taxRate);
  const taxFactor = market.pricesIncludeTax ? 1 + t : 1;
  const ship = num(market.shippingCharged);
  const feeFactor = s.paymentFeeBase === 'netRevenue' ? 1 : 1 + t;
  const disc = num(s.discountPct);

  // Payment methods
  const expected = model.paymentMethods.find((m) => m.name === s.expectedPaymentMethod);
  const expectedAvailable = !!expected && methodAvailable(expected, domestic);
  const expPct = expected ? methodPct(expected, domestic) : 0;
  const expFix = expected ? methodFixed(expected, domestic) : 0;
  let worstSet = model.paymentMethods.filter((m) => m.includeInWorstCase && methodAvailable(m, domestic));
  if (worstSet.length === 0 && expected) worstSet = [expected];

  // Costs
  const sourcingCost = (unitCost + num(product.supplierShipping)) * num(s.fxRate);
  const markupCostBase = p.includeShippingInCost ? sourcingCost : unitCost * num(s.fxRate);
  const fxFee = sourcingCost * num(s.fxFeePct);
  const importDuty = s.sellerPaysDuty ? sourcingCost * num(market.dutyRate) : 0;
  const landedCost = sourcingCost + fxFee + importDuty;
  const platformFixedFees = num(s.platformFeePerOrder) + variableCostPerOrderFromList(model);
  const otherCostPerOrder = num(s.otherCostPerOrder);
  const expectedReturnHandling = num(s.refundPct) * num(s.returnHandlingCost);
  const adCost = Math.max(0, num(product.adCostPerOrder));
  const allocatedFixedCost = fixedCostPerOrder(model);
  const fixedPerOrder =
    landedCost + platformFixedFees + otherCostPerOrder + expectedReturnHandling + adCost + allocatedFixedCost;
  const conv = num(market.customerFxFeePct);
  const pctOfRevenue =
    conv * feeFactor + num(s.refundPct) + num(s.chargebackPct) + num(market.otherTaxPct) + num(s.platformFeePct);

  // Solve the selling price that leaves `extraPct` of net revenue plus `extraAmount` as profit.
  const solve = (methods: PaymentMethod[], extraPct: number, extraAmount: number): number | null => {
    if (disc >= 1 || methods.length === 0) return null;
    let best = -Infinity;
    for (const m of methods) {
      const den = 1 - pctOfRevenue - methodPct(m, domestic) * feeFactor - extraPct;
      if (den <= 0) return null;
      best = Math.max(best, (fixedPerOrder + methodFixed(m, domestic) + extraAmount) / den);
    }
    return Math.max(0, (best * taxFactor - ship) / (1 - disc));
  };

  const buffer = num(s.bufferPct);
  const target = num(s.targetMarginPct);
  const minProfit = num(s.minProfitPerOrder);
  const breakEvenRaw = expected ? solve([expected], 0, 0) : null;
  const safeRaw = solve(worstSet, buffer, 0);
  const recA = solve(worstSet, buffer + target, 0);
  const recB = solve(worstSet, buffer, minProfit);
  const recRaw = recA == null || recB == null ? null : Math.max(recA, recB);

  // Markup rule
  const tierIndex = findTierIndex(p.tiers, markupCostBase);
  const markup = markupAmount(model, markupCostBase, p.tiers[tierIndex]);
  const grossUp = 1 - num(p.feeGrossUpPct);
  const markupPrice = applyRounding(
    grossUp > 0 ? (markupCostBase + markup) / grossUp + num(p.feeGrossUpFixed) : markupCostBase + markup,
    p.rounding,
    false,
  );
  const markupProfit = markupPrice * grossUp - num(p.feeGrossUpFixed) - markupCostBase;

  const minimumSafePrice = safeRaw == null ? null : safeRaw;
  const breakEvenPrice = breakEvenRaw;
  const recommendedPrice = recRaw == null ? null : applyRounding(recRaw, p.rounding, true);
  const markupBelowMinimumSafe = minimumSafePrice != null && markupPrice < minimumSafePrice - 0.005;
  let priceSource: PriceSource = 'markup';
  let priceToPublish = markupPrice;
  if (num(product.priceOverride) > 0) {
    priceToPublish = num(product.priceOverride);
    priceSource = 'override';
  } else if (p.raiseToMinimumSafe && minimumSafePrice != null && minimumSafePrice > markupPrice) {
    priceToPublish = applyRounding(minimumSafePrice, p.rounding, true);
    priceSource = 'raisedToMinimumSafe';
  }

  // Results at the price to publish
  const priceAfterDiscount = priceToPublish * (1 - disc);
  const netRevenue = (priceAfterDiscount + ship) / taxFactor;
  const taxCollected = netRevenue * t;
  const paymentFeeExpected = expPct * feeFactor * netRevenue + expFix;
  let paymentFeeWorst = paymentFeeExpected;
  let worstMethod = expected?.name ?? '';
  if (worstSet.length) {
    paymentFeeWorst = -Infinity;
    for (const m of worstSet) {
      const fee = methodPct(m, domestic) * feeFactor * netRevenue + methodFixed(m, domestic);
      // On a tie the last method in table order is named, as in the reference workbook.
      if (fee >= paymentFeeWorst - EPS) {
        paymentFeeWorst = Math.max(paymentFeeWorst, fee);
        worstMethod = m.name;
      }
    }
  }
  const customerFxFee = conv * feeFactor * netRevenue;
  const refundsAndChargebacks = (num(s.refundPct) + num(s.chargebackPct)) * netRevenue;
  const platformPctFee = num(s.platformFeePct) * netRevenue;
  const otherTaxes = num(market.otherTaxPct) * netRevenue;
  const sharedCosts = fixedPerOrder + customerFxFee + refundsAndChargebacks + platformPctFee + otherTaxes;
  const netProfitBeforeBuffer = netRevenue - sharedCosts - paymentFeeExpected;
  const worstBeforeBuffer = netRevenue - sharedCosts - paymentFeeWorst;
  const bufferAmt = buffer * netRevenue;
  const netProfit = netProfitBeforeBuffer - bufferAmt;
  const netProfitWorst = worstBeforeBuffer - bufferAmt;
  const ratio = (a: number) => (netRevenue > 0 ? a / netRevenue : 0);
  const grossProfit = netRevenue - landedCost;
  const profitBeforeAds = netProfitBeforeBuffer + adCost;
  const breakEvenRoas = profitBeforeAds > 0 ? netRevenue / profitBeforeAds : null;
  const headroom = profitBeforeAds - (target + buffer) * netRevenue;
  const roasForTarget = headroom > 0 ? netRevenue / headroom : null;
  const expectedRoas = adCost > 0 ? netRevenue / adCost : null;

  const comp = num(product.competitorPrice);
  const competitorDiffPct = comp > 0 ? priceToPublish / comp - 1 : null;
  const band = num(p.competitorBandPct);
  const competitorPosition: CompetitorPosition =
    competitorDiffPct == null
      ? 'NO_COMPETITOR_PRICE'
      : competitorDiffPct > band
        ? 'TOO_HIGH'
        : competitorDiffPct < -band
          ? 'TOO_LOW'
          : 'COMPETITIVE';

  let status: Exclude<StatusCode, 'INCOMPLETE'>;
  if (breakEvenPrice == null || minimumSafePrice == null || recommendedPrice == null) status = 'CHECK_INPUTS';
  else if (!expectedAvailable) status = 'CHECK_PAYMENT_METHOD';
  else if (netProfitBeforeBuffer < -0.005) status = 'LOSS';
  else if (worstBeforeBuffer < -0.005) status = 'WARNING';
  else if (netProfitWorst < -0.005) status = 'AT_RISK';
  else if (ratio(netProfitWorst) < target - 0.0005 || netProfitWorst < minProfit - 0.005) status = 'BELOW_TARGET';
  else if (breakEvenRoas != null && breakEvenRoas > num(s.maxBreakEvenRoas)) status = 'CAUTION';
  else status = 'VIABLE';
  let statusText = STATUS_TEXT[status]
    .replace('{expected}', s.expectedPaymentMethod)
    .replace('{worst}', worstMethod);
  if (adCost === 0) statusText += ' (no ad cost entered)';

  const profitWalk: ProfitLine[] = [
    { key: 'revenue', label: 'Net revenue (excl. tax)', amount: netRevenue },
    { key: 'sourcing', label: 'Product and supplier shipping', amount: -sourcingCost },
    { key: 'fxFee', label: 'Sourcing currency fee', amount: -fxFee },
    { key: 'duty', label: 'Import duty', amount: -importDuty },
    { key: 'platformFixed', label: 'Platform and app fees per order', amount: -platformFixedFees },
    { key: 'platformPct', label: 'Platform commission', amount: -platformPctFee },
    { key: 'other', label: 'Other cost per order', amount: -otherCostPerOrder },
    { key: 'payment', label: 'Payment processing fee', amount: -paymentFeeExpected },
    { key: 'customerFx', label: 'Customer currency conversion fee', amount: -customerFxFee },
    {
      key: 'refunds',
      label: 'Refunds, returns and chargebacks',
      amount: -(refundsAndChargebacks + expectedReturnHandling),
    },
    { key: 'otherTax', label: 'Other taxes', amount: -otherTaxes },
    { key: 'ads', label: 'Advertising', amount: -adCost },
    { key: 'fixed', label: 'Allocated fixed cost', amount: -allocatedFixedCost },
    { key: 'buffer', label: 'Contingency buffer', amount: -bufferAmt },
  ];

  return {
    complete: true,
    marketName,
    domestic,
    taxRate: t,
    sourcingCost,
    markupCostBase,
    fxFee,
    importDuty,
    landedCost,
    platformFixedFees,
    otherCostPerOrder,
    expectedReturnHandling,
    adCost,
    allocatedFixedCost,
    tierIndex,
    markupPrice,
    markupProfit,
    markupBelowMinProfit: markupProfit < num(p.minMarkupProfit) - 0.005,
    minimumSafePrice,
    breakEvenPrice,
    recommendedPrice,
    priceToPublish,
    priceSource,
    markupBelowMinimumSafe,
    priceAfterDiscount,
    netRevenue,
    taxCollected,
    paymentFeeExpected,
    paymentFeeWorst,
    worstMethod,
    expectedMethodAvailable: expectedAvailable,
    customerFxFee,
    refundsAndChargebacks,
    platformPctFee,
    otherTaxes,
    buffer: bufferAmt,
    netProfitBeforeBuffer,
    netProfit,
    netMargin: ratio(netProfit),
    netProfitWorst,
    netMarginWorst: ratio(netProfitWorst),
    netMarginBeforeAds: ratio(netProfit + adCost),
    grossProfit,
    grossMargin: ratio(grossProfit),
    contributionPerOrder: netProfitBeforeBuffer + allocatedFixedCost,
    profitBeforeAds,
    breakEvenRoas,
    roasForTarget,
    expectedRoas,
    maxAdCostAtTarget: Math.max(0, headroom),
    competitorDiffPct,
    competitorPosition,
    status,
    statusText,
    profitWalk,
  };
}
