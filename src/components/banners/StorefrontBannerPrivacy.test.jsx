import { render } from '@testing-library/react';
import { useBannerEngagement } from './StorefrontBannerSlot';
import { trafficAllowed, getTrafficContext, recordTrafficEvent, TRAFFIC_CHANGE_EVENT } from '../../utils/trafficTracker';
jest.mock('../../utils/trafficTracker', () => ({ trafficAllowed: jest.fn(), getTrafficContext: jest.fn(), recordTrafficEvent: jest.fn(), TRAFFIC_CHANGE_EVENT: 'store:traffic-privacy' }));
function Banner() { const ref = useBannerEngagement({ _id: 'banner-one' }); return <div ref={ref}>Offer</div>; }
test('visible banner waits for consent, then sends one impression without guest-cart identity', () => {
  const savedFetch = global.fetch; const savedObserver = global.IntersectionObserver;
  let visibility; const disconnect = jest.fn(); sessionStorage.clear();
  global.IntersectionObserver = class { constructor(callback) { visibility = callback; } observe() {} disconnect() { disconnect(); } };
  global.fetch = jest.fn().mockResolvedValue({}); trafficAllowed.mockReturnValue(false);
  getTrafficContext.mockReturnValue({ sessionId: 'anonymous-traffic-session', consent: true });
  const page = render(<Banner />);
  visibility([{ isIntersecting: true, intersectionRatio: 0.9 }]); expect(global.fetch).not.toHaveBeenCalled();
  trafficAllowed.mockReturnValue(true); window.dispatchEvent(new Event(TRAFFIC_CHANGE_EVENT));
  expect(global.fetch).toHaveBeenCalledTimes(1); const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body).toMatchObject({ consent: true, trafficHandled: true, sessionId: 'anonymous-traffic-session' });
  expect(recordTrafficEvent).toHaveBeenCalledWith('BANNER_IMPRESSION', expect.any(Object));
  window.dispatchEvent(new Event(TRAFFIC_CHANGE_EVENT)); expect(global.fetch).toHaveBeenCalledTimes(1);
  page.unmount(); global.fetch = savedFetch; global.IntersectionObserver = savedObserver;
});
