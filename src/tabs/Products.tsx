import { useMemo, useRef, useState } from 'react';
import { calculateProduct } from '../engine';
import type { Model, Product, Result, StatusCode } from '../engine';
import { NumberField, SelectField, TextField } from '../components/fields';
import { ResultDetails, StatusLine } from '../components/ResultDetails';
import { StatusBadge } from '../components/StatusBadge';
import { Waterfall } from '../components/Waterfall';
import { productsFromCsv, productsToCsv } from '../lib/csv';
import { fmtMoney, fmtPct } from '../lib/format';
import { COMPETITOR_LABEL, STATUS_INFO, STATUS_ORDER, newId } from '../lib/labels';
import { downloadText } from '../lib/storage';
import { marketOptions } from './QuickCalculator';

type NumKey = 'unitCost' | 'supplierShipping' | 'adCostPerOrder' | 'priceOverride' | 'competitorPrice';
type SortKey =
  | 'name'
  | 'market'
  | NumKey
  | 'competitorUrl'
  | 'priceToPublish'
  | 'netProfit'
  | 'netMargin'
  | 'netProfitWorst'
  | 'status'
  | 'competitorPosition';

const NUM_COLS: { key: NumKey; label: string }[] = [
  { key: 'unitCost', label: 'Unit cost' },
  { key: 'supplierShipping', label: 'Shipping' },
  { key: 'adCostPerOrder', label: 'Ad cost' },
  { key: 'priceOverride', label: 'Override' },
  { key: 'competitorPrice', label: 'Competitor price' },
];

const COMPUTED_COLS: { key: SortKey; label: string }[] = [
  { key: 'priceToPublish', label: 'Price to publish' },
  { key: 'netProfit', label: 'Net profit' },
  { key: 'netMargin', label: 'Net margin' },
  { key: 'netProfitWorst', label: 'Worst case profit' },
  { key: 'status', label: 'Status' },
  { key: 'competitorPosition', label: 'Competitor position' },
];

function sortValue(p: Product, r: Result, key: SortKey): string | number | null {
  switch (key) {
    case 'name':
      return p.name.toLowerCase();
    case 'market':
      return (p.market ?? '').toLowerCase();
    case 'competitorUrl':
      return (p.competitorUrl ?? '').toLowerCase();
    case 'status':
      return STATUS_ORDER.indexOf(r.status);
    case 'competitorPosition':
      return r.complete ? COMPETITOR_LABEL[r.competitorPosition] : null;
    case 'priceToPublish':
    case 'netProfit':
    case 'netMargin':
    case 'netProfitWorst':
      return r.complete ? r[key] : null;
    default:
      return p[key] ?? null;
  }
}

export function Products({
  model,
  products,
  onChange,
}: {
  model: Model;
  products: Product[];
  onChange: (products: Product[]) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [filter, setFilter] = useState<'ALL' | StatusCode>('ALL');
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [replace, setReplace] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const c = model.settings.currency;

  const rows = useMemo(() => products.map((p) => ({ p, r: calculateProduct(model, p) })), [model, products]);
  const visible = useMemo(() => {
    let list = filter === 'ALL' ? rows : rows.filter((x) => x.r.status === filter);
    if (sort) {
      list = [...list].sort((a, b) => {
        const va = sortValue(a.p, a.r, sort.key);
        const vb = sortValue(b.p, b.r, sort.key);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
      });
    }
    return list;
  }, [rows, sort, filter]);

  const update = (id: string, patch: Partial<Product>) => onChange(products.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const add = () => {
    const p: Product = { id: newId(), name: `Product ${products.length + 1}`, unitCost: null };
    onChange([...products, p]);
    setSelected(p.id);
  };
  const duplicate = (p: Product) => {
    const i = products.findIndex((x) => x.id === p.id);
    const copy = { ...p, id: newId(), name: `${p.name} (copy)` };
    onChange([...products.slice(0, i + 1), copy, ...products.slice(i + 1)]);
  };
  const remove = (p: Product) => {
    onChange(products.filter((x) => x.id !== p.id));
    if (selected === p.id) setSelected(null);
  };

  const header = (key: SortKey, label: string, num = false) => {
    const active = sort?.key === key;
    return (
      <th scope="col" key={key} className={num ? 'num' : undefined} aria-sort={active ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          className="sort-btn"
          onClick={() => setSort(active ? (sort!.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 })}
        >
          {label}
          <span aria-hidden="true" className="sort-ind">
            {active ? (sort!.dir === 1 ? '▲' : '▼') : '⇅'}
          </span>
        </button>
      </th>
    );
  };

  const importCsv = async (file: File) => {
    try {
      const text = await file.text();
      const res = productsFromCsv(text, () => newId());
      if (res.products.length === 0) {
        setMessage(res.errors[0] ?? 'No products found in that file.');
        return;
      }
      onChange(replace ? res.products : [...products, ...res.products]);
      setMessage(
        `Imported ${res.products.length} product${res.products.length === 1 ? '' : 's'}.` + (res.errors.length ? ` ${res.errors.length} cell(s) could not be read: ${res.errors.slice(0, 3).join(' ')}` : ''),
      );
    } catch {
      setMessage('That file could not be read.');
    }
  };

  const sel = rows.find((x) => x.p.id === selected);
  const mOpts = marketOptions(model);

  return (
    <div className="stack">
      <section className="card" aria-labelledby="products-title">
        <div className="toolbar">
          <h2 id="products-title">Products</h2>
          <div className="toolbar-actions">
            <button type="button" className="btn primary" onClick={add}>
              Add product
            </button>
            <button type="button" className="btn" onClick={() => downloadText('mytruemargin-products.csv', productsToCsv(products, model), 'text/csv')}>
              Export CSV
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              Import CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose a CSV file to import"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importCsv(f);
                e.target.value = '';
              }}
            />
            <label className="inline-check">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace list on import
            </label>
          </div>
        </div>
        <div className="filter-row">
          <SelectField
            label="Filter by status"
            value={filter}
            onChange={setFilter}
            options={[{ value: 'ALL' as const, label: 'All statuses' }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_INFO[s].label }))]}
          />
          <p className="muted small">
            Showing {visible.length} of {products.length}. Select a row (or its Breakdown button) to see its profit walk.
          </p>
        </div>
        <p role="status" className="small">
          {message}
        </p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Product table, scrolls sideways">
          <table className="data products">
            <thead>
              <tr>
                {header('name', 'Name')}
                {header('market', 'Market')}
                {NUM_COLS.map((col) => header(col.key, col.label, true))}
                {header('competitorUrl', 'URL')}
                {COMPUTED_COLS.map((col) => header(col.key, col.label, !['status', 'competitorPosition'].includes(col.key)))}
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ p, r }) => (
                <tr
                  key={p.id}
                  className={p.id === selected ? 'row-selected' : undefined}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input,select,button,a')) return;
                    setSelected(p.id);
                  }}
                >
                  <td>
                    <TextField label={`Name of product ${p.name}`} hideLabel value={p.name} onChange={(v) => update(p.id, { name: v })} className="cell w-name" />
                  </td>
                  <td>
                    <SelectField label={`Market for ${p.name}`} hideLabel value={p.market ?? ''} onChange={(v) => update(p.id, { market: v || undefined })} options={mOpts} className="cell w-market" />
                  </td>
                  {NUM_COLS.map((col) => (
                    <td key={col.key}>
                      <NumberField label={`${col.label} for ${p.name}`} hideLabel nullable min={0} value={p[col.key]} onChange={(v) => update(p.id, { [col.key]: v })} className="cell w-num" />
                    </td>
                  ))}
                  <td>
                    <TextField label={`Competitor URL for ${p.name}`} hideLabel type="url" value={p.competitorUrl ?? ''} onChange={(v) => update(p.id, { competitorUrl: v || undefined })} className="cell w-url" />
                  </td>
                  <td className="num">{r.complete ? fmtMoney(r.priceToPublish, c) : 'n/a'}</td>
                  <td className="num">{r.complete ? fmtMoney(r.netProfit, c) : 'n/a'}</td>
                  <td className="num">{r.complete ? fmtPct(r.netMargin) : 'n/a'}</td>
                  <td className="num">{r.complete ? fmtMoney(r.netProfitWorst, c) : 'n/a'}</td>
                  <td>
                    <StatusBadge status={r.status} title={r.statusText} />
                  </td>
                  <td>{r.complete ? COMPETITOR_LABEL[r.competitorPosition] : 'n/a'}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn small" aria-pressed={p.id === selected} onClick={() => setSelected(p.id === selected ? null : p.id)}>
                        <span aria-hidden="true">Breakdown</span><span className="sr-only">{`Breakdown for ${p.name}`}</span>
                      </button>
                      <button type="button" className="btn small" onClick={() => duplicate(p)}>
                        <span aria-hidden="true">Duplicate</span><span className="sr-only">{`Duplicate ${p.name}`}</span>
                      </button>
                      <button type="button" className="btn small danger" onClick={() => remove(p)}>
                        <span aria-hidden="true">Delete</span><span className="sr-only">{`Delete ${p.name}`}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={17} className="muted">
                    {products.length === 0 ? 'No products yet. Add one or import a CSV file.' : 'No products match this filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {sel && (
        <section className="card" aria-labelledby="breakdown-title">
          <div className="toolbar">
            <h2 id="breakdown-title">Breakdown: {sel.p.name || 'Unnamed product'}</h2>
            <button type="button" className="btn small" onClick={() => setSelected(null)}>
              Close breakdown
            </button>
          </div>
          <StatusLine result={sel.r} />
          {sel.r.complete && (
            <div className="breakdown-grid">
              <ResultDetails model={model} result={sel.r} />
              <Waterfall result={sel.r} currency={c} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
