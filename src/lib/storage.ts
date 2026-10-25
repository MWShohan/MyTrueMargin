import { defaultModel, exampleProducts } from '../engine';
import type { Model, Product } from '../engine';

export const STORAGE_KEY = 'mytruemargin:v1';

export interface AppData {
  model: Model;
  products: Product[];
  quick: Product;
}

export function defaultQuick(): Product {
  return { id: 'quick', name: 'New product', unitCost: 20, supplierShipping: 0, adCostPerOrder: null, priceOverride: null, competitorPrice: null };
}

export function defaultData(): AppData {
  return { model: defaultModel(), products: exampleProducts(), quick: defaultQuick() };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Merges a stored or imported model over the defaults so missing fields never break the engine. */
export function normaliseModel(raw: unknown): Model {
  const d = defaultModel();
  if (!isObj(raw)) return d;
  return {
    settings: { ...d.settings, ...(isObj(raw.settings) ? (raw.settings as Partial<Model['settings']>) : {}) },
    pricing: {
      ...d.pricing,
      ...(isObj(raw.pricing) ? (raw.pricing as Partial<Model['pricing']>) : {}),
      tiers: isObj(raw.pricing) && Array.isArray(raw.pricing.tiers) ? (raw.pricing.tiers as Model['pricing']['tiers']) : d.pricing.tiers,
    },
    fixedCosts: Array.isArray(raw.fixedCosts) ? (raw.fixedCosts as Model['fixedCosts']) : d.fixedCosts,
    markets: Array.isArray(raw.markets) ? (raw.markets as Model['markets']) : d.markets,
    paymentMethods: Array.isArray(raw.paymentMethods) ? (raw.paymentMethods as Model['paymentMethods']) : d.paymentMethods,
  };
}

function normaliseProducts(raw: unknown): Product[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter(isObj).map((p, i) => ({
    ...(p as unknown as Product),
    id: typeof p.id === 'string' && p.id ? p.id : `imported${i + 1}`,
    name: typeof p.name === 'string' ? p.name : '',
    unitCost: typeof p.unitCost === 'number' ? p.unitCost : null,
  }));
}

/** Parses an exported JSON file. Throws with a readable message when it is not usable. */
export function parseAppData(text: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isObj(raw) || !isObj(raw.model)) throw new Error('That file does not contain a MyTrueMargin model.');
  const products = normaliseProducts(raw.products) ?? [];
  const quick = isObj(raw.quick) ? (normaliseProducts([raw.quick])?.[0] ?? defaultQuick()) : defaultQuick();
  return { model: normaliseModel(raw.model), products, quick };
}

export function loadData(): AppData {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (!text) return defaultData();
    return parseAppData(text);
  } catch {
    return defaultData();
  }
}

export function saveData(data: AppData): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function serialiseAppData(data: AppData): string {
  return JSON.stringify({ app: 'MyTrueMargin', version: 1, ...data }, null, 2);
}

/** Offers a text file to the browser for download. */
export function downloadText(filename: string, text: string, type: string): void {
  try {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* download not supported in this environment */
  }
}
