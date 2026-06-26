import { loadSdk } from './map.js';

// Nearby/search/details run in the browser via the Places library (New).
// No proxy server. Each function returns the same shape the rest of the app
// expects: { shops: [...] } or { shop: {...} }, where a shop is
// { id, name, rating, reviews, open, lat, lng, types, priceLevel, photoName }.

const FIELDS = [
  'id', 'displayName', 'location', 'rating', 'userRatingCount',
  'types', 'priceLevel', 'regularOpeningHours', 'photos',
];

// Detail view asks for a few extra fields. These are only requested when a
// single place is opened, never for list views (keeps list calls lean).
const DETAIL_FIELDS = FIELDS.concat([
  'editorialSummary', 'formattedAddress', 'websiteURI', 'nationalPhoneNumber',
]);

async function places() {
  const google = await loadSdk();
  return google.maps.importLibrary('places');
}

// editorialSummary may come back as a plain string or as an object with an
// overview/text property depending on the SDK build. Read it defensively.
function editorialText(p) {
  try {
    const e = p.editorialSummary;
    if (!e) return null;
    if (typeof e === 'string') return e;
    return e.overview || e.text || null;
  } catch (e) { return null; }
}

// Build a live, displayable URL for the first place photo via the Places (New)
// SDK Photo.getURI(). We never persist or cache this URL anywhere (no
// localStorage, no SW); it is fetched live and rendered into the DOM for the
// current session only. Returns null when no photo is available.
function firstPhotoUrl(p) {
  try {
    const photo = p.photos && p.photos[0];
    if (!photo || typeof photo.getURI !== 'function') return null;
    return photo.getURI({ maxWidth: 800, maxHeight: 600 }) || null;
  } catch (e) { return null; }
}

async function mapPlace(p) {
  let open = null;
  try {
    if (typeof p.isOpen === 'function') {
      const r = await p.isOpen();
      if (typeof r === 'boolean') open = r;
    }
  } catch (e) { /* hours not available -> leave null */ }
  let hours = null;
  try {
    if (p.regularOpeningHours && Array.isArray(p.regularOpeningHours.weekdayDescriptions)) {
      hours = p.regularOpeningHours.weekdayDescriptions;
    }
  } catch (e) { /* no hours -> leave null */ }
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
    // Live photo URL (session-only, never persisted/cached). Null when absent.
    photoUrl: firstPhotoUrl(p),
    // Detail-only fields. Null on list results (not requested there).
    editorial: editorialText(p),
    address: p.formattedAddress || null,
    website: p.websiteURI || null,
    phone: p.nationalPhoneNumber || null,
    hours,
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
  await p.fetchFields({ fields: DETAIL_FIELDS });
  return { shop: await mapPlace(p) };
}

// Live Place photos are requested via the 'photos' field and resolved per
// shop in mapPlace() -> photoUrl. The colored swatch (tone) remains the
// fallback whenever a place has no photo.
export function photoUrl() { return null; }
