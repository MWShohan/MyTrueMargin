import { calculateProduct, defaultModel, exampleProducts } from '../src/engine';
import type { Product } from '../src/engine';
import { COMPUTED_HEADERS, INPUT_COLUMNS, parseCsv, productsFromCsv, productsToCsv, toCsv } from '../src/lib/csv';

const stripId = ({ id: _id, ...rest }: Product) => {
  void _id;
  // Normalise optional fields so undefined and null compare equal.
  const out: Record<string, unknown> = {};
  for (const c of INPUT_COLUMNS) {
    const v = (rest as Record<string, unknown>)[c.key];
    out[c.key] = v === undefined || v === '' ? (c.kind === 'number' ? null : c.key === 'name' ? '' : undefined) : v;
  }
  return out;
};

describe('toCsv and parseCsv', () => {
  it('round trips awkward text', () => {
    const rows = [
      ['a', 'b, with comma', 'quote "inside"'],
      ['line\nbreak', ' padded ', ''],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('handles CRLF, a BOM and trailing newlines', () => {
    expect(parseCsv('﻿Name,Unit cost\r\nA,1\r\n\r\n')).toEqual([
      ['Name', 'Unit cost'],
      ['A', '1'],
    ]);
  });

  it('writes numbers raw and nulls as empty cells', () => {
    expect(toCsv([[1.5, null, 'x']])).toBe('1.5,,x');
  });
});

describe('product CSV', () => {
  const products: Product[] = [
    ...exampleProducts(),
    {
      id: 'weird',
      name: '=SUM(A1) "quoted", name',
      market: 'Example GST market (10%, tax inclusive)',
      unitCost: 12.345,
      supplierShipping: null,
      adCostPerOrder: 4,
      priceOverride: 29.99,
      competitorPrice: 31,
      competitorUrl: 'https://example.com/item?a=1,b=2',
      notes: 'multi\nline',
    },
    { id: 'blank', name: 'No cost yet', unitCost: null },
  ];

  it('round trips every input field', () => {
    const csv = productsToCsv(products);
    const back = productsFromCsv(csv);
    expect(back.errors).toEqual([]);
    expect(back.products.map(stripId)).toEqual(products.map(stripId));
  });

  it('round trips when computed columns are included, and ignores them on import', () => {
    const model = defaultModel();
    const csv = productsToCsv(products, model);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...INPUT_COLUMNS.map((c) => c.header), ...COMPUTED_HEADERS]);
    const r = calculateProduct(model, products[0]);
    if (!r.complete) throw new Error('expected a complete result');
    const priceCol = rows[0].indexOf('Price to publish');
    const statusCol = rows[0].indexOf('Status');
    expect(Number(rows[1][priceCol])).toBeCloseTo(r.priceToPublish, 10);
    expect(Number(rows[1][rows[0].indexOf('Net profit')])).toBeCloseTo(r.netProfit, 10);
    expect(rows[1][statusCol]).toBe(r.status);
    expect(rows[products.length][statusCol]).toBe('INCOMPLETE');
    expect(productsFromCsv(csv).products.map(stripId)).toEqual(products.map(stripId));
  });

  it('guards text that a spreadsheet would run as a formula', () => {
    const csv = productsToCsv([{ id: 'x', name: '=1+1', unitCost: 1 }]);
    expect(csv.split('\r\n')[1].startsWith("'=1+1")).toBe(true);
    expect(productsFromCsv(csv).products[0].name).toBe('=1+1');
  });

  it('accepts field keys as headers in any order and reports bad numbers', () => {
    const res = productsFromCsv('unitcost,NAME,competitor price\n10,A,abc\n,B,\n');
    expect(res.products).toHaveLength(2);
    expect(res.products[0]).toMatchObject({ name: 'A', unitCost: 10, competitorPrice: null });
    expect(res.products[1]).toMatchObject({ name: 'B', unitCost: null });
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toContain('Row 2');
  });

  it('rejects files without a Name column', () => {
    expect(productsFromCsv('a,b\n1,2').errors[0]).toMatch(/Name/);
    expect(productsFromCsv('').errors[0]).toMatch(/empty/);
  });
});
