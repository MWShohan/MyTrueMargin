import type { CompetitorPosition, PriceSource, ProfitLine, StatusCode } from '../engine';

export type Tone = 'good' | 'caution' | 'serious' | 'critical' | 'neutral';

export const STATUS_ORDER: StatusCode[] = [
  'VIABLE',
  'CAUTION',
  'BELOW_TARGET',
  'AT_RISK',
  'WARNING',
  'LOSS',
  'CHECK_PAYMENT_METHOD',
  'CHECK_INPUTS',
  'INCOMPLETE',
];

export const STATUS_INFO: Record<StatusCode, { label: string; tone: Tone; icon: string; explain: string }> = {
  VIABLE: {
    label: 'Viable',
    tone: 'good',
    icon: '✓',
    explain: 'Meets your target margin and minimum profit even if the customer pays with the most expensive payment method.',
  },
  CAUTION: {
    label: 'Caution',
    tone: 'caution',
    icon: '!',
    explain: 'Profitable and on target, but the break even ROAS is above your limit, so advertising has little room for error.',
  },
  BELOW_TARGET: {
    label: 'Below target',
    tone: 'caution',
    icon: '!',
    explain: 'Still profitable, but the margin or profit per order falls short of your target when the customer uses the most expensive payment method.',
  },
  AT_RISK: {
    label: 'At risk',
    tone: 'serious',
    icon: '!',
    explain: 'Profitable before the contingency buffer, but the most expensive payment method leaves less than the buffer.',
  },
  WARNING: {
    label: 'Warning',
    tone: 'serious',
    icon: '!',
    explain: 'Profitable with the expected payment method, but a loss if the customer pays with the most expensive one.',
  },
  LOSS: {
    label: 'Loss',
    tone: 'critical',
    icon: '✕',
    explain: 'The price is below break even with your expected payment method. Every order loses money.',
  },
  CHECK_PAYMENT_METHOD: {
    label: 'Check payment method',
    tone: 'critical',
    icon: '?',
    explain: 'Your expected payment method is not available in this market. Choose another one in Settings or change its availability.',
  },
  CHECK_INPUTS: {
    label: 'Check inputs',
    tone: 'critical',
    icon: '?',
    explain: 'Percentage costs and fees add up to 100% of revenue or more, so no price can cover them. Review your rates.',
  },
  INCOMPLETE: {
    label: 'Incomplete',
    tone: 'neutral',
    icon: '…',
    explain: 'Enter a unit cost and choose a valid market to see results.',
  },
};

export const COMPETITOR_LABEL: Record<CompetitorPosition, string> = {
  NO_COMPETITOR_PRICE: 'No competitor price',
  TOO_HIGH: 'Above competitor band',
  COMPETITIVE: 'Competitive',
  TOO_LOW: 'Below competitor band',
};

export const PRICE_SOURCE_LABEL: Record<PriceSource, string> = {
  override: 'Your price override',
  markup: 'Pricing rule (markup)',
  raisedToMinimumSafe: 'Raised to the minimum safe price',
};

/** Sum of the profit walk lines, used only as a visible check against the engine's net profit. */
export function sumProfitWalk(lines: ProfitLine[]): number {
  return lines.reduce((s, l) => s + l.amount, 0);
}

export function newId(prefix = 'p'): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
