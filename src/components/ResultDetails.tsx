import type { Model, ProductResult, Result } from '../engine';
import { fmtMoney, fmtPct, fmtRatio, fmtSignedPct } from '../lib/format';
import { COMPETITOR_LABEL, PRICE_SOURCE_LABEL, STATUS_INFO } from '../lib/labels';
import { StatusBadge } from './StatusBadge';

function Item({ label, value, note, testId, strong }: { label: string; value: string; note?: string; testId?: string; strong?: boolean }) {
  return (
    <div className={`metric${strong ? ' strong' : ''}`}>
      <dt>{label}</dt>
      <dd>
        <span className="metric-value" data-testid={testId}>
          {value}
        </span>
        {note && <span className="metric-note">{note}</span>}
      </dd>
    </div>
  );
}

export function StatusLine({ result }: { result: Result }) {
  return (
    <div className={`status-line tone-bg-${STATUS_INFO[result.status].tone}`} role="status">
      <StatusBadge status={result.status} />
      <span>{result.statusText ? result.statusText.replace(/^[A-Z ]+:\s*/, '').replace(/^./, (c) => c.toUpperCase()) : STATUS_INFO[result.status].explain}</span>
    </div>
  );
}

/** Key figures for one product, all taken straight from the engine result. */
export function ResultDetails({ model, result }: { model: Model; result: ProductResult }) {
  const c = model.settings.currency;
  const m = (v: number | null, nullText?: string) => fmtMoney(v, c, nullText);
  return (
    <div className="results">
      <dl className="metrics hero">
        <Item label="Price to publish" value={m(result.priceToPublish)} note={PRICE_SOURCE_LABEL[result.priceSource]} testId="price-to-publish" strong />
        <Item
          label="Net profit per order"
          value={m(result.netProfit)}
          note={`Net margin ${fmtPct(result.netMargin)} with ${model.settings.expectedPaymentMethod || 'the expected method'}`}
          testId="net-profit"
          strong
        />
        <Item
          label="Worst case net profit"
          value={m(result.netProfitWorst)}
          note={`Margin ${fmtPct(result.netMarginWorst)} if paid by ${result.worstMethod || 'the most expensive method'}`}
          testId="worst-profit"
          strong
        />
      </dl>
      <h3 className="sub">Price levels</h3>
      <dl className="metrics">
        <Item label="Recommended price" value={m(result.recommendedPrice)} note="Meets target margin and minimum profit in the worst case" testId="recommended-price" />
        <Item label="Minimum safe price" value={m(result.minimumSafePrice)} note="Covers every cost plus the buffer in the worst case" testId="minimum-safe-price" />
        <Item label="Break even price" value={m(result.breakEvenPrice)} note="Zero profit with the expected method" testId="break-even-price" />
        <Item
          label="Pricing rule price"
          value={m(result.markupPrice)}
          note={`Tier ${result.tierIndex + 1}, markup profit ${m(result.markupProfit)}${result.markupBelowMinProfit ? ' (below your minimum markup profit)' : ''}`}
        />
      </dl>
      {result.markupBelowMinimumSafe && (
        <p className="alert tone-bg-serious">
          <span aria-hidden="true">! </span>The pricing rule price is below the minimum safe price.
        </p>
      )}
      <h3 className="sub">Margins and advertising</h3>
      <dl className="metrics">
        <Item label="Gross margin" value={fmtPct(result.grossMargin)} note={`Gross profit ${m(result.grossProfit)} after landed cost`} />
        <Item label="Contribution per order" value={m(result.contributionPerOrder)} note="Before allocated fixed cost and buffer" />
        <Item label="Break even ROAS" value={fmtRatio(result.breakEvenRoas)} note={`Your limit is ${fmtRatio(model.settings.maxBreakEvenRoas)}`} />
        <Item label="ROAS for target" value={fmtRatio(result.roasForTarget)} note="Return on ad spend needed to hit the target margin" />
        <Item label="Max ad cost at target" value={m(result.maxAdCostAtTarget)} note="Most you can spend on ads per order and still hit target" />
        <Item label="Expected ROAS" value={fmtRatio(result.expectedRoas, 'n/a')} note={result.adCost > 0 ? `From ad cost ${m(result.adCost)}` : 'No ad cost entered'} />
        <Item
          label="Competitor position"
          value={COMPETITOR_LABEL[result.competitorPosition]}
          note={result.competitorDiffPct == null ? 'Enter a competitor price to compare' : `${fmtSignedPct(result.competitorDiffPct)} against the competitor price`}
          testId="competitor-position"
        />
        <Item label="Net revenue" value={m(result.netRevenue)} note={`Excludes tax of ${m(result.taxCollected)}; market ${result.marketName}`} />
      </dl>
    </div>
  );
}
