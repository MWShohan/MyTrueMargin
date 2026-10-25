# MyTrueMargin

MyTrueMargin is a product margin calculator for any business that sells physical products. Enter what a product costs you and it works out the price to publish, the minimum safe and break even prices, and the profit you really keep per order after advertising, payment fees, refunds, taxes you pay, allocated fixed costs and a contingency buffer. Nothing in it is tied to a particular company, platform or brand.

It runs entirely in the browser. There is no server and no account.

## Running it

```bash
npm install        # install dependencies
npm run dev        # start the dev server (Vite) on http://localhost:5173
npm test           # run all tests once (Vitest with jsdom)
npm run build      # type check (tsc -b) and build the static site into dist/
npm run preview    # serve the built site locally
```

Requires Node 20 or newer.

## What is in the app

| Tab | Purpose |
| --- | --- |
| Quick calculator | Price one product live: price to publish and its source, recommended, minimum safe and break even prices, net and worst case profit, gross margin, contribution, ROAS figures, competitor position, a profit walk waterfall with a sum check, and a sensitivity panel. |
| Products | Editable product list with computed columns, sort, status filter, add, duplicate and delete, CSV import and export, and a per product breakdown. |
| Dashboard | Portfolio summary from `summarise()`: counts by status, averages, fixed cost coverage and competitor summary. |
| Settings | Every setting, fixed costs, markets, payment methods and the pricing rule (tiers are checked with `checkTiers()`). Percentages are entered as % and stored as decimals. |
| Guide | Plain English explanation of each price level, status and term. |

Header buttons: Reset to examples, Export JSON and Import JSON (the whole model plus products).

## Project structure

```
index.html                 entry page
src/
  engine/                  calculation engine (pure TypeScript, no UI)
    types.ts               Model, Settings, Product and Result types
    calc.ts                calculateProduct and price solving
    portfolio.ts           summarise, sensitivity, checkTiers
    presets.ts             defaultModel, exampleProducts, EXAMPLE_NOTICE
  lib/
    format.ts              currency and percent formatting (Intl, en GB)
    csv.ts                 pure CSV parse and serialise for the product list
    storage.ts             localStorage load and save, JSON import and export
    labels.ts              status, competitor and price source labels
  components/              fields, status badge, waterfall, sensitivity, result details
  tabs/                    one component per tab
  App.tsx, main.tsx, styles.css
tests/
  workbook.test.ts         engine reconciliation against the reference workbook
  fixtures/                workbook fixtures (JSON)
  csv.test.ts              CSV unit tests and round trip
  ui.test.tsx              UI tests (React Testing Library)
scripts/
  extract_workbook_fixture.py
```

The UI never calculates margins itself. Every number shown comes from the engine functions `calculateProduct`, `summarise`, `sensitivity`, `checkTiers`, `totalMonthlyFixed` and `fixedCostPerOrder`. The UI only formats values and, for the waterfall, draws bars and shows a check that the profit walk lines add up to the engine's net profit.

## How the engine is reconciled with the reference workbook

The engine was built to match a reference pricing spreadsheet. To prove it still does:

1. `scripts/extract_workbook_fixture.py` reads a saved copy of the workbook (cached values, so it must have been saved by Excel) with `openpyxl` and writes a JSON fixture holding the model (settings, tiers, fixed costs, markets, payment methods), each product's inputs and the workbook's own results. Product names are replaced by neutral labels so no brand data enters the repository.

   ```bash
   python3 -I scripts/extract_workbook_fixture.py workbook.xlsx tests/fixtures/workbook.json
   ```

2. `tests/workbook.test.ts` loads every JSON file in `tests/fixtures/` and checks that `calculateProduct` reproduces the workbook's prices, profits, margins, ROAS figures, tier, worst payment method, status and status text, and that the fixed cost totals match. The `variant_*.json` fixtures cover edge cases such as other markup bases, rounding, tax inclusive markets and ties between payment methods.

## Limitations

* **Rates are examples.** Every fee, tax and duty rate in the starting data is an example to verify with your payment provider, platform and tax adviser. They change and differ by provider, country and account.
* **Data is stored in your browser only** (localStorage). Clearing site data or using another browser or device loses it. Use Export JSON to keep a backup and Import JSON to restore it.
* Figures are per order averages; they are estimates for pricing decisions, not accounting or tax advice.
* One store currency is used for display; supplier costs are converted with a single exchange rate.
