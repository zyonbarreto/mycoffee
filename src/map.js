import { MAPS_BROWSER_KEY } from './config.js';

// Loads the Google Maps JS SDK once (places library) for browser-side Places
// lookups in api.js.

let loaderPromise = null;

export function loadSdk() {
  if (loaderPromise) return loaderPromise;
  if (!MAPS_BROWSER_KEY) {
    loaderPromise = Promise.reject(new Error('NO_MAPS_KEY'));
    return loaderPromise;
  }
  loaderPromise = new Promise((resolve, reject) => {
    const cb = '__mcMapsReady_' + Date.now();
    window[cb] = () => resolve(window.google);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_BROWSER_KEY)}&v=weekly&libraries=places&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error('MAPS_SDK_FAILED'));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

export function openDirections(shop) {
  if (!shop) return;
  const dest = shop.lat != null && shop.lng != null
    ? `${shop.lat},${shop.lng}` : encodeURIComponent(shop.name || '');
  const place = shop.id ? `&destination_place_id=${encodeURIComponent(shop.id)}` : '';
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}${place}`, '_blank');
}
