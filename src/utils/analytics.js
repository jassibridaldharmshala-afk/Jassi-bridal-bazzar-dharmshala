import { recordTrafficEvent } from './trafficTracker';
import { isWebsitePreview } from '../config/websiteDesigner';

export function trackEvent(name, extra = {}) {
  if (isWebsitePreview()) return;
  // Analytics must never open the customer-facing loader. Home section and
  // scroll events are background telemetry and can fire several times while
  // the customer browses an already-loaded page.
  recordTrafficEvent(name, extra);
}
