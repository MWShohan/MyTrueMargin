import { useMemo } from 'react';
import { summarise } from '../engine';
import type { Model, Product } from '../engine';
import { StatusBadge } from '../components/StatusBadge';
import { fmtMoney, fmtNum, fmtPct, fmtSignedPct } from '../lib/format';
import { STATUS_INFO, STATUS_ORDER } from '../lib/labels';

function Tile({ label, value, note, testId }: { label: string; value: string; note?: string; testId?: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value" data-testid={testId}>
        {value}
      </div>
      {note && <div className="tile-note">{note}</div>}
    </div>
  );
}

export function Dashboard({ model, products }: { model: Model; products: Product[] }) {
  const s = useMemo(() => summarise(model, products), [model, products]);
  const c = model.settings.currency;
  const maxCount = Math.max(1, ...STATUS_ORDER.map((k) => s.byStatus[k]));
  return (
    <div className="stack">
      <section className="card" aria-labelledby="dash-title">
        <h2 id="dash-title">Dashboard</h2>
        <p className="muted small">
          Across {s.productsEntered} priced product{s.productsEntered === 1 ? '' : 's'} at their price to publish, using your expected payment method.
        </p>
        <div className="tiles">
          <Tile label="Average price to publish" value={fmtMoney(s.averagePrice, c, 'n/a')} />
          <Tile label="Average net profit" value={fmtMoney(s.averageNetProfit, c, 'n/a')} note="Per order" />
          <Tile label="Average net margin" value={fmtPct(s.averageNetMargin)} note={`Target ${fmtPct(model.settings.targetMarginPct)}`} />
          <Tile label="Pricing rule below minimum safe" value={fmtNum(s.markupBelowMinimumSafe, 0)} note="Products whose markup price is under the minimum safe price" />
        </div>
      </section>

      <div className="two-col">
        <section className="card" aria-labelledby="dash-status">
          <h2 id="dash-status">Products by status</h2>
          <table className="data compact status-table">
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col" className="num">
                  Products
                </th>
                <th scope="col">
                  <span className="sr-only">Share</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {STATUS_ORDER.map((k) => (
                <tr key={k}>
                  <th scope="row">
                    <StatusBadge status={k} title={STATUS_INFO[k].explain} />
                  </th>
                  <td className="num" data-testid={`count-${k}`}>
                    {s.byStatus[k]}
                  </td>
                  <td className="bar-cell" aria-hidden="true">
                    <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="mini-bar">
                      <rect x="0" y="1" width={(s.byStatus[k] / maxCount) * 100} height="8" rx="1" className={`fill-${STATUS_INFO[k].tone}`} />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card" aria-labelledby="dash-fixed">
          <h2 id="dash-fixed">Fixed costs</h2>
          <div className="tiles narrow">
            <Tile label="Total monthly fixed costs" value={fmtMoney(s.totalMonthlyFixed, c)} />
            <Tile label="Fixed cost per order" value={fmtMoney(s.fixedCostPerOrder, c)} note={`At ${fmtNum(model.settings.monthlyOrders, 0)} orders a month`} />
            <Tile
              label="Orders a month to cover fixed costs"
              value={s.ordersToCoverFixed == null ? 'Not achievable' : fmtNum(s.ordersToCoverFixed, 1)}
              note={s.ordersToCoverFixed == null ? 'Average contribution per order is zero or negative' : 'At the average contribution per order'}
              testId="orders-to-cover"
            />
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="dash-comp">
        <h2 id="dash-comp">Competitor summary</h2>
        <p className="muted small">Band is {fmtPct(model.pricing.competitorBandPct)} either side of the competitor price.</p>
        <div className="tiles">
          <Tile label="Above competitor band" value={fmtNum(s.competitor.tooHigh, 0)} />
          <Tile label="Competitive" value={fmtNum(s.competitor.competitive, 0)} />
          <Tile label="Below competitor band" value={fmtNum(s.competitor.tooLow, 0)} />
          <Tile label="No competitor price" value={fmtNum(s.competitor.none, 0)} />
          <Tile label="Average difference" value={fmtSignedPct(s.competitor.averageDiff)} note="Your price against the competitor's" />
          <Tile label="Median difference" value={fmtSignedPct(s.competitor.medianDiff)} />
        </div>
      </section>
    </div>
  );
}
