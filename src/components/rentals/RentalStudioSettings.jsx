import { RentalField } from './RentalUi';
export default function RentalStudioSettings({ policy, onChange }) {
  const flags = [
    ['measurementProfilesEnabled', 'Customer measurement profiles', 'Private, consented revisions with an explicit approval snapshot for each fitting.'],
    ['tailoringEnabled', 'Tailoring and alteration jobs', 'Assignment, deadlines, recorded costs and fitting approval. Unfinished work blocks handover.'],
    ['maintenanceTasksEnabled', 'Cleaning and repair task board', 'Track workshop work without automatically receiving returned stock.'],
    ['dateFirstEnabled', 'Date-first rental shopping', 'Show availability for chosen dates, shop slots and alternative dates/products.'],
    ['refundDashboardEnabled', 'Deposit refund deadline monitoring', 'Track eligible/pending refunds and alert owners when the deadline passes. No automatic deductions or refunds.'],
    ['piecePerformanceEnabled', 'Physical-piece performance reports', 'Rental frequency, recorded expenses, idle time and lifetime purchase recovery. Requires analytics and expense access.'],
    ['waitlistEnabled', 'Date-specific rental waitlist', 'Opt-in availability alerts only; normal price review and compulsory advance are still required.'],
  ];
  return <section className="rental-studio-settings"><h3>Optional boutique workflows</h3><p className="rental-muted">New workflows are off by default. Disabling a module stops new records, but existing work and bookings remain manageable. Trial availability safety is always enforced.</p>
    <div className="rental-studio-feature-grid">{flags.map(([key, label, note]) => <label key={key} className="rental-feature-switch"><input type="checkbox" checked={policy[key] === true} onChange={e => onChange(key, e.target.checked)} /><span><strong>{label}</strong><small>{note}</small></span></label>)}</div>
    <div className="rental-fields"><RentalField label="Default trial duration (minutes)" type="number" min="15" max="240" value={policy.trialMinutes ?? 60} onChange={v => onChange('trialMinutes', Number(v))} /><RentalField label="Trial reminder before appointment (hours)" type="number" min="1" max="168" value={policy.trialReminderHours ?? 24} onChange={v => onChange('trialReminderHours', Number(v))} /><RentalField label="Refund deadline after eligibility (hours)" type="number" min="1" max="720" value={policy.refundSlaHours ?? 72} onChange={v => onChange('refundSlaHours', Number(v))} /></div>
  </section>;
}
