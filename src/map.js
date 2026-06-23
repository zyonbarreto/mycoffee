import { MAPS_BROWSER_KEY } from './config.js';

// Loads the Google Maps JS SDK once (maps + marker + places libraries) and
// renders the real map with pins on the Map tab. The same loader is reused by
// api.js to run the nearby/search lookups in the browser.

let loaderPromise = null;
let mapInstance = null;
let markers = new Map(); // id -> { marker, el }
let userMarker = null;
let MarkerClass = null;        // AdvancedMarkerElement, cached after first import
let viewportCallback = null;   // onViewportChange(moved) handler (refreshed each mount)
let idleTimer = null;          // debounce timer for the map 'idle' event
let lastSearchedCenter = null; // center of the area most recently searched
let lastSearchedRadius = null; // radius (m) of that area, for zoom-change checks
let awaitingBaseline = false;  // set on (re)mount; first idle records the baseline

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
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_BROWSER_KEY)}&v=weekly&libraries=marker,places&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error('MAPS_SDK_FAILED'));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

function pillContent(shop, selected) {
  const el = document.createElement('div');
  el.style.cssText = `
    background:${selected ? '#2E2017' : '#F6F0E8'};
    color:${selected ? '#F6F0E8' : '#2E2017'};
    border:1.5px solid ${selected ? '#2E2017' : '#CDBBA1'};
    border-radius:14px 14px 14px 4px;
    padding:5px 9px; font-size:12px; font-weight:700;
    font-family:'Archivo',sans-serif;
    box-shadow:0 6px 14px -4px rgba(46,32,23,0.4);
    white-space:nowrap; transform:scale(${selected ? 1.16 : 1});
    transition:transform 0.18s ease; cursor:pointer;`;
  el.textContent = '★ ' + (shop.ratingStr || '—');
  return el;
}

// Approximate great-circle distance in meters (used to turn the visible map
// bounds into a center + radius for the nearby query).
function metersBetween(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Diff the marker set against `shops`, adding/removing/restyling in place.
// Does not move the map, so it is safe to call from the idle handler.
function renderMarkers(shops, selectedId, onSelect) {
  if (!mapInstance || !MarkerClass) return;
  const wanted = new Set(shops.map(s => s.id));
  for (const [id, rec] of markers) {
    if (!wanted.has(id)) { rec.marker.map = null; markers.delete(id); }
  }
  for (const shop of shops) {
    if (shop.lat == null || shop.lng == null) continue;
    const selected = shop.id === selectedId;
    let rec = markers.get(shop.id);
    if (!rec) {
      const el = pillContent(shop, selected);
      const marker = new MarkerClass({
        map: mapInstance,
        position: { lat: shop.lat, lng: shop.lng },
        content: el,
        gmpClickable: true,
      });
      marker.addListener('gmp-click', () => onSelect && onSelect(shop.id));
      rec = { marker, el };
      markers.set(shop.id, rec);
    } else {
      const fresh = pillContent(shop, selected);
      rec.el.replaceWith(fresh);
      rec.el = fresh;
      rec.marker.content = fresh;
    }
  }
}

// Read the map's current visible region as a center + radius (meters from the
// center to the NE corner). Used both for the "Search this area" query and for
// deciding when the user has moved away from the last searched area.
function currentViewport() {
  if (!mapInstance) return null;
  const b = mapInstance.getBounds();
  if (!b) return null;
  const c = b.getCenter();
  const ne = b.getNorthEast();
  const center = { lat: c.lat(), lng: c.lng() };
  const radius = metersBetween(center, { lat: ne.lat(), lng: ne.lng() });
  return { center, radius };
}

// Has the visible region drifted meaningfully from the last searched area?
// True when the center shifts past a fraction of the viewport, or the zoom
// changes the radius substantially. Thresholds are relative so they behave the
// same at any zoom level.
function movedFromBaseline(vp) {
  if (!lastSearchedCenter) return true;
  const dist = metersBetween(vp.center, lastSearchedCenter);
  if (dist > Math.max(300, vp.radius * 0.25)) return true;
  if (lastSearchedRadius) {
    const ratio = vp.radius / lastSearchedRadius;
    if (ratio > 1.35 || ratio < 0.65) return true;
  }
  return false;
}

// Current viewport for the controller (used by the "Search this area" button).
export function getViewport() { return currentViewport(); }

// Record an area as freshly searched so the "Search this area" button hides
// until the user moves away again. Defaults to the current viewport.
export function markSearched(vp) {
  const v = vp || currentViewport();
  if (!v) return;
  lastSearchedCenter = v.center;
  lastSearchedRadius = v.radius;
  awaitingBaseline = false;
}

// center: {lat,lng}; shops: decorated list; selectedId; onSelect(id); onViewportChange(moved)
export async function mountMap({ center, shops, selectedId, onSelect, onViewportChange }) {
  const canvas = document.getElementById('mc-map-canvas');
  if (!canvas) return;

  let google;
  try {
    google = await loadSdk();
  } catch (e) {
    canvas.innerHTML = `
      <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:30px; text-align:center; color:#8A715A; font-size:13.5px; line-height:1.5; background:#E3D6C3;">
        ${e.message === 'NO_MAPS_KEY'
          ? 'Add your Google key (VITE_MAPS_BROWSER_KEY) to enable the map.'
          : 'Map could not load. Check the key restrictions.'}
      </div>`;
    return;
  }

  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  MarkerClass = AdvancedMarkerElement;
  // Keep the viewport handler current; the listener (added once below) reads
  // this. Each (re)mount re-baselines: the current view is treated as the
  // last searched area, so the "Search this area" button only appears once the
  // user actually moves the map.
  viewportCallback = onViewportChange || null;
  awaitingBaseline = true;

  if (!mapInstance || mapInstance.__canvas !== canvas) {
    mapInstance = new Map(canvas, {
      center,
      zoom: 15,
      mapId: 'DEMO_MAP_ID',
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
    });
    mapInstance.__canvas = canvas;
    markers = new Map();
    userMarker = null;

    // After the map settles (pan/zoom), decide whether to reveal the "Search
    // this area" button instead of auto-searching. The first idle after a
    // (re)mount records the baseline; later idles compare against it. Updating
    // markers via renderMarkers does not move the map, so there is no loop.
    mapInstance.addListener('idle', () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        const vp = currentViewport();
        if (!vp) return;
        if (awaitingBaseline) {
          lastSearchedCenter = vp.center;
          lastSearchedRadius = vp.radius;
          awaitingBaseline = false;
          if (viewportCallback) viewportCallback(false);
          return;
        }
        if (viewportCallback) viewportCallback(movedFromBaseline(vp));
      }, 300);
    });
  } else {
    mapInstance.setCenter(center);
  }

  const bounds = new google.maps.LatLngBounds();
  bounds.extend(center);
  for (const shop of shops) {
    if (shop.lat != null && shop.lng != null) bounds.extend({ lat: shop.lat, lng: shop.lng });
  }

  renderMarkers(shops, selectedId, onSelect);

  if (shops.length) mapInstance.fitBounds(bounds, 64);
}

// Update only the pins (and selection) for the current map, without moving it.
// Called by the controller after a viewport re-query.
export function updateShops({ shops, selectedId, onSelect }) {
  renderMarkers(shops || [], selectedId, onSelect);
}

// Pan to the user and show a small blue dot, like map apps.
export async function panToUser(coords) {
  if (!coords || !mapInstance) return false;

  let google;
  try {
    google = await loadSdk();
  } catch (e) {
    return false;
  }

  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

  mapInstance.panTo(coords);
  mapInstance.setZoom(16);

  const dotWrap = document.createElement('div');
  dotWrap.style.cssText = 'width:18px; height:18px; position:relative;';
  dotWrap.innerHTML = `
    <div style="position:absolute; inset:0; border-radius:50%; background:rgba(46,98,196,0.18); animation:mc-pulse 1.8s ease-out infinite;"></div>
    <div style="position:absolute; top:50%; left:50%; width:12px; height:12px; margin:-6px 0 0 -6px; border-radius:50%; background:#2E62C4; border:2px solid #fff; box-shadow:0 2px 8px rgba(46,98,196,0.45);"></div>`;

  if (userMarker) {
    userMarker.position = coords;
    userMarker.content = dotWrap;
  } else {
    userMarker = new AdvancedMarkerElement({
      map: mapInstance,
      position: coords,
      content: dotWrap,
      gmpClickable: false,
      zIndex: 1000,
    });
  }

  return true;
}

export function highlight(selectedId, byId) {
  for (const [id, rec] of markers) {
    const shop = byId[id];
    if (!shop) continue;
    const fresh = pillContent(shop, id === selectedId);
    rec.el.replaceWith(fresh);
    rec.el = fresh;
    rec.marker.content = fresh;
  }
}

export function openDirections(shop) {
  if (!shop) return;
  const dest = shop.lat != null && shop.lng != null
    ? `${shop.lat},${shop.lng}` : encodeURIComponent(shop.name || '');
  const place = shop.id ? `&destination_place_id=${encodeURIComponent(shop.id)}` : '';
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}${place}`, '_blank');
}
