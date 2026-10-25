// Pure CSV helpers for the product list. Computed columns come from the engine.
import { calculateProduct } from '../engine';
import type { Model, Product } from '../engine';

type NumKey = 'unitCost' | 'supplierShipping' | 'adCostPerOrder' | 'priceOverride' | 'competitorPrice';
type TextKey = 'name' | 'market' | 'competitorUrl' | 'notes';

export interface InputColumn {
  key: NumKey | TextKey;
  header: string;
  kind: 'number' | 'text';
}

export const INPUT_COLUMNS: InputColumn[] = [
  { key: 'name', header: 'Name', kind: 'text' },
  { key: 'market', header: 'Market', kind: 'text' },
  { key: 'unitCost', header: 'Unit cost', kind: 'number' },
  { key: 'supplierShipping', header: 'Supplier shipping', kind: 'number' },
  { key: 'adCostPerOrder', header: 'Ad cost per order', kind: 'number' },
  { key: 'priceOverride', header: 'Price override', kind: 'number' },
  { key: 'competitorPrice', header: 'Competitor price', kind: 'number' },
  { key: 'competitorUrl', header: 'Competitor URL', kind: 'text' },
  { key: 'notes', header: 'Notes', kind: 'text' },
];

export const COMPUTED_HEADERS = [
  'Price to publish',
  'Net profit',
  'Net margin',
  'Worst case net profit',
  'Status',
  'Competitor position',
] as const;

/** Escapes one field. Text that a spreadsheet would treat as a formula gets a leading apostrophe. */
function escapeField(value: string, guardFormula: boolean): string {
  let v = value;
  if (guardFormula && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]|^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Serialises rows. Every cell is a string; numbers should be converted by the caller. */
export function toCsv(rows: (string | number | null | undefined)[][], textColumns?: Set<number>): string {
  return rows
    .map((row) =>
      row
        .map((cell, i) => {
          if (cell == null) return '';
          if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : '';
          return escapeField(cell, textColumns ? textColumns.has(i) : true);
        })
        .join(','),
    )
    .join('\r\n');
}

/** Parses CSV text (RFC 4180 quotes, CRLF or LF, optional BOM). Blank lines are skipped. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const pushRow = () => {
    row.push(field);
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
    field = '';
  };
  while (i < src.length) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field === '') {
      quoted = true;
      i++;
    } else if (c === ',') {
      row.push(field);
      field = '';
      i++;
    } else if (c === '\r') {
      pushRow();
      i += src[i + 1] === '\n' ? 2 : 1;
    } else if (c === '\n') {
      pushRow();
      i++;
    } else {
      field += c;
      i++;
    }
  }
  if (field !== '' || row.length) pushRow();
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Product list as CSV. With a model, computed columns from the engine are appended. */
export function productsToCsv(products: Product[], model?: Model): string {
  const header: string[] = INPUT_COLUMNS.map((c) => c.header);
  if (model) header.push(...COMPUTED_HEADERS);
  const textCols = new Set<number>(INPUT_COLUMNS.map((c, i) => (c.kind === 'text' ? i : -1)).filter((i) => i >= 0));
  const rows: (string | number | null | undefined)[][] = products.map((p) => {
    const cells: (string | number | null | undefined)[] = INPUT_COLUMNS.map((c) => {
      const v = p[c.key];
      return c.kind === 'number' ? (typeof v === 'number' ? v : null) : ((v as string | undefined) ?? '');
    });
    if (model) {
      const r = calculateProduct(model, p);
      if (r.complete) {
        cells.push(r.priceToPublish, r.netProfit, r.netMargin, r.netProfitWorst, r.status, r.competitorPosition);
      } else {
        cells.push(null, null, null, null, r.status, null);
      }
    }
    return cells;
  });
  return toCsv([header, ...rows], textCols);
}

export interface CsvImport {
  products: Product[];
  errors: string[];
}

function parseNumber(raw: string): number | null | 'invalid' {
  const t = raw.trim().replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : 'invalid';
}

/** Reads input columns by header (label or field key, any case). Computed columns are ignored. */
export function productsFromCsv(text: string, makeId: (index: number) => string = (i) => `csv${i + 1}`): CsvImport {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length === 0) return { products: [], errors: ['The file is empty.'] };
  const header = rows[0].map(norm);
  const index = new Map<string, number>();
  INPUT_COLUMNS.forEach((c) => {
    const at = header.findIndex((h) => h === norm(c.header) || h === norm(c.key));
    if (at >= 0) index.set(c.key, at);
  });
  if (!index.has('name')) return { products: [], errors: ['No "Name" column found in the first row.'] };
  const products: Product[] = [];
  rows.slice(1).forEach((row, r) => {
    if (row.every((cell) => cell.trim() === '')) return;
    const p: Product = { id: makeId(products.length), name: '', unitCost: null };
    for (const c of INPUT_COLUMNS) {
      const at = index.get(c.key);
      if (at == null) continue;
      const raw = row[at] ?? '';
      if (c.kind === 'number') {
        const n = parseNumber(raw);
        if (n === 'invalid') {
          errors.push(`Row ${r + 2}: "${c.header}" is not a number (${raw}).`);
          (p as unknown as Record<string, unknown>)[c.key] = null;
        } else (p as unknown as Record<string, unknown>)[c.key] = n;
      } else {
        const v = /^'[=+\-@\t\r]/.test(raw) ? raw.slice(1) : raw;
        if (c.key === 'name') p.name = v;
        else if (v !== '') (p as unknown as Record<string, unknown>)[c.key] = v;
      }
    }
    products.push(p);
  });
  return { products, errors };
}
