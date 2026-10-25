import { checkTiers, EXAMPLE_NOTICE, fixedCostPerOrder, totalMonthlyFixed } from '../engine';
import type { FixedCost, Market, Model, PaymentMethod, PriceTier, PricingRule, Settings } from '../engine';
import { CheckField, NumberField, SelectField, TextField } from '../components/fields';
import { currencySymbol, fmtMoney } from '../lib/format';
import { newId } from '../lib/labels';

type NumSettingKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

const SETTING_FIELDS: { key: NumSettingKey; label: string; kind: 'pct' | 'money' | 'number'; hint: string }[] = [
  { key: 'targetMarginPct', label: 'Target net margin', kind: 'pct', hint: 'Profit you want to keep AFTER advertising and every other cost, as a share of net revenue (excluding tax).' },
  { key: 'minProfitPerOrder', label: 'Minimum profit per order', kind: 'money', hint: 'The recommended price also has to leave at least this much per order.' },
  { key: 'bufferPct', label: 'Contingency buffer', kind: 'pct', hint: 'Safety margin for surprises, as a share of net revenue. Counted as a cost.' },
  { key: 'discountPct', label: 'Average discount', kind: 'pct', hint: 'Average discount customers get off the published price (codes, sales).' },
  { key: 'refundPct', label: 'Refund rate', kind: 'pct', hint: 'Share of orders refunded. The revenue from those orders is lost.' },
  { key: 'returnHandlingCost', label: 'Cost per refunded order', kind: 'money', hint: 'Handling or return shipping you pay on each refunded order.' },
  { key: 'chargebackPct', label: 'Chargebacks', kind: 'pct', hint: 'Disputed payments and fraud losses, as a share of net revenue.' },
  { key: 'platformFeePct', label: 'Platform commission', kind: 'pct', hint: 'Marketplace or platform commission, as a share of net revenue. Use 0% if you sell on your own store.' },
  { key: 'platformFeePerOrder', label: 'Platform fee per order', kind: 'money', hint: 'Fixed platform, fulfilment or app fee charged on every order.' },
  { key: 'otherCostPerOrder', label: 'Other cost per order', kind: 'money', hint: 'Packaging, inserts, gifts and similar costs per order.' },
  { key: 'fxRate', label: 'Exchange rate', kind: 'number', hint: 'Store currency you get for 1 unit of supplier currency. Use 1 if both are the same.' },
  { key: 'fxFeePct', label: 'Sourcing currency fee', kind: 'pct', hint: 'Fee your bank or card adds when you pay suppliers in another currency.' },
  { key: 'maxBreakEvenRoas', label: 'Highest acceptable break even ROAS', kind: 'number', hint: 'Products needing a higher return on ad spend just to break even are marked Caution.' },
  { key: 'monthlyOrders', label: 'Orders per month', kind: 'number', hint: 'Expected orders a month, used to share fixed costs across orders.' },
];

function update<T>(list: T[], i: number, patch: Partial<T>): T[] {
  return list.map((x, j) => (j === i ? { ...x, ...patch } : x));
}

export function SettingsTab({
  model,
  onChange,
  onRenameMarket,
}: {
  model: Model;
  onChange: (m: Model) => void;
  onRenameMarket: (oldName: string, newName: string, next: Model) => void;
}) {
  const s = model.settings;
  const p = model.pricing;
  const sym = currencySymbol(s.currency);
  const setS = (patch: Partial<Settings>) => onChange({ ...model, settings: { ...s, ...patch } });
  const setP = (patch: Partial<PricingRule>) => onChange({ ...model, pricing: { ...p, ...patch } });
  const setFixed = (fixedCosts: FixedCost[]) => onChange({ ...model, fixedCosts });
  const setMarkets = (markets: Market[]) => onChange({ ...model, markets });
  const setMethods = (paymentMethods: PaymentMethod[]) => onChange({ ...model, paymentMethods });
  const setTiers = (tiers: PriceTier[]) => setP({ tiers });
  const tierChecks = checkTiers(model);

  const renameMarket = (i: number, name: string) => {
    const old = model.markets[i].name;
    const next: Model = {
      ...model,
      markets: update(model.markets, i, { name }),
      settings: { ...s, defaultMarket: s.defaultMarket === old ? name : s.defaultMarket },
    };
    onRenameMarket(old, name, next);
  };
  const renameMethod = (i: number, name: string) => {
    const old = model.paymentMethods[i].name;
    onChange({
      ...model,
      paymentMethods: update(model.paymentMethods, i, { name }),
      settings: { ...s, expectedPaymentMethod: s.expectedPaymentMethod === old ? name : s.expectedPaymentMethod },
    });
  };

  const notice = (
    <p className="notice" role="note">
      <strong>Check these rates.</strong> {EXAMPLE_NOTICE}
    </p>
  );

  return (
    <div className="stack settings">
      <section className="card" aria-labelledby="set-general">
        <h2 id="set-general">General settings</h2>
        <p className="callout">
          The target margin is your net margin <strong>after advertising and all costs</strong>: product, shipping, fees, refunds, taxes you pay, allocated fixed costs and the buffer.
        </p>
        <div className="form-grid">
          <TextField label="Currency code" value={s.currency} onChange={(v) => setS({ currency: v.toUpperCase().slice(0, 3) })} hint="Three letter ISO code such as USD, GBP or EUR. Used for display only." />
          <SelectField
            label="Default market"
            value={s.defaultMarket}
            onChange={(v) => setS({ defaultMarket: v })}
            options={[
              ...(model.markets.some((m) => m.name === s.defaultMarket) ? [] : [{ value: s.defaultMarket, label: `${s.defaultMarket || 'None'} (missing)` }]),
              ...model.markets.map((m) => ({ value: m.name, label: m.name })),
            ]}
            hint="Used for products with no market chosen."
          />
          <SelectField
            label="Expected payment method"
            value={s.expectedPaymentMethod}
            onChange={(v) => setS({ expectedPaymentMethod: v })}
            options={[
              ...(model.paymentMethods.some((m) => m.name === s.expectedPaymentMethod) ? [] : [{ value: s.expectedPaymentMethod, label: `${s.expectedPaymentMethod || 'None'} (missing)` }]),
              ...model.paymentMethods.map((m) => ({ value: m.name, label: m.name })),
            ]}
            hint="The method most customers use. Net profit uses it; worst case uses the most expensive method."
          />
          <SelectField
            label="Payment fees are charged on"
            value={s.paymentFeeBase}
            onChange={(v) => setS({ paymentFeeBase: v })}
            options={[
              { value: 'taxInclusive', label: 'The amount paid, including tax' },
              { value: 'netRevenue', label: 'Net revenue, excluding tax' },
            ]}
            hint="Most card processors charge on the full amount the customer pays, tax included. Choose net revenue if yours charges on the amount before tax."
          />
          {SETTING_FIELDS.map((f) => (
            <NumberField
              key={f.key}
              label={f.label}
              value={s[f.key]}
              percent={f.kind === 'pct'}
              prefix={f.kind === 'money' ? sym : undefined}
              onChange={(v) => setS({ [f.key]: v ?? 0 } as Partial<Settings>)}
              hint={f.hint}
            />
          ))}
          <CheckField label="I pay import duty" checked={s.sellerPaysDuty} onChange={(v) => setS({ sellerPaysDuty: v })} hint="Tick if you, not the customer, pay duty on imports. Uses each market's duty rate." />
        </div>
      </section>

      <section className="card" aria-labelledby="set-fixed">
        <h2 id="set-fixed">Fixed costs</h2>
        <p className="muted small">Monthly costs are shared across your expected orders per month. Any amount per order is added to every order as a variable cost.</p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Fixed costs table">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Category</th>
                <th scope="col" className="num">
                  Monthly
                </th>
                <th scope="col" className="num">
                  Per order
                </th>
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {model.fixedCosts.map((fc, i) => (
                <tr key={fc.id}>
                  <td>
                    <TextField label={`Name of fixed cost ${i + 1}`} hideLabel value={fc.name} onChange={(v) => setFixed(update(model.fixedCosts, i, { name: v }))} className="cell w-name" />
                  </td>
                  <td>
                    <TextField label={`Category of fixed cost ${i + 1}`} hideLabel value={fc.category} onChange={(v) => setFixed(update(model.fixedCosts, i, { category: v }))} className="cell w-market" />
                  </td>
                  <td>
                    <NumberField label={`Monthly amount of ${fc.name || `fixed cost ${i + 1}`}`} hideLabel prefix={sym} value={fc.monthly} onChange={(v) => setFixed(update(model.fixedCosts, i, { monthly: v ?? 0 }))} className="cell w-num" />
                  </td>
                  <td>
                    <NumberField label={`Per order amount of ${fc.name || `fixed cost ${i + 1}`}`} hideLabel prefix={sym} value={fc.perOrder} onChange={(v) => setFixed(update(model.fixedCosts, i, { perOrder: v ?? 0 }))} className="cell w-num" />
                  </td>
                  <td>
                    <button type="button" className="btn small danger" onClick={() => setFixed(model.fixedCosts.filter((_, j) => j !== i))}>
                      <span aria-hidden="true">Remove</span><span className="sr-only">{`Remove ${fc.name}`}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="toolbar">
          <button type="button" className="btn" onClick={() => setFixed([...model.fixedCosts, { id: newId('fc'), name: '', category: '', monthly: 0, perOrder: 0 }])}>
            Add fixed cost
          </button>
          <p className="totals">
            Total <strong data-testid="fixed-total">{fmtMoney(totalMonthlyFixed(model), s.currency)}</strong> a month, <strong>{fmtMoney(fixedCostPerOrder(model), s.currency)}</strong> per order
          </p>
        </div>
      </section>

      <section className="card" aria-labelledby="set-markets">
        <h2 id="set-markets">Markets</h2>
        {notice}
        <p className="muted small">Tax rates are charged to the customer and excluded from net revenue. Duty is on your supplier cost. Other taxes are a share of net revenue that you pay.</p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Markets table">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className="num">Tax rate</th>
                <th scope="col">Prices include tax</th>
                <th scope="col" className="num">Duty</th>
                <th scope="col" className="num">Other taxes</th>
                <th scope="col">Card region</th>
                <th scope="col" className="num">Customer FX fee</th>
                <th scope="col" className="num">Shipping charged</th>
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {model.markets.map((m, i) => {
                const n = m.name || `market ${i + 1}`;
                const up = (patch: Partial<Market>) => setMarkets(update(model.markets, i, patch));
                return (
                  <tr key={i}>
                    <td>
                      <TextField label={`Name of market ${i + 1}`} hideLabel value={m.name} onChange={(v) => renameMarket(i, v)} className="cell w-wide" />
                    </td>
                    <td>
                      <NumberField label={`Tax rate for ${n}`} hideLabel percent value={m.taxRate} onChange={(v) => up({ taxRate: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <CheckField label={`Prices include tax in ${n}`} hideLabel checked={m.pricesIncludeTax} onChange={(v) => up({ pricesIncludeTax: v })} />
                    </td>
                    <td>
                      <NumberField label={`Duty rate for ${n}`} hideLabel percent value={m.dutyRate} onChange={(v) => up({ dutyRate: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <NumberField label={`Other taxes for ${n}`} hideLabel percent value={m.otherTaxPct} onChange={(v) => up({ otherTaxPct: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <SelectField
                        label={`Card region for ${n}`}
                        hideLabel
                        value={m.region}
                        onChange={(v) => up({ region: v })}
                        options={[
                          { value: 'domestic', label: 'Domestic' },
                          { value: 'international', label: 'International' },
                        ]}
                        className="cell w-market"
                      />
                    </td>
                    <td>
                      <NumberField label={`Customer currency conversion fee for ${n}`} hideLabel percent value={m.customerFxFeePct} onChange={(v) => up({ customerFxFeePct: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <NumberField label={`Shipping charged to customers in ${n}`} hideLabel prefix={sym} value={m.shippingCharged} onChange={(v) => up({ shippingCharged: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <button type="button" className="btn small danger" onClick={() => setMarkets(model.markets.filter((_, j) => j !== i))}>
                        <span aria-hidden="true">Remove</span><span className="sr-only">{`Remove ${n}`}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() =>
            setMarkets([
              ...model.markets,
              { name: `New market ${model.markets.length + 1}`, taxRate: 0, pricesIncludeTax: false, dutyRate: 0, otherTaxPct: 0, region: 'international', customerFxFeePct: 0, shippingCharged: 0 },
            ])
          }
        >
          Add market
        </button>
      </section>

      <section className="card" aria-labelledby="set-methods">
        <h2 id="set-methods">Payment methods</h2>
        {notice}
        <p className="muted small">
          Fees are a percentage plus a fixed amount per order. The worst case uses the most expensive method that is ticked and available in the market. Fees are charged on{' '}
          {s.paymentFeeBase === 'taxInclusive' ? 'the amount paid including tax' : 'net revenue excluding tax'} (change this in General settings).
        </p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Payment methods table">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">In worst case</th>
                <th scope="col">Available</th>
                <th scope="col" className="num">Domestic %</th>
                <th scope="col" className="num">Domestic fixed</th>
                <th scope="col" className="num">International %</th>
                <th scope="col" className="num">International fixed</th>
                <th scope="col" className="num">Extra platform fee</th>
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {model.paymentMethods.map((m, i) => {
                const n = m.name || `method ${i + 1}`;
                const up = (patch: Partial<PaymentMethod>) => setMethods(update(model.paymentMethods, i, patch));
                return (
                  <tr key={i}>
                    <td>
                      <TextField label={`Name of payment method ${i + 1}`} hideLabel value={m.name} onChange={(v) => renameMethod(i, v)} className="cell w-wide" />
                    </td>
                    <td>
                      <CheckField label={`Include ${n} in worst case`} hideLabel checked={m.includeInWorstCase} onChange={(v) => up({ includeInWorstCase: v })} />
                    </td>
                    <td>
                      <SelectField
                        label={`Availability of ${n}`}
                        hideLabel
                        value={m.availability}
                        onChange={(v) => up({ availability: v })}
                        options={[
                          { value: 'all', label: 'All markets' },
                          { value: 'domestic', label: 'Domestic only' },
                          { value: 'international', label: 'International only' },
                        ]}
                        className="cell w-market"
                      />
                    </td>
                    <td>
                      <NumberField label={`Domestic percentage fee for ${n}`} hideLabel percent value={m.domesticPct} onChange={(v) => up({ domesticPct: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <NumberField label={`Domestic fixed fee for ${n}`} hideLabel prefix={sym} value={m.domesticFixed} onChange={(v) => up({ domesticFixed: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <NumberField label={`International percentage fee for ${n}`} hideLabel percent value={m.internationalPct} onChange={(v) => up({ internationalPct: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <NumberField label={`International fixed fee for ${n}`} hideLabel prefix={sym} value={m.internationalFixed} onChange={(v) => up({ internationalFixed: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <NumberField label={`Extra platform transaction fee for ${n}`} hideLabel percent value={m.extraPct} onChange={(v) => up({ extraPct: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <button type="button" className="btn small danger" onClick={() => setMethods(model.paymentMethods.filter((_, j) => j !== i))}>
                        <span aria-hidden="true">Remove</span><span className="sr-only">{`Remove ${n}`}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() =>
            setMethods([
              ...model.paymentMethods,
              { name: `New method ${model.paymentMethods.length + 1}`, includeInWorstCase: true, availability: 'all', domesticPct: 0, domesticFixed: 0, internationalPct: 0, internationalFixed: 0, extraPct: 0 },
            ])
          }
        >
          Add payment method
        </button>
      </section>

      <section className="card" aria-labelledby="set-pricing">
        <h2 id="set-pricing">Pricing rule</h2>
        <p className="muted small">
          The pricing rule sets a price from your cost using markup tiers. Cost ranges are in store currency and should run on from each other (for example 0 to 5, then 5.01 to 10).
        </p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Markup tiers table">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col" className="num">Cost from</th>
                <th scope="col" className="num">Cost to</th>
                <th scope="col" className="num">Markup %</th>
                <th scope="col" className="num">Markup amount</th>
                <th scope="col">Check</th>
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {p.tiers.map((t, i) => {
                const up = (patch: Partial<PriceTier>) => setTiers(update(p.tiers, i, patch));
                const ok = tierChecks[i] === 'OK';
                return (
                  <tr key={i}>
                    <th scope="row">{i + 1}</th>
                    <td>
                      <NumberField label={`Tier ${i + 1} cost from`} hideLabel prefix={sym} value={t.min} onChange={(v) => up({ min: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <NumberField label={`Tier ${i + 1} cost to`} hideLabel prefix={sym} value={t.max} onChange={(v) => up({ max: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <NumberField label={`Tier ${i + 1} markup percentage`} hideLabel percent value={t.markupPct} onChange={(v) => up({ markupPct: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <NumberField label={`Tier ${i + 1} markup amount`} hideLabel prefix={sym} value={t.markupAmount} onChange={(v) => up({ markupAmount: v ?? 0 })} className="cell w-num" />
                    </td>
                    <td>
                      <span className={`check-msg ${ok ? 'ok' : 'bad'}`}>
                        <span aria-hidden="true">{ok ? '✓ ' : '! '}</span>
                        {ok ? 'OK' : tierChecks[i]}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="btn small danger" onClick={() => setTiers(p.tiers.filter((_, j) => j !== i))}>
                        <span aria-hidden="true">Remove</span><span className="sr-only">{`Remove tier ${i + 1}`}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const last = p.tiers[p.tiers.length - 1];
            const min = last ? Math.round((last.max + 0.01) * 100) / 100 : 0;
            setTiers([...p.tiers, { min, max: min + 100, markupPct: last?.markupPct ?? 0.5, markupAmount: last?.markupAmount ?? 0 }]);
          }}
        >
          Add tier
        </button>
        <div className="form-grid spaced">
          <SelectField
            label="Markup basis"
            value={p.basis}
            onChange={(v) => setP({ basis: v })}
            options={[
              { value: 'pctPlusAmount', label: 'Percentage plus amount' },
              { value: 'higherOf', label: 'Higher of percentage or amount' },
              { value: 'pctOnly', label: 'Percentage only' },
              { value: 'amountOnly', label: 'Amount only' },
            ]}
            hint="How each tier's markup percentage and amount combine."
          />
          <NumberField label="Gross up for fees" percent value={p.feeGrossUpPct} onChange={(v) => setP({ feeGrossUpPct: v ?? 0 })} hint="The price is divided by (1 minus this rate) to cover a percentage fee. Use 0% to skip." />
          <NumberField label="Fixed fee added" prefix={sym} value={p.feeGrossUpFixed} onChange={(v) => setP({ feeGrossUpFixed: v ?? 0 })} hint="Added to the price after the gross up." />
          <NumberField label="Minimum markup profit" prefix={sym} value={p.minMarkupProfit} onChange={(v) => setP({ minMarkupProfit: v ?? 0 })} hint="Flags products whose pricing rule leaves less than this over cost." />
          <SelectField
            label="Price ending"
            value={p.rounding}
            onChange={(v) => setP({ rounding: v })}
            options={[
              { value: 'cent', label: 'Nearest cent' },
              { value: '99', label: 'End in .99' },
              { value: '95', label: 'End in .95' },
              { value: 'whole', label: 'Whole number' },
            ]}
            hint="How prices from the rule are rounded."
          />
          <NumberField label="Competitor band" percent value={p.competitorBandPct} onChange={(v) => setP({ competitorBandPct: v ?? 0 })} hint="Prices within this distance of the competitor price count as competitive." />
          <CheckField label="Include supplier shipping in cost" checked={p.includeShippingInCost} onChange={(v) => setP({ includeShippingInCost: v })} hint="Apply the markup to unit cost plus supplier shipping." />
          <CheckField label="Raise to minimum safe price" checked={p.raiseToMinimumSafe} onChange={(v) => setP({ raiseToMinimumSafe: v })} hint="If the rule gives a price below the minimum safe price, publish the minimum safe price instead." />
        </div>
      </section>
    </div>
  );
}
