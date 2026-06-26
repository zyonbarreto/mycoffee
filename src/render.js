// Screen renderers. Markup and inline styles are ported verbatim from the
// design (MyCoffee.dc.html). Interactions use data-act attributes resolved by
// event delegation in main.js. Lists/conditionals are plain JS.

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Live Place photo, rendered as an <img> that fills its (already rounded,
// overflow-hidden, position:relative) container and sits behind the existing
// gradient overlays. The colored `tone` background stays behind it, so the
// fallback and any load gap look intentional and on brand. When no photo is
// available, nothing is emitted and only the tone swatch shows. The URL is
// live and session-only; it is never persisted or cached. `eager` keeps the
// detail hero from lazy-loading.
function photoImg(shop, eager) {
  if (!shop || !shop.photoUrl) return '';
  const loading = eager ? '' : ' loading="lazy"';
  return `<img src="${esc(shop.photoUrl)}" alt="${esc(shop.name)}"${loading} style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;" onerror="this.style.display='none'" />`;
}

// ---- Google attribution (required on screens that show Places data off-map) ----
// You must drop the official Google logo at public/google-on-white.png.
// See the runbook. This strip satisfies the "logo when displayed without a
// Google Map" requirement for Discover / Search / Saved.
function attribution() {
  return `
    <div style="display:flex; align-items:center; gap:8px; padding:18px 0 4px; opacity:0.9;">
      <img src="/google-on-white.png" alt="Powered by Google" height="16"
           style="height:16px; width:auto; display:block;" />
      <span style="font-size:10px; color:#A98C6B; letter-spacing:0.04em;">Results from Google</span>
    </div>`;
}

// ---- shared bits ----
export function statusBar() {
  return `
    <div style="flex:0 0 auto; height:50px; display:flex; align-items:center; justify-content:space-between; padding:0 30px; color:#2E2017; font-size:14px; font-weight:600;">
      <span>9:41</span>
      <span style="display:flex; gap:6px; align-items:center;">
        <svg width="17" height="12" viewBox="0 0 17 12" fill="#2E2017"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="4.5" y="4.5" width="3" height="7.5" rx="1"/><rect x="9" y="2" width="3" height="10" rx="1"/><rect x="13.5" y="0" width="3" height="12" rx="1"/></svg>
        <svg width="22" height="12" viewBox="0 0 24 12" fill="none"><rect x="0.5" y="0.5" width="20" height="11" rx="3" stroke="#2E2017"/><rect x="2" y="2" width="15" height="8" rx="1.5" fill="#2E2017"/><rect x="21.5" y="4" width="2" height="4" rx="1" fill="#2E2017"/></svg>
      </span>
    </div>`;
}

function heartSvg(size, fill, stroke) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="1.7"><path d="M12 20s-7-4.6-7-9.7A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7 3.3C19 15.4 12 20 12 20z"/></svg>`;
}

function metaLine(shop, withOpen) {
  const open = withOpen && shop.openLabel
    ? `<span style="color:#C8B79E;">·</span><span style="color:${shop.openColor};">${esc(shop.openLabel)}</span>` : '';
  const dist = shop.distStr
    ? `<span style="color:#C8B79E;">·</span><span>${esc(shop.distStr)}</span>` : '';
  return `
    <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:12px; color:#6F5942;">
      <span style="color:#2E2017; font-weight:700;">★ ${esc(shop.ratingStr)}</span>
      <span style="color:#A98C6B;">${esc(shop.reviewsStr)} ratings</span>
      ${dist}
      ${open}
    </div>`;
}

// Big row (Discover + Saved). rank is a 2-char string or null. Tapping the row
// opens the shop detail view; the heart button keeps its own action (closest
// data-act wins on click).
function bigRow(shop, rank) {
  const badge = rank ? `<div style="position:absolute; top:-8px; left:-8px; font-family:'Libre Caslon Display',serif; font-size:11px; color:#fff; background:#2E2017; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center;">${esc(rank)}</div>` : '';
  const eyebrow = shop.hood
    ? `${esc(shop.specialty)} · ${esc(shop.hood)}`
    : `${esc(shop.specialty)}`;
  return `
    <div data-act="open-detail" data-id="${esc(shop.id)}" style="display:flex; gap:12px; align-items:center; padding:16px 0; border-bottom:1px solid #ECE3D7; cursor:pointer;">
      <div style="position:relative; flex:0 0 auto;">
        <div style="width:68px; height:68px; border-radius:14px; background:${shop.tone}; overflow:hidden; position:relative;">
          ${photoImg(shop)}
          <div style="position:absolute; inset:0; background-image:repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 11px);"></div>
          <div style="position:absolute; bottom:0; left:0; right:0; height:40%; background:linear-gradient(transparent, rgba(34,23,16,0.35));"></div>
        </div>
        ${badge}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:9px; letter-spacing:0.18em; text-transform:uppercase; color:#A98C6B; font-weight:600; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${eyebrow}</div>
        <div style="font-family:'Libre Caslon Display',serif; font-size:18px; line-height:1.05; color:#2E2017; margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(shop.name)}</div>
        ${metaLine(shop, true)}
      </div>
      <button data-act="toggle-fav" data-id="${esc(shop.id)}" style="flex:0 0 auto; background:none; border:none; cursor:pointer; padding:4px;">
        ${heartSvg(20, shop.heartFill, shop.heartStroke)}
      </button>
    </div>`;
}

// Smaller row (Search results). Tapping the row opens the shop detail view;
// the heart button keeps its own action (closest data-act wins on click).
function smallRow(shop) {
  return `
    <div data-act="open-detail" data-id="${esc(shop.id)}" style="display:flex; gap:14px; align-items:center; padding:18px 0; border-bottom:1px solid #ECE3D7; cursor:pointer;">
      <div style="width:60px; height:60px; flex:0 0 auto; border-radius:14px; background:${shop.tone}; position:relative; overflow:hidden;">
        ${photoImg(shop)}
        <div style="position:absolute; inset:0; background-image:repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 11px);"></div>
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:#A98C6B; font-weight:600; margin-bottom:4px;">${esc(shop.specialty)}${shop.hood ? ' · ' + esc(shop.hood) : ''}</div>
        <div style="font-family:'Libre Caslon Display',serif; font-size:19px; line-height:1.05; color:#2E2017; margin-bottom:6px;">${esc(shop.name)}</div>
        ${metaLine(shop, false)}
      </div>
      <button data-act="toggle-fav" data-id="${esc(shop.id)}" style="flex:0 0 auto; background:none; border:none; cursor:pointer; padding:6px;">
        ${heartSvg(20, shop.heartFill, shop.heartStroke)}
      </button>
    </div>`;
}

function loadingBlock(label) {
  return `
    <div style="padding:60px 0; text-align:center; color:#93795D;">
      <div style="width:28px; height:28px; margin:0 auto 16px; border:3px solid #E4D9CB; border-top-color:#2E2017; border-radius:50%; animation:mc-spin 0.8s linear infinite;"></div>
      <div style="font-size:13.5px;">${esc(label || 'Finding good coffee near you…')}</div>
    </div>`;
}

function errorBlock(message, retryAct, retryLabel) {
  const retry = retryAct
    ? `<button data-act="${retryAct}" style="margin-top:14px; border:1px solid #E0CFB8; background:none; color:#8A6A4C; font-weight:600; font-size:13px; padding:11px 20px; border-radius:12px; cursor:pointer;">${esc(retryLabel || 'Try again')}</button>` : '';
  return `
    <div style="padding:50px 0; text-align:center; color:#93795D;">
      <div style="font-family:'Libre Caslon Display',serif; font-size:22px; color:#2E2017; margin-bottom:8px;">Hmm.</div>
      <div style="font-size:13.5px; line-height:1.5; max-width:250px; margin:0 auto;">${esc(message)}</div>
      ${retry}
    </div>`;
}

// ===================== ONBOARDING =====================
export function onboarding() {
  return `
    <div style="position:absolute; inset:0; background:#2E2017; color:#F6F0E8; display:flex; flex-direction:column; overflow:hidden;">
      <div style="position:absolute; top:-80px; right:-60px; width:320px; height:320px; border-radius:50%; background:radial-gradient(circle at 30% 30%, #4A3526, #2E2017 70%);"></div>
      <div style="position:absolute; bottom:140px; left:-90px; width:240px; height:240px; border-radius:50%; border:1px solid rgba(246,240,232,0.12);"></div>
      <div style="flex:1; display:flex; flex-direction:column; justify-content:flex-end; padding:0 34px 26px; position:relative; z-index:2;">
        <div style="font-size:11px; letter-spacing:0.32em; text-transform:uppercase; color:#C2A789; margin-bottom:22px; font-weight:600;">MyCoffee · Est. Here</div>
        <div style="font-family:'Libre Caslon Display',serif; font-size:64px; line-height:0.98; letter-spacing:-0.01em;">Good<br>coffee,<br><span style="font-style:italic; color:#D8B891;">now.</span></div>
        <div style="font-size:15px; line-height:1.55; color:rgba(246,240,232,0.66); margin-top:22px; max-width:280px;">Find the best cups within walking distance. Sorted by what people actually love.</div>
      </div>
      <div style="padding:0 34px 46px; position:relative; z-index:2;">
        <div style="display:flex; align-items:center; gap:12px; padding:16px 18px; border:1px solid rgba(246,240,232,0.16); border-radius:16px; margin-bottom:16px; background:rgba(246,240,232,0.04);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D8B891" stroke-width="1.6"><path d="M12 21s7-7.5 7-12a7 7 0 0 0-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
          <div style="font-size:13px; line-height:1.35; color:rgba(246,240,232,0.8);">Share your location to see shops near <strong style="color:#F6F0E8;">you</strong>.</div>
        </div>
        <button data-act="use-location" style="width:100%; border:none; background:#F6F0E8; color:#2E2017; font-weight:600; font-size:16px; padding:17px; border-radius:16px; cursor:pointer;">Use my location</button>
        <button data-act="maybe-later" style="width:100%; border:none; background:transparent; color:rgba(246,240,232,0.55); font-weight:500; font-size:14px; padding:16px; cursor:pointer; margin-top:4px;">Maybe later</button>
      </div>
    </div>`;
}

// ===================== HOME / DISCOVER (+ SEARCH) =====================
// Discover and Search live in one tab. The search input sits at the top and is
// always available. With an empty query the screen shows the ranked nearby
// Discover list with its sort tabs; once the user types, the same body region
// swaps to search results. Clearing the query returns to the Discover list.
export function home(state) {
  return `
    <div style="padding:8px 20px 120px; overflow-x:hidden;">
      <div style="font-size:10px; letter-spacing:0.28em; text-transform:uppercase; color:#9A7B5C; font-weight:600; margin-bottom:8px;">Good coffee, now</div>
      <div style="font-family:'Libre Caslon Display',serif; font-size:38px; line-height:0.95; color:#2E2017;">Discover</div>
      <button data-act="use-location" aria-label="Use my location" style="display:flex; align-items:center; gap:5px; color:#6F5942; font-size:12px; margin-top:12px; max-width:100%; background:none; border:none; padding:0; cursor:pointer;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9A7B5C" stroke-width="1.8" style="flex:0 0 auto;"><path d="M12 21s7-7.5 7-12a7 7 0 0 0-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
        <span style="font-weight:600; color:#2E2017; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;">${esc(state.location)}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C2AC8E" stroke-width="2" style="flex:0 0 auto;"><path d="m9 6 6 6-6 6"/></svg>
      </button>
      <div style="display:flex; align-items:center; gap:8px; background:#FFFCF7; border:1px solid #E0D2BF; border-radius:14px; padding:11px 13px; margin-top:16px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A7B5C" stroke-width="1.9" style="flex:0 0 auto;"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="mc-search-input" class="mc-in" value="${esc(state.query)}" placeholder="Shops, neighborhoods, cities…" style="flex:1; border:none; outline:none; background:none; font-size:14px; color:#2E2017; min-width:0;" />
        <button id="mc-clear" data-act="clear-query" style="background:none; border:none; cursor:pointer; padding:0; color:#B09877; display:${state.query ? 'flex' : 'none'};"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div id="mc-search-body">${searchBody(state)}</div>
    </div>`;
}

// Body of the combined Discover/Search tab. Rendered standalone too, for live
// updates without losing input focus. Empty query => Discover browse list with
// sort tabs; non-empty query => search results (ordered by reviews upstream).
export function searchBody(state) {
  const q = (state.query || '').trim();
  if (!q) return discoverList(state);

  const r = state.results;
  if (r.status === 'loading' || r.status === 'idle') return loadingBlock('Searching…');
  if (r.status === 'error') return errorBlock(r.error || 'Search failed.', 'retry-search');
  if (!r.shops.length) {
    return `
      <div style="padding:50px 0; text-align:center; color:#93795D;">
        <div style="font-family:'Libre Caslon Display',serif; font-size:22px; color:#2E2017; margin-bottom:6px;">No matches</div>
        <div style="font-size:13.5px;">Try another shop or neighborhood.</div>
      </div>`;
  }
  const label = r.shops.length + (r.shops.length === 1 ? ' result' : ' results');
  return `
    <div style="font-size:11px; letter-spacing:0.24em; text-transform:uppercase; color:#9A7B5C; font-weight:600; margin:26px 0 4px;">${label}</div>
    ${r.shops.map(smallRow).join('')}
    ${attribution()}`;
}

// The Discover browse experience: sort tabs plus the ranked nearby list.
function discoverList(state) {
  const tabs = [['rating', 'Top rated'], ['popular', 'Popular'], ['distance', 'Closest']]
    .map(([k, label]) => {
      const on = state.sort === k;
      return `<button data-act="set-sort" data-sort="${k}" style="background:none; border:none; cursor:pointer; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; padding:0 0 10px; color:${on ? '#2E2017' : '#B9A78F'}; border-bottom:2px solid ${on ? '#2E2017' : 'transparent'}; white-space:nowrap; flex:0 0 auto;">${label}</button>`;
    }).join('');

  let body;
  const nb = state.nearby;
  if (nb.status === 'loading' || nb.status === 'idle') body = loadingBlock();
  else if (nb.status === 'error') {
    // When we have no coordinates yet, the only path forward is to (re)request
    // location, so the CTA triggers geolocation rather than re-running the
    // failing nearby query.
    body = state.userCoords
      ? errorBlock(nb.error || 'Could not load nearby shops.', 'retry-nearby')
      : errorBlock(nb.error || 'Location not set. Search a place instead.', 'use-location', 'Use my location');
  }
  else if (!nb.shops.length) body = errorBlock('No coffee shops found near here. Try searching a different area.', 'retry-nearby');
  else body = nb.shops.map((s, i) => bigRow(s, String(i + 1).padStart(2, '0'))).join('') + attribution();

  return `
    <div style="display:flex; align-items:center; gap:14px; margin:22px 0 4px; border-bottom:1px solid #E4D9CB; min-width:0;">${tabs}</div>
    ${body}`;
}

// ===================== SHOP DETAIL =====================
// Opened from the combined Discover/Search list. Shows a description plus key
// info and reuses the directions + heart affordances. Back returns to Discover.
function backBar() {
  return `
    <button data-act="close-detail" style="display:flex; align-items:center; gap:8px; background:none; border:none; cursor:pointer; padding:6px 0 14px; color:#6F5942; font-size:13px; font-weight:600;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E2017" stroke-width="2"><path d="m15 6-6 6 6 6"/></svg>
      <span style="color:#2E2017;">Discover</span>
    </button>`;
}

// Compose a description. Prefer Google's editorialSummary when present;
// otherwise build a sensible sentence from the data we already have. We never
// fabricate reviews or invent facts here.
function buildDescription(shop) {
  if (shop.editorial) return esc(shop.editorial);
  const bits = [];
  const kind = (shop.specialty || 'Coffee').toLowerCase();
  let lead = `A ${kind} spot`;
  if (shop.hood) lead += ` in ${esc(shop.hood)}`;
  lead += '.';
  bits.push(lead);
  if (shop.rating != null) {
    bits.push(`Rated ${esc(shop.ratingStr)} across ${esc(shop.reviewsStr)} ratings.`);
  }
  if (shop.openLabel) bits.push(`${shop.openLabel === 'Open' ? 'Open right now' : 'Currently closed'}.`);
  return bits.join(' ');
}

function detailCard(shop) {
  const eyebrow = shop.hood
    ? `${esc(shop.specialty)} · ${esc(shop.hood)}`
    : `${esc(shop.specialty)}`;
  const address = shop.address
    ? `<div style="display:flex; gap:10px; align-items:flex-start; margin-top:18px;">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A7B5C" stroke-width="1.7" style="flex:0 0 auto; margin-top:2px;"><path d="M12 21s7-7.5 7-12a7 7 0 0 0-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
         <div style="font-size:13.5px; color:#6F5942; line-height:1.5;">${esc(shop.address)}</div>
       </div>` : '';
  const phone = shop.phone
    ? `<div style="display:flex; gap:10px; align-items:center; margin-top:12px;">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A7B5C" stroke-width="1.7" style="flex:0 0 auto;"><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>
         <a href="tel:${esc(shop.phone)}" style="font-size:13.5px; color:#6F5942; text-decoration:none;">${esc(shop.phone)}</a>
       </div>` : '';
  const website = shop.website
    ? `<div style="display:flex; gap:10px; align-items:center; margin-top:12px;">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A7B5C" stroke-width="1.7" style="flex:0 0 auto;"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
         <a href="${esc(shop.website)}" target="_blank" rel="noopener" style="font-size:13.5px; color:#6F5942; text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Visit website</a>
       </div>` : '';
  const hours = (shop.hours && shop.hours.length)
    ? `<div style="margin-top:22px;">
         <div style="font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:#9A7B5C; font-weight:600; margin-bottom:8px;">Hours</div>
         ${shop.hours.map(h => `<div style="font-size:13px; color:#6F5942; line-height:1.7;">${esc(h)}</div>`).join('')}
       </div>` : '';

  return `
    <div style="position:relative; width:100%; height:180px; border-radius:22px; background:${shop.tone}; overflow:hidden; margin-bottom:18px;">
      ${photoImg(shop, true)}
      <div style="position:absolute; inset:0; background-image:repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 11px);"></div>
      <div style="position:absolute; bottom:0; left:0; right:0; height:50%; background:linear-gradient(transparent, rgba(34,23,16,0.45));"></div>
      <button data-act="toggle-fav" data-id="${esc(shop.id)}" style="position:absolute; top:14px; right:14px; background:rgba(246,240,232,0.92); border:none; cursor:pointer; padding:9px; border-radius:50%; display:flex; box-shadow:0 6px 16px -6px rgba(46,32,23,0.5);">
        ${heartSvg(20, shop.heartFill, shop.heartStroke)}
      </button>
    </div>
    <div style="font-size:10px; letter-spacing:0.22em; text-transform:uppercase; color:#A98C6B; font-weight:600; margin-bottom:6px;">${eyebrow}</div>
    <div style="font-family:'Libre Caslon Display',serif; font-size:32px; line-height:1.02; color:#2E2017; margin-bottom:12px;">${esc(shop.name)}</div>
    ${metaLine(shop, true)}
    <div style="font-size:14.5px; color:#4A3A2C; line-height:1.6; margin-top:18px;">${buildDescription(shop)}</div>
    ${address}
    ${phone}
    ${website}
    ${hours}
    <button data-act="directions" data-id="${esc(shop.id)}" style="margin-top:24px; width:100%; border:none; background:#2E2017; color:#F6F0E8; font-weight:600; font-size:15px; padding:15px; border-radius:14px; cursor:pointer;">Directions${shop.distStr ? ' · ' + esc(shop.distStr) : ''}</button>
    ${attribution()}`;
}

export function detail(state) {
  const d = state.detail || {};
  let body;
  if (d.status === 'loading' || d.status === 'idle') body = loadingBlock('Loading shop…');
  else if (d.status === 'error') body = errorBlock(d.error || 'Could not load this shop.', 'retry-detail');
  else if (!d.shop) body = errorBlock('This shop could not be found.', 'retry-detail');
  else body = detailCard(d.shop);

  return `
    <div id="mc-detail-panel" style="padding:8px 24px 120px; min-height:100%; touch-action:pan-y;">
      ${backBar()}
      ${body}
    </div>`;
}

// ===================== FAVORITES =====================
export function favorites(state) {
  const sv = state.saved;
  const count = (state.favs || []).length;
  const countStr = count + (count === 1 ? ' place you love' : ' places you love');

  let body;
  if (!count) {
    body = `
      <div style="margin-top:70px; text-align:center;">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#C2AC8E" stroke-width="1.4" style="margin-bottom:14px;"><path d="M12 20s-7-4.6-7-9.7A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7 3.3C19 15.4 12 20 12 20z"/></svg>
        <div style="font-family:'Libre Caslon Display',serif; font-size:24px; color:#2E2017; margin-bottom:8px;">Nothing saved yet</div>
        <div style="font-size:14px; color:#93795D; line-height:1.5; max-width:230px; margin:0 auto;">Tap the heart on any shop to keep it here for later.</div>
      </div>`;
  } else if (sv.status === 'loading' || sv.status === 'idle') {
    body = loadingBlock('Loading your places…');
  } else if (sv.status === 'error') {
    body = errorBlock(sv.error || 'Could not load saved shops.', 'retry-saved');
  } else {
    body = `<div style="margin-top:18px;">${sv.shops.map(s => bigRow(s, null)).join('')}</div>${attribution()}`;
  }

  return `
    <div style="padding:8px 24px 120px;">
      <div style="font-size:11px; letter-spacing:0.3em; text-transform:uppercase; color:#9A7B5C; font-weight:600; margin-bottom:10px;">Your collection</div>
      <div style="font-family:'Libre Caslon Display',serif; font-size:46px; line-height:0.95; color:#2E2017;">Saved</div>
      <div style="font-size:13px; color:#6F5942; margin-top:12px;">${countStr}</div>
      ${body}
    </div>`;
}

// ===================== PROFILE =====================
export function profile(state) {
  const stats = [
    { value: String((state.favs || []).length), label: 'Saved' },
    { value: '23', label: 'Reviews' },
    { value: '48', label: 'Visited' },
  ];
  const settings = [
    { d: ['M12 21s7-7.5 7-12a7 7 0 0 0-14 0c0 4.5 7 12 7 12z', 'M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'], label: 'Location', value: 'Williamsburg' },
    { d: ['M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8', 'M13.7 21a2 2 0 0 1-3.4 0'], label: 'Notifications', value: 'On' },
    { d: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.7-2.5 2-2.5 3.5', 'M12 17h.01'], label: 'Help & support', value: '' },
  ];
  const ico = (paths) => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${paths.map(d => `<path d="${d}"/>`).join('')}</svg>`;

  return `
    <div style="padding:8px 24px 120px;">
      <div style="display:flex; align-items:center; gap:16px; margin-top:6px;">
        <div style="width:70px; height:70px; border-radius:50%; background:#2E2017; color:#F6F0E8; font-family:'Libre Caslon Display',serif; font-size:28px; display:flex; align-items:center; justify-content:center;">Z</div>
        <div>
          <div style="font-family:'Libre Caslon Display',serif; font-size:28px; color:#2E2017; line-height:1;">Zyon Barreto</div>
          <div style="font-size:13px; color:#93795D; margin-top:6px;">Williamsburg, off 220 Bushwick Ave</div>
        </div>
      </div>
      <div style="display:flex; margin-top:26px; border:1px solid #E4D9CB; border-radius:18px; overflow:hidden; background:#FFFCF7;">
        ${stats.map(st => `
          <div style="flex:1; padding:16px 8px; text-align:center; border-left:1px solid #EEE4D6;">
            <div style="font-family:'Libre Caslon Display',serif; font-size:26px; color:#2E2017;">${st.value}</div>
            <div style="font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:#9A7B5C; font-weight:600; margin-top:4px;">${st.label}</div>
          </div>`).join('')}
      </div>
      <div style="font-size:11px; letter-spacing:0.24em; text-transform:uppercase; color:#9A7B5C; font-weight:600; margin:30px 0 4px;">Settings</div>
      ${settings.map(row => `
        <div style="display:flex; align-items:center; gap:14px; padding:17px 0; border-bottom:1px solid #ECE3D7;">
          <div style="color:#6F5942; display:flex;">${ico(row.d)}</div>
          <div style="flex:1; font-size:15.5px; color:#2E2017; font-weight:500;">${row.label}</div>
          <div style="font-size:13px; color:#A98C6B; white-space:nowrap;">${row.value}</div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C2AC8E" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>
        </div>`).join('')}
      <button style="margin-top:26px; width:100%; border:1px solid #E0CFB8; background:none; color:#8A6A4C; font-weight:600; font-size:14px; padding:15px; border-radius:14px; cursor:pointer; letter-spacing:0.04em;">Sign out</button>
    </div>`;
}

// ===================== BOTTOM NAV =====================
export function bottomNav(screen) {
  const c = (n) => (screen === n ? '#2E2017' : '#B9A78F');
  const tab = (act, name, svg) => `
    <button data-act="${act}" style="flex:1; background:none; border:none; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:5px; padding:4px 2px;">
      ${svg}
      <span style="font-size:9.5px; letter-spacing:0.06em; text-transform:uppercase; font-weight:600; color:${c(name)};">${labelFor(name)}</span>
    </button>`;
  return `
    <div style="flex:0 0 auto; height:86px; background:rgba(246,240,232,0.94); backdrop-filter:blur(12px); border-top:1px solid #E4D9CB; display:flex; align-items:flex-start; padding:12px 6px 0;">
      ${tab('go-fav', 'favorites', `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c('favorites')}" stroke-width="1.7"><path d="M12 20s-7-4.6-7-9.7A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7 3.3C19 15.4 12 20 12 20z"/></svg>`)}
      ${tab('go-home', 'home', `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c('home')}" stroke-width="1.7"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`)}
      ${tab('go-profile', 'profile', `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c('profile')}" stroke-width="1.7"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/></svg>`)}
    </div>`;
}

function labelFor(name) {
  return { home: 'Discover', favorites: 'Saved', profile: 'Profile' }[name];
}
