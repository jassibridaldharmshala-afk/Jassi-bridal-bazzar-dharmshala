import { useEffect, useState } from 'react';
import api from '../../services/api';
import { rentalMoney, rentalUrl } from '../../utils/rentals';
export default function RentalFaq({ storeSlug }) {
  const [config, setConfig] = useState(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => { let alive = true; setConfig(null); setError('');
    api.get(rentalUrl('/rentals/configuration', storeSlug), { silent: true }).then(value => { if (alive) setConfig(value); }).catch(err => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [storeSlug, attempt]);
  if (error) return <section className="rental-card"><h2>Rental policies</h2><p role="status">Rental policies could not be loaded.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry policies</button></section>;
  if (!config?.policy || !['SALE_AND_RENTAL', 'RENTAL_ONLY'].includes(config.mode)) return null;
  const p = config.policy;
  const facts = [
    { question: 'When are dates confirmed?', answer: `A reservation hold lasts ${p.holdMinutes} minutes. Confirmation requires a verified advance under the shop policy; quotes and dates are checked again when you reserve.` },
    { question: 'How are rent and refundable security collected?', answer: `Rent and security are shown separately for each selected offer. Security is due ${p.depositTiming === 'PICKUP' ? 'at pickup' : 'with the booking advance'}. The remaining agreed charges must be paid before handover.` },
    { question: 'What happens after return?', answer: `The shop inspects every component and records any approved deduction separately. Deposit settlement is tracked in My rentals. The configured refund target is ${p.refundSlaHours} hours; confirm the payment method and processing timeline with the shop.` },
    { question: 'How do late returns work?', answer: `The configured grace period is ${p.graceHours} hours. The proposed late fee is ${rentalMoney(p.lateFeePerDayPaise)} per started day. Any deduction must be itemised and reviewed by staff.` },
  ];
  return <section className="rental-card" aria-label="Rental FAQs and shop policy"><h2>Rental FAQs & shop policy</h2><p>These details come from the shop’s current rental settings. Your final quote keeps the accepted terms and prices.</p>{[...facts, ...(p.faqs || [])].map((row, index) => <details key={index} className="p-3"><summary className="cursor-pointer font-bold">{row.question}</summary><p className="whitespace-pre-wrap">{row.answer}</p></details>)}
    <details className="p-3"><summary className="cursor-pointer font-bold">Cancellation rules</summary>{p.cancellationRules.map((rule, index) => <p key={index}>At least {rule.beforeHours} hours before pickup: retain up to {rule.retainPercent}% of rental charges, capped at rent paid. Refundable security is settled separately.</p>)}</details>
    <details className="p-3"><summary className="cursor-pointer font-bold">Complete shop agreement</summary><p className="whitespace-pre-wrap">{p.terms}</p></details><p>For fittings, alterations, damage, cleaning and included pieces, review the selected offer and confirm any missing details with the shop before reserving.</p>
  </section>;
}

