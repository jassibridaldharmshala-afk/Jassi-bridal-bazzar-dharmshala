import { useEffect, useState } from 'react';
import { useStorefront } from '../../context/StorefrontContext';
import { setTrafficConsent, trafficPrivacyStatus, TRAFFIC_CHANGE_EVENT } from '../../utils/trafficTracker';
import './TrafficPrivacyPolicy.css';

export default function TrafficPrivacyPolicy() {
  const { storeSlug } = useStorefront();
  const [status, setStatus] = useState(() => trafficPrivacyStatus(storeSlug));
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  useEffect(() => {
    const update = () => setStatus(trafficPrivacyStatus(storeSlug));
    update(); window.addEventListener(TRAFFIC_CHANGE_EVENT, update);
    return () => window.removeEventListener(TRAFFIC_CHANGE_EVENT, update);
  }, [storeSlug]);
  const choose = async (allow) => {
    setBusy(true); setNotice('');
    try {
      await setTrafficConsent(allow, !allow);
      setNotice(allow ? 'Visitor statistics enabled.' : 'Visitor statistics stopped. Any deletion request will finish in the background.');
    } finally { setBusy(false); }
  };
  return <section className="traffic-policy" aria-label="Visitor statistics">
    <h2>Visitor statistics</h2>
    <p>We use visitor statistics to understand website visits, pages viewed, device types and how people reach our store. These statistics do not record passwords, payment details or form contents.</p>
    {status?.enabled && <details>
      <summary>Manage visitor statistics</summary>
      {status.ga4Enabled && <p>Google Analytics is optional and runs only after you allow it here.</p>}
      {status.browserOptOut ? <p>Your browser’s privacy preference keeps visitor statistics off.</p> : <p>{status.preference === 'denied' || (status.consentRequired && status.preference !== 'granted') ? 'Visitor statistics are off for this browser.' : 'Visitor statistics are enabled for this browser.'}</p>}
      <div className="traffic-policy__actions">
        <button type="button" disabled={busy || status.browserOptOut} onClick={() => choose(true)}>Allow visitor statistics</button>
        <button type="button" disabled={busy} onClick={() => choose(false)}>Stop & delete my visitor statistics</button>
      </div>
      {notice && <p role="status">{notice}</p>}
    </details>}
  </section>;
}
