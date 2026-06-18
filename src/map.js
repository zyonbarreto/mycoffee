import { MAPS_BROWSER_KEY } from './config.js';

// Loads the Google Maps JS SDK once (maps + marker + places libraries) and
// renders the real map with pins on the Map tab. The same loader is reused by
// api.js to run the nearby/search lookups in the browser.

let loaderPromise = null;
let mapInstance = null;
let markers = new Map(); // id -> { marker, el }

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

// center: {lat,lng}; shops: decorated list; selectedId; onSelect(id)
export async function mountMap({ center, shops, selectedId, onSelect }) {
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
  } else {
    mapInstance.setCenter(center);
  }

  const wanted = new Set(shops.map(s => s.id));
  for (const [id, rec] of markers) {
    if (!wanted.has(id)) { rec.marker.map = null; markers.delete(id); }
  }
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(center);

  for (const shop of shops) {
    if (shop.lat == null || shop.lng == null) continue;
    bounds.extend({ lat: shop.lat, lng: shop.lng });
    const selected = shop.id === selectedId;
    let rec = markers.get(shop.id);
    if (!rec) {
      const el = pillContent(shop, selected);
      const marker = new AdvancedMarkerElement({
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

  if (shops.length) mapInstance.fitBounds(bounds, 64);
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
