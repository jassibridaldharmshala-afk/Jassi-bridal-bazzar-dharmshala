import { useState } from 'react';

export default function RentalOrderDisclosure({ title, children, initiallyOpen = false }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <details className="rental-order-disclosure" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{title}</summary>
    {open && <div>{children}</div>}
  </details>;
}
