import * as R from './render.js';
import { decorate, sortList } from './model.js';
import { getPosition } from './geo.js';
import { fetchNearby, fetchSearch, fetchDetails } from './api.js';
import { mountMap, highlight, openDirections, panToUser } from './map.js';
import { load, save } from './storage.js';
import { DEFAULTS } from './config.js';

const root = document.getElementById('frame');

// ----- state (raw Places data; decoration happens at render time) -----
const persisted = load();
const state = {
  screen: persisted.onboarded ? 'home' : 'onboarding',
  onboarded: persisted.onboarded,
  sort: 'rating',
  query: '',
  location: persisted.location,
  favs: persisted.favs,            // array of place_id
  userCoords: null,                // {lat,lng} | null
  selected: null,                  // place_id for map
  nearby: { status: 'idle', raw: [], error: '' },
  results: { status: 'idle', raw: [], error: '' },
  saved: { status: 'idle', raw: [], error: '' },
};

let searchToken = 0;
let savedToken = 0;
let searchTimer = null;

function persist() {
  save({ onboarded: state.onboarded, favs: state.favs, location: state.location });
}

// ----- build a decorated "view" of state for the renderers -----
function view() {
  const coords = state.userCoords;
  const dec = (s) => decorate(s, state.favs, coords);
  const nearbyShops = sortList(state.nearby.raw.map(dec), state.sort);
  const resultShops = sortList(state.results.raw.map(dec), 'rating');
  const savedShops = state.saved.raw.map(dec);
  return {
    ...state,
    nearby: { ...state.nearby, shops: nearbyShops },
    results: { ...state.results, shops: resultShops },
    saved: { ...state.saved, shops: savedShops },
  };
}

function shopsById(vstate) {
  const m = {};
  vstate.nearby.shops.forEach(s => { m[s.id] = s; });
  return m;
}

// ----- render -----
function render() {
  const v = view();
  if (v.screen === 'onboarding') {
    root.innerHTML = R.onboarding();
    return;
  }
  const screenHtml = {
    home: R.home, search: R.search, map: R.map, favorites: R.favorites, profile: R.profile,
  }[v.screen](v);

  root.innerHTML = `
    <div style="position:absolute; inset:0; display:flex; flex-direction:column;">
      ${R.statusBar()}
      <div class="mc-scroll" style="flex:1; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative;">
        ${screenHtml}
      </div>
      ${R.bottomNav(v.screen)}
    </div>`;

  afterRender(v);
}

function afterRender(v) {
  if (v.screen === 'search') {
    const input = document.getElementById('mc-search-input');
    if (input) {
      input.addEventListener('input', onSearchInput);
      // keep caret at end when re-rendered with a value
      const val = input.value; input.value = ''; input.value = val;
    }
  }
  if (v.screen === 'map') {
    mountMap({
      center: v.userCoords || DEFAULTS.fallback,
      shops: v.nearby.shops,
      selectedId: v.selected,
      onSelect: selectPin,
    });
  }
}

// ----- data loaders -----
async function loadNearby() {
  if (!state.userCoords) { state.nearby = { status: 'error', raw: [], error: 'Location not set. Search a place instead.' }; render(); return; }
  state.nearby = { status: 'loading', raw: [], error: '' };
  render();
  try {
    const data = await fetchNearby(state.userCoords.lat, state.userCoords.lng);
    const raw = data.shops || [];
    state.nearby = { status: 'ready', raw, error: '' };
    if (!state.selected && raw.length) state.selected = raw[0].id;
  } catch (e) {
    state.nearby = { status: 'error', raw: [], error: friendly(e) };
  }
  render();
}

function onSearchInput(e) {
  state.query = e.target.value;
  const clear = document.getElementById('mc-clear');
  if (clear) clear.style.display = state.query ? 'flex' : 'none';
  // live update only the body region (keeps input focus)
  const body = document.getElementById('mc-search-body');
  const q = state.query.trim();
  if (!q) {
    state.results = { status: 'idle', raw: [], error: '' };
    if (body) body.innerHTML = R.searchBody(view());
    return;
  }
  state.results = { status: 'loading', raw: [], error: '' };
  if (body) body.innerHTML = R.searchBody(view());
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 350);
}

async function runSearch() {
  const q = state.query.trim();
  if (!q) return;
  const token = ++searchToken;
  const center = state.userCoords || DEFAULTS.fallback;
  try {
    const data = await fetchSearch(q, center.lat, center.lng);
    if (token !== searchToken) return; // stale
    state.results = { status: 'ready', raw: data.shops || [], error: '' };
  } catch (e) {
    if (token !== searchToken) return;
    state.results = { status: 'error', raw: [], error: friendly(e) };
  }
  const body = document.getElementById('mc-search-body');
  if (body && state.screen === 'search') body.innerHTML = R.searchBody(view());
}

async function loadSaved() {
  const ids = state.favs;
  if (!ids.length) { state.saved = { status: 'ready', raw: [], error: '' }; render(); return; }
  const token = ++savedToken;
  state.saved = { status: 'loading', raw: [], error: '' };
  render();
  try {
    const settled = await Promise.allSettled(ids.map(id => fetchDetails(id)));
    if (token !== savedToken) return;
    const raw = settled
      .filter(r => r.status === 'fulfilled' && r.value && r.value.shop)
      .map(r => r.value.shop);
    state.saved = { status: 'ready', raw, error: '' };
  } catch (e) {
    if (token !== savedToken) return;
    state.saved = { status: 'error', raw: [], error: friendly(e) };
  }
  render();
}

// ----- interactions -----
function go(screen) {
  state.screen = screen;
  render();
  if (screen === 'home' && state.nearby.status === 'idle') loadNearby();
  if (screen === 'map' && state.nearby.status === 'idle') loadNearby();
  if (screen === 'favorites') loadSaved();
}

async function useLocation() {
  state.onboarded = true;
  persist();
  state.screen = 'home';
  state.nearby = { status: 'loading', raw: [], error: '' };
  render();
  try {
    const coords = await getPosition();
    state.userCoords = coords;
    state.location = 'Near me';
    persist();
    await loadNearby();
  } catch (e) {
    state.nearby = {
      status: 'error', raw: [],
      error: e.message === 'GEO_DENIED'
        ? 'Location is off. Turn it on, or use Search to look up a place.'
        : 'Could not get your location. Try Search instead.',
    };
    render();
  }
}

function maybeLater() {
  state.onboarded = true;
  persist();
  state.screen = 'home';
  state.nearby = { status: 'error', raw: [], error: 'Turn on location, or use Search to find shops.' };
  render();
}

function toggleFav(id) {
  const has = state.favs.includes(id);
  state.favs = has ? state.favs.filter(f => f !== id) : [...state.favs, id];
  persist();

  if (state.screen === 'map') {
    // update only the card + marker styles, keep the map intact
    const v = view();
    const card = document.getElementById('mc-map-card');
    if (card) card.innerHTML = R.mapCard(v);
    return;
  }
  if (state.screen === 'favorites') {
    // drop it from the saved list live (no need to refetch)
    state.saved.raw = state.saved.raw.filter(s => s.id !== id);
    render();
    return;
  }
  render();
}

function selectPin(id) {
  state.selected = id;
  const v = view();
  const card = document.getElementById('mc-map-card');
  if (card) card.innerHTML = R.mapCard(v);
  highlight(id, shopsById(v));
}

function setSort(sort) {
  state.sort = sort;
  render();
}

function directions(id) {
  const v = view();
  const shop = v.nearby.shops.find(s => s.id === id) || v.saved.shops.find(s => s.id === id);
  openDirections(shop);
}

async function mapLocateMe() {
  try {
    const coords = await getPosition({ fresh: true });
    state.userCoords = coords;
    state.location = 'Near me';
    persist();
    const ok = await panToUser(coords);
    if (!ok && state.screen === 'map') render();
  } catch (e) {
    if (state.userCoords && state.screen === 'map') {
      await panToUser(state.userCoords);
      return;
    }
    const msg = e.message === 'GEO_DENIED'
      ? 'Location is off. Allow it in your browser settings.'
      : 'Could not get your location right now.';
    alert(msg);
  }
}

function clearQuery() {
  state.query = '';
  state.results = { status: 'idle', raw: [], error: '' };
  render();
  const input = document.getElementById('mc-search-input');
  if (input) input.focus();
}

// ----- event delegation -----
root.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.getAttribute('data-act');
  const id = btn.getAttribute('data-id');
  switch (act) {
    case 'use-location': useLocation(); break;
    case 'maybe-later': maybeLater(); break;
    case 'go-home': go('home'); break;
    case 'go-search': go('search'); break;
    case 'go-map': go('map'); break;
    case 'go-fav': go('favorites'); break;
    case 'go-profile': go('profile'); break;
    case 'set-sort': setSort(btn.getAttribute('data-sort')); break;
    case 'toggle-fav': toggleFav(id); break;
    case 'select-pin': selectPin(id); break;
    case 'directions': directions(id); break;
    case 'map-locate-me': mapLocateMe(); break;
    case 'clear-query': clearQuery(); break;
    case 'retry-nearby': loadNearby(); break;
    case 'retry-search': runSearch(); break;
    case 'retry-saved': loadSaved(); break;
  }
});

function friendly(e) {
  const m = (e && e.message) || '';
  if (m.includes('NO_MAPS_KEY')) return 'Add your Google key (VITE_MAPS_BROWSER_KEY) to load shops.';
  if (m.includes('MAPS_SDK_FAILED')) return 'Google could not load. Check the key restrictions for this site.';
  if (/denied|not authorized|ApiNotActivated|REQUEST_DENIED/i.test(m)) return 'Google rejected the request. Enable "Places API (New)" on your key.';
  return 'Something went wrong reaching Google. Try again shortly.';
}

// ----- boot -----
render();
if (state.onboarded) loadNearby();
