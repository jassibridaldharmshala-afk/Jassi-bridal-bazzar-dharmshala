import { findLocationByPincode } from '../data/indiaLocations';

const cache = new Map();

export async function lookupPincode(pincode) {
  const pin = String(pincode || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(pin)) return null;
  if (cache.has(pin)) return cache.get(pin);

  const local = findLocationByPincode(pin);
  if (local) {
    cache.set(pin, local);
    return local;
  }

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const payload = await response.json();
    const office = payload?.[0]?.Status === 'Success' ? payload[0].PostOffice?.[0] : null;
    if (office?.State && office?.District) {
      const match = {
        state: office.State,
        district: office.District,
        city: office.District,
        pincode: pin,
      };
      cache.set(pin, match);
      return match;
    }
  } catch {
    // Offline or the postal lookup is unavailable; the form stays editable.
  }

  cache.set(pin, null);
  return null;
}
