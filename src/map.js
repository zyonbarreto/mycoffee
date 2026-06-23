import { MAPS_BROWSER_KEY } from './config.js';

// Loads the Google Maps JS SDK once (maps + marker + places libraries) and
// renders the real map with pins on the Map tab. The same loader is reused by
// api.js to run the nearby/search lookups in the browser.

let loaderPromise = null;
let mapInstance = null;
let markers = new Map(); // id -> { marker, el }
let userMarker = null;
let MarkerClass = null;        // AdvancedMarkerElement, cached after first import
let idleCallback = null;       // latest onIdle handler (refreshed each mount)
let idleTimer = null;          // debounce timer for the map 'idle' event

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

// center: {lat,lng}; shops: decorated list; selectedId; onSelect(id); onIdle(center,radius)
export async function mountMap({ center, shops, selectedId, onSelect, onIdle }) {
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
  // Keep the idle handler current; the listener (added once below) reads this.
  idleCallback = onIdle || null;

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

    // Re-query shops for the visible region after the map settles (pan/zoom).
    // Debounced so a flick of pans makes one Google call, not many. Updating
    // markers via renderMarkers does not move the map, so there is no loop.
    mapInstance.addListener('idle', () => {
      if (!idleCallback) return;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!mapInstance || !idleCallback) return;
        const b = mapInstance.getBounds();
        if (!b) return;
        const c = b.getCenter();
        const ne = b.getNorthEast();
        const ctr = { lat: c.lat(), lng: c.lng() };
        const radius = metersBetween(ctr, { lat: ne.lat(), lng: ne.lng() });
        idleCallback(ctr, radius);
      }, 400);
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
