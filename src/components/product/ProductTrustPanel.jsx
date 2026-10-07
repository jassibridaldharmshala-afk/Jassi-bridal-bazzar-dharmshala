import { BadgeCheck, PackageOpen, ShieldCheck, CreditCard } from 'lucide-react';
import './ProductTrustPanel.css';

export default function ProductTrustPanel({ settings = {}, returnPolicy = '' }) {
  const storeName = String(settings.storeName || 'Jassi General Store').trim();
  const returnDays = Math.max(0, Number(settings.returnWindowDays || 0));
  const enabledPayments = [
    settings.upiEnabled === true ? 'UPI' : '',
    settings.cardPaymentEnabled === true ? 'cards' : '',
    settings.netBankingEnabled === true ? 'net banking' : '',
  ].filter(Boolean);
  const trustItems = [
    { title: 'Store product', subtitle: `Listed by ${storeName}`, icon: BadgeCheck },
    {
      title: 'Returns',
      subtitle: returnDays > 0 ? `${returnDays}-day return window` : returnPolicy ? 'Policy available below' : 'Eligibility shown at checkout',
      icon: PackageOpen,
    },
    {
      title: settings.codEnabled === true ? 'Pay on delivery' : settings.codEnabled === false ? 'Prepaid orders' : 'Payment options',
      subtitle: settings.codEnabled === true ? 'For eligible PIN codes' : settings.codEnabled === false ? 'COD is not enabled' : 'Check availability above',
      icon: CreditCard,
    },
    {
      title: 'Secure checkout',
      subtitle: enabledPayments.length ? enabledPayments.join(', ') : 'Available methods shown at checkout',
      icon: ShieldCheck,
    },
  ];

  return (
    <aside className="sc-trust sc-pdp__trust">
      <div className="sc-trust__card">
        {trustItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className={`sc-trust__item${index === trustItems.length - 1 ? ' sc-trust__item--last' : ''}`}>
              <span className="sc-trust__icon">
                <Icon size={18} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
