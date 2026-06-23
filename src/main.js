import * as R from './render.js';
import { decorate, sortList } from './model.js';
import { getPosition } from './geo.js';
import { fetchNearby, fetchSearch, fetchDetails } from './api.js';
import { mountMap, updateShops, highlight, openDirections, panToUser } from './map.js';
import { load, save } from './storage.js';
import { DEFAULTS } from './config.js';

const root = document.getElementById('frame');

// ----- state (raw Places data; decoration happens at render time) -----
const persisted = load();
const state = {
  screen: persisted.onboarded ? 'home' : 'onboarding',
  onboarded: persisted.onboarded,
  discoverView: 'list',            // 'list' | 'map' on the Discover tab
  sort: 'rating',
  query: '',
  location: persisted.location,
  favs: persisted.favs,            // array of place_id
  userCoords: null,                // {lat,lng} | null
  selected: null,                  // place_id for map pin selection
  detailId: null,                  // place_id for the open detail view
  nearby: { status: 'idle', raw: [], error: '' },
  results: { status: 'idle', raw: [], error: '' },
  saved: { status: 'idle', raw: [], error: '' },
  detail: { status: 'idle', raw: null, error: '' },
};

let searchToken = 0;
let savedToken = 0;
let detailToken = 0;
let searchTimer = null;

function persist() {
  save({ onboarded: state.onboarded, favs: state.favs, location: state.location });
}

function isDiscoverMap() {
  return state.screen === 'home' && state.discoverView === 'map' && !state.query.trim();
}

// ----- build a decorated "view" of state for the renderers -----
function view() {
  const coords = state.userCoords;
  const dec = (s) => decorate(s, state.favs, coords);
  const nearbyShops = sortList(state.nearby.raw.map(dec), state.sort);
  // Search results are ordered by most-reviewed shops in the searched area.
  const resultShops = sortList(state.results.raw.map(dec), 'popular');
  const savedShops = state.saved.raw.map(dec);
  const detailShop = state.detail.raw ? dec(state.detail.raw) : null;
  return {
    ...state,
    nearby: { ...state.nearby, shops: nearbyShops },
    results: { ...state.results, shops: resultShops },
    saved: { ...state.saved, shops: savedShops },
    detail: { ...state.detail, shop: detailShop },
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
    home: R.home, favorites: R.favorites, profile: R.profile,
    detail: R.detail,
  }[v.screen](v);

  // Detail is a sub-screen of the combined Discover/Search tab; keep Discover
  // lit in the bottom nav.
  const navScreen = v.screen === 'detail' ? 'home' : v.screen;
  root.innerHTML = `
    <div style="position:absolute; inset:0; display:flex; flex-direction:column;">
      ${R.statusBar()}
      <div class="mc-scroll" style="flex:1; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative;">
        ${screenHtml}
      </div>
      ${R.bottomNav(navScreen)}
    </div>`;

  afterRender(v);
}

function afterRender(v) {
  if (v.screen === 'home' && v.discoverView === 'list') {
    const input = document.getElementById('mc-search-input');
    if (input) {
      input.addEventListener('input', onSearchInput);
      // keep caret at end when re-rendered with a value
      const val = input.value; input.value = ''; input.value = val;
    }
  }
  if (isDiscoverMap()) {
    mountMap({
      center: v.userCoords || DEFAULTS.fallback,
      shops: v.nearby.shops,
      selectedId: v.selected,
      onSelect: selectPin,
    });
  }
  if (v.screen === 'detail') setupDetailSwipe();
}

// iOS-style swipe right on the detail screen to return to Discover.
function setupDetailSwipe() {
  const panel = document.getElementById('mc-detail-panel');
  if (!panel || panel.__mcSwipe) return;
  panel.__mcSwipe = true;

  let startX = 0;
  let startY = 0;
  let tracking = false;

  panel.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
    panel.style.transition = '';
    panel.style.transform = '';
  }, { passive: true });

  panel.addEventListener('touchmove', (e) => {
    if (!tracking || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (dx < 8 || Math.abs(dy) > Math.abs(dx) * 0.85) return;
    panel.style.transform = `translateX(${Math.min(dx, 120)}px)`;
  }, { passive: true });

  panel.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (dx > 70 && Math.abs(dy) < Math.abs(dx) * 0.85) {
      panel.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
      panel.style.transform = 'translateX(100%)';
      panel.style.opacity = '0.55';
      setTimeout(() => {
        if (state.screen === 'detail') closeDetail();
      }, 160);
      return;
    }
    panel.style.transition = 'transform 0.18s ease';
    panel.style.transform = '';
  }, { passive: true });
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
  const q = state.query.trim();
  if (q) state.discoverView = 'list';
  // live update only the body region (keeps input focus)
  const body = document.getElementById('mc-search-body');
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
  if (body && state.screen === 'home') body.innerHTML = R.searchBody(view());
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
  if (screen !== 'home') state.discoverView = 'list';
  render();
  if (screen === 'home' && state.nearby.status === 'idle') loadNearby();
  if (screen === 'favorites') loadSaved();
}

function setDiscoverView(view) {
  if (view !== 'list' && view !== 'map') return;
  state.discoverView = view;
  render();
  if (view === 'map' && state.nearby.status === 'idle') loadNearby();
}

async function useLocation() {
  state.onboarded = true;
  persist();
  state.screen = 'home';
  state.discoverView = 'list';
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
  state.discoverView = 'list';
  state.nearby = { status: 'error', raw: [], error: 'Turn on location, or use Search to find shops.' };
  render();
}

function toggleFav(id) {
  const has = state.favs.includes(id);
  state.favs = has ? state.favs.filter(f => f !== id) : [...state.favs, id];
  persist();

  if (isDiscoverMap()) {
    // update only the card + marker styles, keep the map intact
    const v = view();
    const card = document.getElementById('mc-map-card');
    if (card) card.innerHTML = R.mapCard(v);
    highlight(id, shopsById(v));
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
  const shop = v.nearby.shops.find(s => s.id === id)
    || v.results.shops.find(s => s.id === id)
    || v.saved.shops.find(s => s.id === id)
    || (v.detail.shop && v.detail.shop.id === id ? v.detail.shop : null);
  openDirections(shop);
}

// ----- shop detail (opened from Search) -----
async function openDetail(id) {
  if (!id) return;
  state.detailId = id;
  state.detail = { status: 'loading', raw: null, error: '' };
  state.screen = 'detail';
  render();
  const token = ++detailToken;
  try {
    const data = await fetchDetails(id);
    if (token !== detailToken) return;
    state.detail = { status: 'ready', raw: data.shop, error: '' };
  } catch (e) {
    if (token !== detailToken) return;
    state.detail = { status: 'error', raw: null, error: friendly(e) };
  }
  if (state.screen === 'detail') render();
}

function closeDetail() {
  state.screen = 'home';
  state.detail = { status: 'idle', raw: null, error: '' };
  render();
}

function retryDetail() {
  if (state.detailId) openDetail(state.detailId);
}

async function mapLocateMe() {
  try {
    const coords = await getPosition({ fresh: true });
    state.userCoords = coords;
    state.location = 'Near me';
    persist();
    const ok = await panToUser(coords);
    if (!ok && isDiscoverMap()) render();
  } catch (e) {
    if (state.userCoords && isDiscoverMap()) {
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
    case 'go-search': go('home'); break;
    case 'go-fav': go('favorites'); break;
    case 'go-profile': go('profile'); break;
    case 'set-sort': setSort(btn.getAttribute('data-sort')); break;
    case 'set-discover-view': setDiscoverView(btn.getAttribute('data-view')); break;
    case 'toggle-fav': toggleFav(id); break;
    case 'select-pin': selectPin(id); break;
    case 'directions': directions(id); break;
    case 'map-locate-me': mapLocateMe(); break;
    case 'clear-query': clearQuery(); break;
    case 'open-detail': openDetail(id); break;
    case 'close-detail': closeDetail(); break;
    case 'retry-nearby': loadNearby(); break;
    case 'retry-search': runSearch(); break;
    case 'retry-saved': loadSaved(); break;
    case 'retry-detail': retryDetail(); break;
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
// userCoords is never persisted, so an already-onboarded user always boots
// without coordinates. Auto-request location once (the browser shows its
// native prompt only if undecided; if previously denied it fails quietly and
// useLocation() leaves a manual "Use my location" CTA on the Discover screen).
// This runs a single time on boot, so it cannot loop.
render();
if (state.onboarded) {
  if (state.userCoords) loadNearby();
  else useLocation();
}
