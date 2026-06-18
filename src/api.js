import { loadSdk } from './map.js';

// Nearby/search/details run in the browser via the Places library (New).
// No proxy server. Each function returns the same shape the rest of the app
// expects: { shops: [...] } or { shop: {...} }, where a shop is
// { id, name, rating, reviews, open, lat, lng, types, priceLevel, photoName }.

const FIELDS = [
  'id', 'displayName', 'location', 'rating', 'userRatingCount',
  'types', 'priceLevel', 'regularOpeningHours',
];

async function places() {
  const google = await loadSdk();
  return google.maps.importLibrary('places');
}

async function mapPlace(p) {
  let open = null;
  try {
    if (typeof p.isOpen === 'function') {
      const r = await p.isOpen();
      if (typeof r === 'boolean') open = r;
    }
  } catch (e) { /* hours not available -> leave null */ }
  return {
    id: p.id,
    name: p.displayName || '',
    rating: p.rating != null ? p.rating : null,
    reviews: p.userRatingCount != null ? p.userRatingCount : 0,
    open,
    lat: p.location ? p.location.lat() : null,
    lng: p.location ? p.location.lng() : null,
    types: p.types || [],
    priceLevel: p.priceLevel != null ? p.priceLevel : null,
    photoName: null,
  };
}

export async function fetchNearby(lat, lng) {
  const { Place, SearchNearbyRankPreference } = await places();
  const { places: results } = await Place.searchNearby({
    fields: FIELDS,
    locationRestriction: { center: { lat, lng }, radius: 2500 },
    includedTypes: ['coffee_shop', 'cafe'],
    maxResultCount: 20,
    rankPreference: SearchNearbyRankPreference.POPULARITY,
  });
  const shops = await Promise.all((results || []).map(mapPlace));
  return { shops };
}

export async function fetchSearch(q, lat, lng) {
  const query = q.toLowerCase().includes('coffee') ? q : q + ' coffee';
  const { Place } = await places();
  const req = { textQuery: query, fields: FIELDS, maxResultCount: 20 };
  if (lat != null && lng != null) {
    req.locationBias = { center: { lat, lng }, radius: 6000 };
  }
  const { places: results } = await Place.searchByText(req);
  const shops = await Promise.all((results || []).map(mapPlace));
  return { shops };
}

export async function fetchDetails(id) {
  const { Place } = await places();
  const p = new Place({ id });
  await p.fetchFields({ fields: FIELDS });
  return { shop: await mapPlace(p) };
}

// Photos are off by default (swatches are the design's fallback). If you turn
// them on later, request the 'photos' field above and use photo.getURI().
export function photoUrl() { return null; }
