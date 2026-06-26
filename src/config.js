// One Google key loads the Places library for nearby/search/details in the
// browser (no proxy server).
//
// Set it in .env.local as VITE_MAPS_BROWSER_KEY (see .env.example).
// Lock the key to your website (HTTP referrer) so only your app can use it,
// and enable "Places API (New)" on it.

export const MAPS_BROWSER_KEY = import.meta.env.VITE_MAPS_BROWSER_KEY || '';

export const DEFAULTS = {
  // Used only if the user denies location and has not searched a place yet.
  fallback: { lat: 37.7793, lng: -122.4193, label: 'San Francisco' },
  searchRadiusMeters: 2500,
};
