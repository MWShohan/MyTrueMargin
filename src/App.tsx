import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Model, Product } from './engine';
import { newId } from './lib/labels';
import { defaultData, downloadText, loadData, parseAppData, saveData, serialiseAppData } from './lib/storage';
import { Dashboard } from './tabs/Dashboard';
import { Guide } from './tabs/Guide';
import { Products } from './tabs/Products';
import { QuickCalculator } from './tabs/QuickCalculator';
import { SettingsTab } from './tabs/SettingsTab';

const TABS = [
  { id: 'quick', label: 'Quick calculator' },
  { id: 'products', label: 'Products' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'settings', label: 'Settings' },
  { id: 'guide', label: 'Guide' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function App() {
  const [initial] = useState(loadData);
  const [model, setModel] = useState<Model>(initial.model);
  const [products, setProducts] = useState<Product[]>(initial.products);
  const [quick, setQuick] = useState<Product>(initial.quick);
  const [tab, setTab] = useState<TabId>('quick');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    saveData({ model, products, quick });
  }, [model, products, quick]);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next >= 0) {
      e.preventDefault();
      setTab(TABS[next].id);
      tabRefs.current[TABS[next].id]?.focus();
    }
  };

  const reset = () => {
    if (typeof window.confirm === 'function') {
      try {
        if (!window.confirm('Replace your settings and products with the examples?')) return;
      } catch {
        /* confirm unavailable */
      }
    }
    const d = defaultData();
    setModel(d.model);
    setProducts(d.products);
    setQuick(d.quick);
    setMessage('Settings and products reset to the examples.');
  };

  const importJson = async (file: File) => {
    try {
      const data = parseAppData(await file.text());
      setModel(data.model);
      setProducts(data.products);
      setQuick(data.quick);
      setMessage(`Imported ${data.products.length} product${data.products.length === 1 ? '' : 's'} and settings.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'That file could not be imported.');
    }
  };

  const renameMarket = (oldName: string, newName: string, next: Model) => {
    setModel(next);
    const fix = (p: Product) => (p.market === oldName ? { ...p, market: newName || undefined } : p);
    setProducts((ps) => ps.map(fix));
    setQuick((q) => fix(q));
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28">
              <rect x="2" y="2" width="20" height="20" rx="6" className="logo-bg" />
              <path d="M7 15l3.5-4 3 2.5L17 9" className="logo-line" />
            </svg>
          </span>
          <div>
            <h1>MyTrueMargin</h1>
            <p className="tagline">See what you really keep on every order, after ads and every cost.</p>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn ghost" onClick={reset}>
            Reset to examples
          </button>
          <button type="button" className="btn ghost" onClick={() => downloadText('mytruemargin.json', serialiseAppData({ model, products, quick }), 'application/json')}>
            Export JSON
          </button>
          <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose a JSON file to import"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>
      <nav className="tabs-bar" aria-label="Sections">
        <div role="tablist" aria-label="Sections" className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className="tab"
              onClick={() => setTab(t.id)}
              onKeyDown={onTabKey}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      {message && (
        <div className="banner" role="status">
          <span>{message}</span>
          <button type="button" className="btn small ghost" onClick={() => setMessage('')}>
            Dismiss
          </button>
        </div>
      )}
      <main id="main" className="main" tabIndex={-1}>
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'quick' && (
            <QuickCalculator
              model={model}
              product={quick}
              onChange={setQuick}
              onAdd={(p) => setProducts((ps) => [...ps, { ...p, id: newId() }])}
            />
          )}
          {tab === 'products' && <Products model={model} products={products} onChange={setProducts} />}
          {tab === 'dashboard' && <Dashboard model={model} products={products} />}
          {tab === 'settings' && <SettingsTab model={model} onChange={setModel} onRenameMarket={renameMarket} />}
          {tab === 'guide' && <Guide />}
        </div>
      </main>
      <footer className="app-footer">
        <p>Your data stays in this browser. Rates shown are examples to verify with your providers and tax adviser.</p>
      </footer>
    </div>
  );
}
