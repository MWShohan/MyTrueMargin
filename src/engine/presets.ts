import type { Model, Product } from './types';

// Starting values only. Every rate below is an example to verify against your own
// provider, platform and tax adviser before relying on a result.

export const EXAMPLE_NOTICE =
  'Example values to verify. Fee and tax rates change and differ by provider, country and account.';

export function defaultModel(): Model {
  return {
    settings: {
      currency: 'USD',
      defaultMarket: 'Domestic example',
      expectedPaymentMethod: 'Standard card',
      fxRate: 1,
      fxFeePct: 0.02,
      sellerPaysDuty: false,
      chargebackPct: 0.015,
      platformFeePct: 0,
      platformFeePerOrder: 0.4,
      discountPct: 0.05,
      otherCostPerOrder: 0,
      refundPct: 0.05,
      returnHandlingCost: 10,
      targetMarginPct: 0.2,
      bufferPct: 0.03,
      minProfitPerOrder: 3,
      maxBreakEvenRoas: 3,
      monthlyOrders: 100,
      paymentFeeBase: 'taxInclusive',
    },
    pricing: {
      tiers: [
        { min: 0, max: 5, markupPct: 1.3, markupAmount: 4 },
        { min: 5.01, max: 10, markupPct: 0.94, markupAmount: 3 },
        { min: 10.01, max: 20, markupPct: 0.62, markupAmount: 5 },
        { min: 20.01, max: 40, markupPct: 0.63, markupAmount: 5 },
        { min: 40.01, max: 75, markupPct: 0.64, markupAmount: 5 },
        { min: 75.01, max: 125, markupPct: 0.62, markupAmount: 5 },
        { min: 125.01, max: 200, markupPct: 0.6, markupAmount: 5 },
        { min: 200.01, max: 300, markupPct: 0.58, markupAmount: 5 },
      ],
      basis: 'pctPlusAmount',
      feeGrossUpPct: 0,
      feeGrossUpFixed: 0,
      includeShippingInCost: true,
      minMarkupProfit: 10,
      rounding: 'cent',
      raiseToMinimumSafe: false,
      competitorBandPct: 0.1,
    },
    fixedCosts: [
      { id: 'fc1', name: 'Store or platform subscription', category: 'Platform', monthly: 39, perOrder: 0 },
      { id: 'fc2', name: 'Sourcing or fulfilment software', category: 'Sourcing', monthly: 40, perOrder: 0 },
      { id: 'fc3', name: 'Apps and tools', category: 'Apps', monthly: 25, perOrder: 0 },
      { id: 'fc4', name: 'Domain and business email', category: 'Other fixed', monthly: 3, perOrder: 0 },
    ],
    markets: [
      { name: 'Domestic example', taxRate: 0, pricesIncludeTax: false, dutyRate: 0, otherTaxPct: 0, region: 'domestic', customerFxFeePct: 0, shippingCharged: 0 },
      { name: 'Example VAT market (20%, tax inclusive)', taxRate: 0.2, pricesIncludeTax: true, dutyRate: 0, otherTaxPct: 0, region: 'international', customerFxFeePct: 0.015, shippingCharged: 0 },
      { name: 'Example GST market (10%, tax inclusive)', taxRate: 0.1, pricesIncludeTax: true, dutyRate: 0, otherTaxPct: 0, region: 'international', customerFxFeePct: 0.015, shippingCharged: 0 },
      { name: 'Example sales tax market (5%, added at checkout)', taxRate: 0.05, pricesIncludeTax: false, dutyRate: 0, otherTaxPct: 0, region: 'international', customerFxFeePct: 0.015, shippingCharged: 0 },
    ],
    paymentMethods: [
      { name: 'Standard card', includeInWorstCase: true, availability: 'all', domesticPct: 0.029, domesticFixed: 0.3, internationalPct: 0.039, internationalFixed: 0.3, extraPct: 0 },
      { name: 'Premium or business card', includeInWorstCase: true, availability: 'all', domesticPct: 0.035, domesticFixed: 0.3, internationalPct: 0.045, internationalFixed: 0.3, extraPct: 0 },
      { name: 'Digital wallet', includeInWorstCase: true, availability: 'all', domesticPct: 0.0349, domesticFixed: 0.49, internationalPct: 0.0499, internationalFixed: 0.49, extraPct: 0 },
      { name: 'Bank debit', includeInWorstCase: true, availability: 'domestic', domesticPct: 0.01, domesticFixed: 0, internationalPct: 0.01, internationalFixed: 0, extraPct: 0 },
    ],
  };
}

export function exampleProducts(): Product[] {
  return [
    { id: 'p1', name: 'Example product A', unitCost: 20, supplierShipping: 0, competitorPrice: 39.99 },
    { id: 'p2', name: 'Example product B', unitCost: 8.5, supplierShipping: 2.5, adCostPerOrder: 6 },
    { id: 'p3', name: 'Example product C', market: 'Example VAT market (20%, tax inclusive)', unitCost: 45, supplierShipping: 5 },
  ];
}
