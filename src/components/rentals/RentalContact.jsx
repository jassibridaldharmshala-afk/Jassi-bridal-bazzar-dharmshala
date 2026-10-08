export default function RentalContact({ contact = {}, navigate, message }) {
  const phone = String(contact.phone || '').replace(/[^\d+]/g, '');
  const digits = String(contact.whatsapp || '').replace(/\D/g, '');
  const whatsapp = digits.length === 10 ? '91' + digits : digits;
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || '') ? contact.email : '';
  return <div className="rental-contact"><p className="rental-muted">{message || 'A request is not a reservation. The store must confirm availability and the payment arrangement.'}</p><div className="rental-actions">{phone && <a className="rental-button rental-button--secondary" href={`tel:${phone}`}>Call store</a>}{whatsapp && <a className="rental-button rental-button--secondary" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('I would like to request a rental. Please confirm the items, dates, availability and advance payment.')}`} target="_blank" rel="noopener noreferrer">Request rental on WhatsApp</a>}{email && <a className="rental-button rental-button--secondary" href={`mailto:${email}?subject=Rental%20request`}>Email rental request</a>}{navigate && <button type="button" className="rental-text-button" onClick={() => navigate('/contact')}>Contact store →</button>}</div></div>;
}
