import { haversineMiles, milesStr } from './geo.js';

// api.js returns each shop already mapped to these field names:
//   { id, name, rating, reviews, open, lat, lng, types, priceLevel, photoName }
// Here we add the presentation fields the original `decorate()` produced.

const TONES = ['#8a6a4c', '#6f5036', '#a07e5e', '#7d5d44', '#967358', '#5e4632'];

// Deterministic swatch per shop so a given shop always gets the same color.
function toneFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

// Optional eyebrow derived from Google place types (specialty is not a Places
// field). Falls back to "Coffee". Drop entirely if you prefer.
const TYPE_LABEL = [
  ['coffee_shop', 'Coffee'],
  ['cafe', 'Café'],
  ['bakery', 'Bakery'],
  ['restaurant', 'Kitchen'],
  ['bar', 'Bar'],
];
function specialtyFor(types) {
  const t = types || [];
  for (const [key, label] of TYPE_LABEL) if (t.includes(key)) return label;
  return 'Coffee';
}

export function decorate(shop, favs, userCoords) {
  const fav = favs.includes(shop.id);
  const dist = userCoords ? haversineMiles(userCoords, { lat: shop.lat, lng: shop.lng }) : null;

  // Open status. If Google did not return open_now, show no label rather
  // than guessing. "Closes soon" is intentionally not inferred here.
  let openLabel = '';
  let openColor = '#A2937F';
  if (shop.open === true) { openLabel = 'Open'; openColor = '#5C7A4F'; }
  else if (shop.open === false) { openLabel = 'Closed'; openColor = '#A2937F'; }

  return Object.assign({}, shop, {
    tone: toneFor(shop.id),
    specialty: specialtyFor(shop.types),
    hood: shop.hood || '',
    ratingStr: shop.rating != null ? Number(shop.rating).toFixed(1) : '—',
    reviewsStr: String(shop.reviews || 0),
    distNum: dist,
    distStr: milesStr(dist),
    openLabel,
    openColor,
    fav,
    heartFill: fav ? '#2E2017' : 'none',
    heartStroke: fav ? '#2E2017' : '#B9A78F',
  });
}

export function sortList(list, sort) {
  const arr = list.slice();
  if (sort === 'rating') arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sort === 'popular') arr.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
  else arr.sort((a, b) => (a.distNum ?? 1e9) - (b.distNum ?? 1e9));
  return arr;
}
