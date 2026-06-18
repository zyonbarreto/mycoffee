// Persistence model, kept compatible with the original design's `mycoffee_v1`.
//
// Compliance note: the ONLY Places value we are allowed to store is the
// place_id (Google exempts it from caching limits, can be kept indefinitely).
// We never persist name/rating/reviews. The Saved screen re-fetches live
// details for each saved place_id directly from Google.

const KEY = 'mycoffee_v1';

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      onboarded: !!s.onboarded,
      favs: Array.isArray(s.favs) ? s.favs : [],   // array of place_id strings
      location: s.location || 'Near me',
    };
  } catch (e) {
    return { onboarded: false, favs: [], location: 'Near me' };
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      onboarded: !!state.onboarded,
      favs: state.favs || [],
      location: state.location || 'Near me',
    }));
  } catch (e) { /* ignore quota / private-mode errors */ }
}
