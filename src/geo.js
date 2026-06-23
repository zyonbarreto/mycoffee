// Geolocation + distance utilities.

export function getPosition(opts = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('GEO_UNSUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        // 1 = permission denied, 2 = unavailable, 3 = timeout
        reject(new Error(err.code === 1 ? 'GEO_DENIED' : 'GEO_FAILED'));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: opts.fresh ? 0 : 60000,
      }
    );
  });
}

// Great-circle distance in miles.
export function haversineMiles(a, b) {
  if (!a || !b || b.lat == null || b.lng == null) return null;
  const R = 3958.8; // earth radius, miles
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function milesStr(mi) {
  if (mi == null) return '';
  return mi.toFixed(1) + ' mi';
}

function toRad(d) { return (d * Math.PI) / 180; }
