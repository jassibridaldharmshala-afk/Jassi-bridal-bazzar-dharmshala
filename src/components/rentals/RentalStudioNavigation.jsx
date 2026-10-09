import { useState } from 'react';

const daily = [
  ['bookings', 'Daily work', 'Pickups, returns and payments', 'orders.read'],
  ['counter', 'New booking', 'Book for a customer in store', 'orders.write'],
  ['calendar', 'Calendar', 'See booked dates and cleaning time', 'inventory.read'],
  ['pieces', 'Physical pieces', 'Find each item by its unique code', 'inventory.read'],
];
const tools = [
  ['setup', 'Rental setup', 'Add prices, register pieces and activate an offer', 'inventory.read'],
  ['readiness', 'Needs setup', 'Find products with missing rental details', 'inventory.read'],
  ['listings', 'Packages & offers', 'Manage sets, components and duration packages', 'inventory.write'],
  ['studio', 'Workshop & settlement', 'Repairs, cleaning, refunds and piece reports', null],
  ['reports', 'Rental reports', 'Review rental income, collections and refunds', 'reports.read'],
  ['notifications', 'Reminder history', 'Check sent reminders and delivery issues', 'configure'],
  ['settings', 'Policies & settings', 'Set shop mode, time slots, payments and return rules', 'configure'],
];
const icons = {
  bookings: 'M4 5h16v15H4z M8 2v6 M16 2v6 M4 10h16 M8 14h3 M8 17h7',
  counter: 'M12 4v16 M4 12h16', calendar: 'M4 5h16v15H4z M8 2v6 M16 2v6 M4 10h16 M8 14h1 M12 14h1 M16 14h1',
  pieces: 'm12 3 9 5-9 5-9-5 9-5 M3 8v9l9 5 9-5V8 M12 13v9',
  more: 'M4 6h16 M4 12h16 M4 18h16',
};
function Icon({ name }) { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name] || icons.more} /></svg>; }
export default function RentalStudioNavigation({ tab, onTab, permissions = {}, disabled, configuration, hasOffers, catalogueHref }) {
  const [more, setMore] = useState(false);
  const allowed = ([id, , , permission]) => id === 'studio' ? permissions['inventory.read'] !== false || (configuration.policy?.refundDashboardEnabled && permissions['returns.refund'] !== false) || (configuration.policy?.piecePerformanceEnabled && permissions['reports.read'] !== false && permissions['inventory.cost.read'] === true) : !permission || permissions[permission] !== false;
  const availableTools = tools.filter(allowed);
  const advanced = availableTools.some(([id]) => id === tab);
  const choose = id => { onTab(id); setMore(false); };
  return <>
    <header className="rental-studio-header">
      <div><span className="rental-eyebrow">YOUR RENTAL WORKSPACE</span><h1>Rental setup & stock</h1><p>Set up your rental products and keep each physical piece ready.</p></div>
      {permissions['inventory.read'] !== false && <button type="button" className="rental-button" disabled={disabled} onClick={() => choose('setup')}>+ Set up a rental product</button>}
    </header>
    <div className="rental-studio-orders-link"><p>For everyday bookings, payments, pickup and return:</p><a href={(catalogueHref.startsWith('/seller') ? '/seller/orders' : '/admin/orders') + '?' + new URLSearchParams({ type: 'rental', ...(new URLSearchParams(catalogueHref.split('?')[1] || '').get('storeId') ? { storeId: new URLSearchParams(catalogueHref.split('?')[1] || '').get('storeId') } : {}) })}>Open rental orders →</a></div>
    <nav className="rental-studio-nav" aria-label="Rental workspace" style={{ gridTemplateColumns: `repeat(${daily.filter(allowed).length + (availableTools.length ? 1 : 0)}, minmax(0, 1fr))` }}>
      {daily.filter(allowed).map(([id, title, description]) => <button type="button" key={id} title={description} aria-pressed={tab === id && !more} disabled={disabled} onClick={() => choose(id)}><Icon name={id} /><span>{title}</span></button>)}
      {availableTools.length > 0 && <button type="button" aria-expanded={more} aria-controls="rental-studio-tools" aria-pressed={more || advanced} disabled={disabled} onClick={() => setMore(value => !value)}><Icon name="more" /><span>More tools</span></button>}
    </nav>
    {more && <section id="rental-studio-tools" className="rental-card rental-tool-panel"><header><h2>Choose a rental tool</h2><p className="rental-muted">Manage everyday bookings in Orders → Rental. Open these tools for setup, stock or reports.</p></header><div className="rental-tool-grid">{availableTools.map(([id, title, description]) => <button type="button" key={id} aria-pressed={tab === id} disabled={disabled} onClick={() => choose(id)}><strong>{title}<span aria-hidden="true">↗</span></strong><span>{description}</span></button>)}</div></section>}
    {configuration.mode === 'SALE_ONLY' && <div className="rental-notice rental-studio-warning" role="status"><div><strong>Rental booking is switched off</strong><p>Enable sale + rental or rental mode in shop settings before opening bookings.</p></div>{permissions.configure !== false && <button type="button" className="rental-button rental-button--secondary" disabled={disabled} onClick={() => choose('settings')}>Open settings</button>}</div>}
    {permissions['inventory.read'] !== false && <details className="rental-card rental-get-started" open={!hasOffers && tab === 'bookings' ? true : undefined}>
      <summary><span><strong>How to set up rentals</strong><small>From your product to your first booking</small></span><span aria-hidden="true">⌄</span></summary>
      <ol>
        <li><span>1</span><div><strong>Publish the product</strong><p>Choose Rent or Sale + rent in Product Drafts. Add real photos and product details.</p><a href={catalogueHref}>Open product drafts →</a></div></li>
        <li><span>2</span><div><strong>Set prices & fitting</strong><p>Enter daily rent, refundable deposit and advance. Adjustable fitting needs no compulsory fixed size.</p></div></li>
        <li><span>3</span><div><strong>Register actual pieces</strong><p>Count the items you own. Give each one a unique code so bookings and returns can track it.</p></div></li>
        <li><span>4</span><div><strong>Review & activate</strong><p>Complete the setup checks, then activate. Booking dates are checked against real availability.</p></div></li>
      </ol>
      <div className="rental-guide-footer"><p>After booking: review payment → prepare → hand over → receive & inspect → settle deposit.</p><button type="button" className="rental-button rental-button--secondary" disabled={disabled} onClick={() => choose('setup')}>Start guided setup</button></div>
    </details>}
  </>;
}
