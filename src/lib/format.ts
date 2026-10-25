// Display formatting only. No business calculation lives here.

const LOCALE = 'en-GB';
const MINUS = '−';

const moneyCache = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string): Intl.NumberFormat | null {
  const code = (currency || '').trim().toUpperCase();
  if (moneyCache.has(code)) return moneyCache.get(code)!;
  try {
    const f = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' });
    moneyCache.set(code, f);
    return f;
  } catch {
    return null;
  }
}

const plainNumber = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFormat = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 2 });
const signedPctFormat = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' });

const useMinus = (s: string) => s.replace(/-/g, MINUS);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Currency with thousands separators, e.g. $1,234.50. */
export function fmtMoney(value: number | null | undefined, currency: string, nullText = 'Not viable'): string {
  if (!isNum(value)) return nullText;
  const f = moneyFormatter(currency);
  // Avoid showing "-$0.00" for tiny negative rounding noise.
  const v = Math.abs(value) < 0.005 ? 0 : value;
  if (!f) return useMinus(`${plainNumber.format(v)} ${(currency || '').toUpperCase()}`.trim());
  return useMinus(f.format(v));
}

/** Percent from a decimal, without trailing zeros: 0.15 is 15%, 0.155 is 15.5%. */
export function fmtPct(value: number | null | undefined, nullText = 'n/a'): string {
  if (!isNum(value)) return nullText;
  const v = Math.abs(value) < 0.00005 ? 0 : value;
  return useMinus(pctFormat.format(v));
}

/** Percent with an explicit sign, e.g. +5% or −12.5%. */
export function fmtSignedPct(value: number | null | undefined, nullText = 'n/a'): string {
  if (!isNum(value)) return nullText;
  const v = Math.abs(value) < 0.00005 ? 0 : value;
  return useMinus(signedPctFormat.format(v));
}

/** Plain number with thousands separators and up to `digits` decimals. */
export function fmtNum(value: number | null | undefined, digits = 2, nullText = 'n/a'): string {
  if (!isNum(value)) return nullText;
  return useMinus(new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(value));
}

/** A ratio such as ROAS, shown as 2.5x. */
export function fmtRatio(value: number | null | undefined, nullText = 'Not viable'): string {
  if (!isNum(value)) return nullText;
  return `${fmtNum(value, 2)}x`;
}

/** Currency symbol for input adornments, falling back to the code. */
export function currencySymbol(currency: string): string {
  const f = moneyFormatter(currency);
  if (!f) return (currency || '').toUpperCase();
  const part = f.formatToParts(0).find((p) => p.type === 'currency');
  return part?.value ?? currency.toUpperCase();
}
