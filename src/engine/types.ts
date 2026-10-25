// Inputs and outputs of the margin engine. All money values are in the store currency
// unless a field says otherwise. All percentages are decimals (0.2 = 20%).

export type Region = 'domestic' | 'international';
export type Availability = 'all' | 'domestic' | 'international';
export type MarkupBasis = 'pctPlusAmount' | 'higherOf' | 'pctOnly' | 'amountOnly';
export type Rounding = 'cent' | '99' | '95' | 'whole';
export type FeeBase = 'taxInclusive' | 'netRevenue';

export interface Settings {
  currency: string; // ISO code used for display only
  defaultMarket: string;
  expectedPaymentMethod: string;
  fxRate: number; // 1 supplier currency = fxRate store currency
  fxFeePct: number; // conversion fee on sourcing costs
  sellerPaysDuty: boolean;
  chargebackPct: number; // of net revenue
  platformFeePct: number; // marketplace or platform commission, of net revenue
  platformFeePerOrder: number; // fixed platform or fulfilment app fee per order
  discountPct: number; // average discount on the selling price
  otherCostPerOrder: number; // packaging, inserts, gifts
  refundPct: number; // share of orders refunded, revenue lost
  returnHandlingCost: number; // cost per refunded order
  targetMarginPct: number; // net margin after advertising and every other cost
  bufferPct: number; // contingency buffer, of net revenue
  minProfitPerOrder: number;
  maxBreakEvenRoas: number;
  monthlyOrders: number;
  paymentFeeBase: FeeBase; // amount payment and customer FX fees are charged on
}

export interface PriceTier {
  min: number;
  max: number;
  markupPct: number;
  markupAmount: number;
}

export interface PricingRule {
  tiers: PriceTier[]; // ascending by min
  basis: MarkupBasis;
  feeGrossUpPct: number; // price is divided by (1 - feeGrossUpPct)
  feeGrossUpFixed: number; // then this amount is added
  includeShippingInCost: boolean; // markup applies to cost + supplier shipping
  minMarkupProfit: number; // warning threshold for markup profit
  rounding: Rounding;
  raiseToMinimumSafe: boolean;
  competitorBandPct: number;
}

export interface FixedCost {
  id: string;
  name: string;
  category: string;
  monthly: number;
  perOrder: number; // variable part charged per order, if any
}

export interface Market {
  name: string;
  taxRate: number;
  pricesIncludeTax: boolean;
  dutyRate: number; // on supplier cost
  otherTaxPct: number; // of net revenue
  region: Region; // card region for payment fees
  customerFxFeePct: number;
  shippingCharged: number; // shipping charged to the customer
}

export interface PaymentMethod {
  name: string;
  includeInWorstCase: boolean;
  availability: Availability;
  domesticPct: number;
  domesticFixed: number;
  internationalPct: number;
  internationalFixed: number;
  extraPct: number; // extra platform transaction fee
}

export interface Model {
  settings: Settings;
  pricing: PricingRule;
  fixedCosts: FixedCost[];
  markets: Market[];
  paymentMethods: PaymentMethod[];
}

export interface Product {
  id: string;
  name: string;
  market?: string; // blank uses the default market
  unitCost: number | null; // supplier currency
  supplierShipping?: number | null; // supplier currency
  adCostPerOrder?: number | null;
  priceOverride?: number | null;
  competitorPrice?: number | null;
  competitorUrl?: string;
  notes?: string;
}

export type StatusCode =
  | 'INCOMPLETE'
  | 'CHECK_INPUTS'
  | 'CHECK_PAYMENT_METHOD'
  | 'LOSS'
  | 'WARNING'
  | 'AT_RISK'
  | 'BELOW_TARGET'
  | 'CAUTION'
  | 'VIABLE';

export type CompetitorPosition = 'NO_COMPETITOR_PRICE' | 'TOO_HIGH' | 'COMPETITIVE' | 'TOO_LOW';
export type PriceSource = 'override' | 'markup' | 'raisedToMinimumSafe';

export interface ProfitLine {
  key: string;
  label: string;
  amount: number; // signed: revenue positive, costs negative
}

export interface ProductResult {
  complete: true;
  marketName: string;
  domestic: boolean;
  taxRate: number;
  // cost build up
  sourcingCost: number; // (unit cost + supplier shipping) x FX
  markupCostBase: number;
  fxFee: number;
  importDuty: number;
  landedCost: number;
  platformFixedFees: number;
  otherCostPerOrder: number;
  expectedReturnHandling: number;
  adCost: number;
  allocatedFixedCost: number;
  // prices (null = cannot be solved with these inputs)
  tierIndex: number; // 0 based
  markupPrice: number;
  markupProfit: number;
  markupBelowMinProfit: boolean;
  minimumSafePrice: number | null;
  breakEvenPrice: number | null;
  recommendedPrice: number | null;
  priceToPublish: number;
  priceSource: PriceSource;
  markupBelowMinimumSafe: boolean;
  // results at the price to publish
  priceAfterDiscount: number;
  netRevenue: number;
  taxCollected: number;
  paymentFeeExpected: number;
  paymentFeeWorst: number;
  worstMethod: string;
  expectedMethodAvailable: boolean;
  customerFxFee: number;
  refundsAndChargebacks: number;
  platformPctFee: number;
  otherTaxes: number;
  buffer: number;
  netProfitBeforeBuffer: number;
  netProfit: number;
  netMargin: number;
  netProfitWorst: number;
  netMarginWorst: number;
  netMarginBeforeAds: number;
  grossProfit: number;
  grossMargin: number;
  contributionPerOrder: number; // profit before allocated fixed cost and buffer
  profitBeforeAds: number;
  breakEvenRoas: number | null;
  roasForTarget: number | null;
  expectedRoas: number | null;
  maxAdCostAtTarget: number;
  competitorDiffPct: number | null;
  competitorPosition: CompetitorPosition;
  status: StatusCode;
  statusText: string;
  profitWalk: ProfitLine[];
}

export interface IncompleteResult {
  complete: false;
  status: 'INCOMPLETE';
  statusText: string;
}

export type Result = ProductResult | IncompleteResult;
