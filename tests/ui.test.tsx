import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../src/App';
import { calculateProduct, defaultModel, summarise, exampleProducts } from '../src/engine';
import type { ProductResult } from '../src/engine';
import { fmtMoney } from '../src/lib/format';
import { defaultQuick, STORAGE_KEY } from '../src/lib/storage';

beforeEach(() => {
  window.localStorage.clear();
});

const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

describe('App', () => {
  it('renders every tab without errors', () => {
    render(<App />);
    for (const name of ['Products', 'Dashboard', 'Settings', 'Guide', 'Quick calculator']) {
      openTab(name);
      expect(screen.getByRole('tab', { name }).getAttribute('aria-selected')).toBe('true');
    }
  });

  it('quick calculator shows the engine values after changing the unit cost', () => {
    render(<App />);
    const input = screen.getByLabelText('Unit cost');
    fireEvent.change(input, { target: { value: '33.5' } });

    const model = defaultModel();
    const r = calculateProduct(model, { ...defaultQuick(), unitCost: 33.5 }) as ProductResult;
    expect(r.complete).toBe(true);
    expect(screen.getByTestId('price-to-publish').textContent).toContain(fmtMoney(r.priceToPublish, 'USD'));
    expect(screen.getByTestId('net-profit').textContent).toContain(fmtMoney(r.netProfit, 'USD'));
    expect(screen.getByTestId('worst-profit').textContent).toContain(fmtMoney(r.netProfitWorst, 'USD'));
    expect(screen.getByTestId('walk-check').textContent).toContain('They match.');
  });

  it('rejects negative costs with a visible message and keeps the last valid value', () => {
    render(<App />);
    const before = screen.getByTestId('price-to-publish').textContent;
    for (const label of ['Unit cost', 'Supplier shipping', 'Ad cost per order', 'Price override', 'Competitor price']) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      const original = input.value;
      fireEvent.change(input, { target: { value: '-5' } });
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByRole('alert').textContent).toBe('Cannot be negative');
      expect(screen.getByTestId('price-to-publish').textContent).toBe(before);
      fireEvent.change(input, { target: { value: original } });
      expect(input.getAttribute('aria-invalid')).toBeNull();
    }
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.quick.unitCost).not.toBe(-5);
  });

  it('adds the quick product to the product list', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Brand new lamp' } });
    fireEvent.change(screen.getByLabelText('Unit cost'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to product list' }));

    openTab('Products');
    const table = screen.getByRole('table');
    expect(within(table).getByDisplayValue('Brand new lamp')).toBeTruthy();
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(1 + exampleProducts().length + 1);

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.products.at(-1)).toMatchObject({ name: 'Brand new lamp', unitCost: 12 });
  });

  it('products table adds, duplicates and deletes rows', () => {
    render(<App />);
    openTab('Products');
    const count = () => within(screen.getByRole('table')).getAllByRole('row').length;
    const start = count();
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(count()).toBe(start + 1);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Example product A' }));
    expect(screen.getByDisplayValue('Example product A (copy)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Example product A (copy)' }));
    expect(screen.queryByDisplayValue('Example product A (copy)')).toBeNull();
  });

  it('dashboard counts match summarise()', () => {
    render(<App />);
    openTab('Dashboard');
    const s = summarise(defaultModel(), exampleProducts());
    expect(screen.getByTestId('count-VIABLE').textContent).toContain(String(s.byStatus.VIABLE));
    expect(screen.getByTestId('count-LOSS').textContent).toContain(String(s.byStatus.LOSS));
  });

  it('falls back to the examples when stored data is corrupt', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    render(<App />);
    openTab('Products');
    expect(screen.getByDisplayValue('Example product A')).toBeTruthy();
  });

  it('settings take percentages as % and store decimals', () => {
    render(<App />);
    openTab('Settings');
    fireEvent.change(screen.getByLabelText('Target net margin'), { target: { value: '25' } });
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.model.settings.targetMarginPct).toBeCloseTo(0.25, 10);
  });
});

describe('Theme', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  it('switches theme, remembers it, and returns to the device setting', () => {
    const { unmount } = render(<App />);
    const picker = screen.getByLabelText('Theme') as HTMLSelectElement;
    expect(picker.value).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

    fireEvent.change(picker, { target: { value: 'dark' } });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('mytruemargin:theme')).toBe('dark');

    unmount();
    render(<App />);
    expect((screen.getByLabelText('Theme') as HTMLSelectElement).value).toBe('dark');

    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'system' } });
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(window.localStorage.getItem('mytruemargin:theme')).toBeNull();
  });
});
