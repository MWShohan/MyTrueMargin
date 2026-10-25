import { useState } from 'react';
import type { ProductResult } from '../engine';
import { fmtMoney, fmtPct } from '../lib/format';
import { sumProfitWalk } from '../lib/labels';

interface Bar {
  key: string;
  label: string;
  amount: number;
  from: number;
  to: number;
  kind: 'revenue' | 'cost' | 'total';
}

/** Profit walk from net revenue down to net profit, drawn as a horizontal waterfall. */
export function Waterfall({ result, currency, title = 'Profit walk' }: { result: ProductResult; currency: string; title?: string }) {
  const [showZero, setShowZero] = useState(false);
  const lines = result.profitWalk;
  const rev = result.netRevenue;

  // Layout positions for drawing: running position of each line along the walk.
  let pos = 0;
  const all: Bar[] = lines.map((l) => {
    const from = pos;
    pos += l.amount;
    return { key: l.key, label: l.label, amount: l.amount, from, to: pos, kind: l.key === 'revenue' ? 'revenue' : 'cost' };
  });
  all.push({ key: 'net', label: 'Net profit', amount: result.netProfit, from: 0, to: result.netProfit, kind: 'total' });
  const points = all.flatMap((b) => [b.from, b.to]);
  const lo = Math.min(0, ...points);
  const hi = Math.max(0, ...points);
  const span = hi - lo || 1;
  const x = (v: number) => ((v - lo) / span) * 100;
  const bars = all.filter((b) => showZero || b.kind !== 'cost' || Math.abs(b.amount) >= 0.005);
  const hidden = all.length - bars.length;

  const sum = sumProfitWalk(lines);
  const matches = Math.abs(sum - result.netProfit) < 0.005;

  return (
    <figure className="waterfall" aria-label={`${title}: from net revenue ${fmtMoney(rev, currency)} to net profit ${fmtMoney(result.netProfit, currency)}`}>
      <figcaption className="wf-head">
        <h3>{title}</h3>
        {hidden > 0 || showZero ? (
          <label className="inline-check">
            <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} /> Show lines with no amount
          </label>
        ) : null}
      </figcaption>
      <div className="wf-table" role="table" aria-label={title}>
        <div className="wf-row wf-header" role="row">
          <span role="columnheader">Line</span>
          <span role="columnheader" className="wf-bar-col">
            <span className="sr-only">Bar</span>
          </span>
          <span role="columnheader" className="num">
            Amount
          </span>
          <span role="columnheader" className="num">
            % of net revenue
          </span>
        </div>
        {bars.map((b) => {
          const left = x(Math.min(b.from, b.to));
          const width = Math.max(0.6, Math.abs(x(b.to) - x(b.from)));
          const cls = b.kind === 'total' ? (b.amount >= 0 ? 'bar-profit' : 'bar-loss') : b.kind === 'revenue' ? 'bar-revenue' : 'bar-cost';
          return (
            <div key={b.key} className={`wf-row${b.kind === 'total' ? ' wf-total' : ''}`} role="row">
              <span role="cell" className="wf-label">
                {b.label}
              </span>
              <span role="cell" className="wf-bar-col" aria-hidden="true">
                <svg viewBox="0 0 100 12" preserveAspectRatio="none" className="wf-svg" focusable="false">
                  <line x1={x(0)} x2={x(0)} y1="0" y2="12" className="wf-axis" vectorEffect="non-scaling-stroke" />
                  <rect x={left} y="2" width={width} height="8" rx="1" className={cls}>
                    <title>{`${b.label}: ${fmtMoney(b.amount, currency)}`}</title>
                  </rect>
                </svg>
              </span>
              <span role="cell" className="num">
                {fmtMoney(b.amount, currency)}
              </span>
              <span role="cell" className="num muted">
                {rev > 0 ? fmtPct(b.amount / rev) : 'n/a'}
              </span>
            </div>
          );
        })}
      </div>
      <p className={`wf-check ${matches ? 'ok' : 'bad'}`} data-testid="walk-check">
        <span aria-hidden="true">{matches ? '✓' : '✕'}</span> Check: the lines add up to {fmtMoney(sum, currency)}, net profit is{' '}
        {fmtMoney(result.netProfit, currency)}. {matches ? 'They match.' : 'They do not match.'}
      </p>
    </figure>
  );
}
