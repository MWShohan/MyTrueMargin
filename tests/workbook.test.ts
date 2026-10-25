// Reconciles the engine against values cached in the reference workbook.
// Fixtures are produced by scripts/extract_workbook_fixture.py.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calculateProduct, fixedCostPerOrder, totalMonthlyFixed } from '../src/engine';
import type { Model, Product, ProductResult } from '../src/engine';

interface Fixture {
  model: Model;
  products: { input: Product; expected: Record<string, unknown> }[];
  summary: { fixedMonthly: number; fixedPerOrder: number };
}

const dir = join(__dirname, 'fixtures');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

const numericKeys: (keyof ProductResult)[] = [
  'markupPrice', 'markupProfit', 'minimumSafePrice', 'priceToPublish', 'competitorDiffPct', 'netProfit',
  'netMargin', 'netProfitWorst', 'grossProfit', 'grossMargin', 'breakEvenPrice', 'recommendedPrice',
  'breakEvenRoas', 'maxAdCostAtTarget', 'netRevenue', 'paymentFeeExpected', 'paymentFeeWorst',
  'roasForTarget', 'contributionPerOrder', 'landedCost',
];

const statusPrefix = (s: string) => s.split(':')[0].trim().replace(/ /g, '_');

describe.each(files)('workbook fixture %s', (file) => {
  const fx: Fixture = JSON.parse(readFileSync(join(dir, file), 'utf8'));

  it('matches fixed cost totals', () => {
    expect(totalMonthlyFixed(fx.model)).toBeCloseTo(fx.summary.fixedMonthly, 6);
    expect(fixedCostPerOrder(fx.model)).toBeCloseTo(fx.summary.fixedPerOrder, 6);
  });

  it.each(fx.products.map((p) => [p.input.name, p] as const))('%s', (_name, { input, expected }) => {
    const r = calculateProduct(fx.model, input);
    if (typeof expected.netProfit !== 'number') {
      // Workbook could not price this row; the engine must flag it too.
      expect(r.complete ? r.status : 'INCOMPLETE').toBe(
        r.complete ? statusPrefix(String(expected.status)) : 'INCOMPLETE',
      );
      return;
    }
    expect(r.complete).toBe(true);
    if (!r.complete) return;
    for (const k of numericKeys) {
      const e = expected[k];
      const got = r[k];
      if (typeof e === 'number') {
        expect(got, k).not.toBeNull();
        expect(got as number, k).toBeCloseTo(e, 6);
      } else if (e === '' || e == null) {
        // blank in the workbook: competitor price missing
        if (k === 'competitorDiffPct') expect(got, k).toBeNull();
      } else {
        // text such as "Not viable" or "Check inputs"
        expect(got, `${k} (${String(e)})`).toBeNull();
      }
    }
    // Added to fixtures later; older fixtures may not carry them.
    if (expected.competitorPosition != null) expect(r.competitorPosition).toBe(expected.competitorPosition);
    if (expected.priceSource != null) expect(r.priceSource).toBe(expected.priceSource);
    expect(r.tierIndex + 1).toBe(expected.tier);
    expect(r.worstMethod).toBe(expected.worstMethod);
    expect(r.status).toBe(statusPrefix(String(expected.status)));
    expect(r.statusText.replace(/\s+/g, ' ')).toBe(String(expected.status).replace(/\s+/g, ' '));
  });
});
