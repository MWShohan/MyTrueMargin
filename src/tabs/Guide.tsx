import { EXAMPLE_NOTICE } from '../engine';
import { StatusBadge } from '../components/StatusBadge';
import type { StatusCode } from '../engine';
import { STATUS_INFO, STATUS_ORDER } from '../lib/labels';

const CHECK_ORDER: StatusCode[] = [...STATUS_ORDER.filter((s) => s !== 'INCOMPLETE').reverse(), 'INCOMPLETE'];

const PRICE_LEVELS: { name: string; text: string }[] = [
  {
    name: 'Price to publish',
    text: 'The price you put on your shop. It is your price override if you entered one; otherwise the pricing rule price, raised to the minimum safe price if you turned that on in Settings.',
  },
  {
    name: 'Recommended price',
    text: 'The lowest price that meets your target net margin and your minimum profit per order, even if the customer pays with the most expensive payment method.',
  },
  {
    name: 'Minimum safe price',
    text: 'The lowest price that covers every cost and the contingency buffer with the most expensive payment method. Below this, some orders can lose money.',
  },
  {
    name: 'Break even price',
    text: 'The price at which you make exactly zero profit with your expected payment method, before the buffer. Anything lower is a loss on every order.',
  },
  {
    name: 'Pricing rule price',
    text: 'The price your markup tiers give from the product cost, before any override. Useful to compare your usual rule against the safe and recommended prices.',
  },
];

const TERMS: { term: string; text: string }[] = [
  { term: 'Net revenue', text: 'What you keep from the customer after discount, excluding any sales tax or VAT. Tax is collected for the government and is never counted as revenue.' },
  { term: 'Net profit and net margin', text: 'Profit after every cost: product, shipping, fees, refunds, taxes you pay, advertising, allocated fixed costs and the buffer. Margin is profit as a share of net revenue.' },
  { term: 'Worst case', text: 'The same calculation using the most expensive payment method available in the market, so you know the price holds up whatever the customer chooses.' },
  { term: 'Gross margin', text: 'Net revenue minus landed cost (product, supplier shipping, currency fee and duty), as a share of net revenue.' },
  { term: 'Contribution per order', text: 'Profit before allocated fixed cost and the buffer. It is what each order adds towards paying your monthly fixed costs.' },
  { term: 'Allocated fixed cost', text: 'Your monthly fixed costs divided by expected orders per month.' },
  { term: 'Break even ROAS', text: 'Return on ad spend (net revenue divided by ad cost) at which advertising uses up all of the profit. A lower number gives you more room.' },
  { term: 'ROAS for target and max ad cost', text: 'The return on ad spend you need, and the most you can spend on ads per order, while still hitting your target margin.' },
  { term: 'Payment fee base', text: 'Payment fees can be charged on the amount the customer pays including tax, or on net revenue. Choose the one that matches your provider in Settings.' },
];

export function Guide() {
  return (
    <div className="stack guide">
      <section className="card" aria-labelledby="g-intro">
        <h2 id="g-intro">How MyTrueMargin works</h2>
        <p>
          Enter what a product costs you and MyTrueMargin works out the price to publish and what you really keep after every cost, including advertising. Your target margin is measured{' '}
          <strong>after advertising and all costs</strong>, not before.
        </p>
        <p className="notice" role="note">
          <strong>Check the starting rates.</strong> {EXAMPLE_NOTICE} Your data is stored only in this browser.
        </p>
      </section>
      <section className="card" aria-labelledby="g-prices">
        <h2 id="g-prices">Price levels</h2>
        <dl className="glossary">
          {PRICE_LEVELS.map((p) => (
            <div key={p.name}>
              <dt>{p.name}</dt>
              <dd>{p.text}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="card" aria-labelledby="g-status">
        <h2 id="g-status">Statuses</h2>
        <p className="muted small">Checked in this order; a product gets the first status that applies.</p>
        <dl className="glossary">
          {CHECK_ORDER.map((s) => (
              <div key={s}>
                <dt>
                  <StatusBadge status={s} />
                </dt>
                <dd>{STATUS_INFO[s].explain}</dd>
              </div>
            ))}
        </dl>
      </section>
      <section className="card" aria-labelledby="g-terms">
        <h2 id="g-terms">Definitions</h2>
        <dl className="glossary">
          {TERMS.map((t) => (
            <div key={t.term}>
              <dt>{t.term}</dt>
              <dd>{t.text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
