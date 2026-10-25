import { useMemo, useState } from 'react';
import { calculateProduct } from '../engine';
import type { Model, Product } from '../engine';
import { NumberField, SelectField, TextField } from '../components/fields';
import { ResultDetails, StatusLine } from '../components/ResultDetails';
import { SensitivityPanel } from '../components/Sensitivity';
import { Waterfall } from '../components/Waterfall';
import { currencySymbol } from '../lib/format';

export function marketOptions(model: Model) {
  return [
    { value: '', label: `Default market (${model.settings.defaultMarket})` },
    ...model.markets.map((m) => ({ value: m.name, label: m.name })),
  ];
}

export function QuickCalculator({
  model,
  product,
  onChange,
  onAdd,
}: {
  model: Model;
  product: Product;
  onChange: (p: Product) => void;
  onAdd: (p: Product) => void;
}) {
  const result = useMemo(() => calculateProduct(model, product), [model, product]);
  const [added, setAdded] = useState<string | null>(null);
  const sym = currencySymbol(model.settings.currency);
  const set = (patch: Partial<Product>) => {
    setAdded(null);
    onChange({ ...product, ...patch });
  };
  const fxNote = model.settings.fxRate !== 1 ? 'In supplier currency, converted with the exchange rate in Settings.' : undefined;

  return (
    <div className="quick-layout">
      <section className="card inputs" aria-labelledby="quick-inputs">
        <h2 id="quick-inputs">Product</h2>
        <TextField label="Product name" value={product.name} onChange={(v) => set({ name: v })} />
        <SelectField label="Market" value={product.market ?? ''} onChange={(v) => set({ market: v || undefined })} options={marketOptions(model)} />
        <NumberField label="Unit cost" value={product.unitCost} nullable min={0} onChange={(v) => set({ unitCost: v })} hint={fxNote} />
        <NumberField label="Supplier shipping" value={product.supplierShipping} nullable min={0} onChange={(v) => set({ supplierShipping: v })} hint="Shipping you pay the supplier per unit." />
        <NumberField label="Ad cost per order" value={product.adCostPerOrder} nullable min={0} prefix={sym} onChange={(v) => set({ adCostPerOrder: v })} hint="Average advertising spend to win one order." />
        <NumberField
          label="Price override"
          value={product.priceOverride}
          nullable
          min={0}
          prefix={sym}
          placeholder="Use pricing rule"
          onChange={(v) => set({ priceOverride: v })}
          hint="Leave blank to use your pricing rule."
        />
        <NumberField label="Competitor price" value={product.competitorPrice} nullable min={0} prefix={sym} onChange={(v) => set({ competitorPrice: v })} />
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onAdd(product);
              setAdded(product.name || 'Product');
            }}
          >
            Add to product list
          </button>
          <span role="status" className="muted small">
            {added ? `Added "${added}" to the product list.` : ''}
          </span>
        </div>
      </section>
      <div className="quick-results">
        <section className="card" aria-labelledby="quick-results">
          <h2 id="quick-results">Results</h2>
          <StatusLine result={result} />
          {result.complete ? <ResultDetails model={model} result={result} /> : null}
        </section>
        {result.complete && (
          <section className="card">
            <Waterfall result={result} currency={model.settings.currency} />
          </section>
        )}
        {result.complete && <SensitivityPanel model={model} product={product} />}
      </div>
    </div>
  );
}
