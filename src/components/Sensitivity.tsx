import { useMemo, useState } from 'react';
import { sensitivity } from '../engine';
import type { Model, Product, SensitivityVariable } from '../engine';
import { fmtMoney, fmtPct, fmtSignedPct } from '../lib/format';
import { SelectField } from './fields';

const STEPS = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];

const VARIABLES: { value: SensitivityVariable; label: string; note: string }[] = [
  { value: 'price', label: 'Price to publish', note: 'Each step moves the published price.' },
  { value: 'unitCost', label: 'Unit cost', note: 'The published price stays fixed while the unit cost moves.' },
  {
    value: 'adCost',
    label: 'Ad cost per order',
    note: 'The published price stays fixed. With no ad cost entered, each positive step is read as that share of the price spent on ads.',
  },
  { value: 'refundPct', label: 'Refund rate', note: 'The published price stays fixed while the refund rate moves.' },
];

export function SensitivityPanel({ model, product }: { model: Model; product: Product }) {
  const [variable, setVariable] = useState<SensitivityVariable>('price');
  const rows = useMemo(() => sensitivity(model, product, variable, STEPS), [model, product, variable]);
  const currency = model.settings.currency;
  const target = model.settings.targetMarginPct;
  const meta = VARIABLES.find((v) => v.value === variable)!;

  // Chart geometry (display only).
  const W = 340;
  const H = 180;
  const pad = { l: 46, r: 12, t: 12, b: 28 };
  const vals = rows.map((r) => r.netMargin).filter((v): v is number => v != null);
  const lo = Math.min(0, target, ...vals);
  const hi = Math.max(0, target, ...vals);
  const range = hi - lo || 1;
  const yMin = lo - range * 0.08;
  const yMax = hi + range * 0.08;
  const x = (i: number) => pad.l + (i / (STEPS.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const segments: string[] = [];
  let current = '';
  rows.forEach((r, i) => {
    if (r.netMargin == null) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.netMargin).toFixed(1)}`;
  });
  if (current) segments.push(current);

  return (
    <section className="card" aria-labelledby="sens-title">
      <h3 id="sens-title">Sensitivity</h3>
      <p className="muted small">How the net margin (expected payment method) changes when one input moves from 30% lower to 30% higher.</p>
      <SelectField label="Variable to move" value={variable} onChange={setVariable} options={VARIABLES.map((v) => ({ value: v.value, label: v.label }))} hint={meta.note} />
      <div className="sens-grid">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Sensitivity table">
          <table className="data compact">
            <thead>
              <tr>
                <th scope="col">Change</th>
                <th scope="col" className="num">
                  Net profit
                </th>
                <th scope="col" className="num">
                  Net margin
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.step} className={r.step === 0 ? 'row-current' : undefined}>
                  <th scope="row">{r.step === 0 ? 'Current' : fmtSignedPct(r.step)}</th>
                  <td className="num">{fmtMoney(r.netProfit, currency, 'n/a')}</td>
                  <td className="num">{fmtPct(r.netMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="sens-chart"
          role="img"
          aria-label={`Line chart of net margin as ${meta.label.toLowerCase()} moves. The table alongside lists the same values.`}
        >
          {[yMax, (yMax + yMin) / 2, yMin].map((v, i) => (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="tick">
                {fmtPct(v)}
              </text>
            </g>
          ))}
          <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="zero" />
          <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} className="target" />
          <text x={W - pad.r} y={y(target) - 4} textAnchor="end" className="tick label-target">
            Target {fmtPct(target)}
          </text>
          {STEPS.map((s, i) => (
            <text key={s} x={x(i)} y={H - 8} textAnchor="middle" className="tick">
              {s === 0 ? '0' : fmtSignedPct(s)}
            </text>
          ))}
          {segments.map((d, i) => (
            <path key={i} d={d} className="series" />
          ))}
          {rows.map((r, i) =>
            r.netMargin == null ? null : (
              <g key={r.step} className="pt">
                <circle cx={x(i)} cy={y(r.netMargin)} r="12" className="hit" />
                <circle cx={x(i)} cy={y(r.netMargin)} r="4" className={r.step === 0 ? 'dot current' : 'dot'} />
                <title>{`${r.step === 0 ? 'Current' : fmtSignedPct(r.step)}: net margin ${fmtPct(r.netMargin)}, net profit ${fmtMoney(r.netProfit, currency, 'n/a')}`}</title>
              </g>
            ),
          )}
        </svg>
      </div>
    </section>
  );
}
