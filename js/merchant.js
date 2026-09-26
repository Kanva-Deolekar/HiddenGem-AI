const vibes = ['Solo & Quiet', 'Local Artisans', 'Hidden Food', 'Culture & Heritage', 'Nightlife'];
const API_BASE_URL = '/api';
const USE_REMOTE_API = true;

// Current authenticated merchant user
let currentMerchantUser = null;
try { currentMerchantUser = JSON.parse(localStorage.getItem('hgai_user') || '{}'); } catch (e) {}

// Business details captured on merchant-details.html (name/location/category/contact/hours), if any.
let merchantDetails = {};
try { merchantDetails = JSON.parse(localStorage.getItem('hgai_merchant') || '{}'); } catch (error) { merchantDetails = {}; }
const merchantLocation = merchantDetails.location || 'Ratnagiri, Maharashtra';
const merchantCategory = vibes.includes(merchantDetails.category) ? merchantDetails.category : vibes[1];
const merchantName = merchantDetails.businessName || currentMerchantUser.businessName || currentMerchantUser.name || 'Ratnagiri Merchant';

const app = document.querySelector('#merchant-app');
app.innerHTML = `
  <div class="app-shell">
    <div class="folk-pattern top-pattern"></div>
    <div class="folk-pattern side-pattern"></div>
    <div class="marigold marigold-one">✿</div>
    <div class="marigold marigold-two">✿</div>

    <nav class="topbar">
      <a class="brand" href="merchant.html"><span class="gem">◆</span><span>HiddenGems<span>AI</span></span></a>
      <div class="context">⌖ <span>${merchantLocation}</span><i></i><span>☀ Clear 28°C · Ratnagiri</span></div>
      <div class="nav-actions">
        <div class="user-profile-pill" id="merchant-user-pill">
          <span id="merchant-user-name">${merchantName}</span>
          <span class="user-role">Merchant</span>
          <button type="button" class="btn-logout" id="logout-button" title="Log out of merchant account">Log out</button>
        </div>
        <button class="notification" aria-label="Notifications">♧<b></b></button>
        <button class="mobile-menu" aria-label="Menu">☰</button>
      </div>
    </nav>

    <main class="merchant">
      <header class="merchant-hero">
        <p class="eyebrow">⚡ MERCHANT PORTAL · RATNAGIRI · ${merchantName}</p>
        <h1>Turn nearby intent into <em>footfall.</em></h1>
        <p>Surface the right offer to travelers who are ready to discover something special in Ratnagiri.</p>
      </header>

      <section class="merchant-grid">
        <div class="footfall glass">
          <p class="eyebrow">RIGHT NOW, NEAR YOU</p>
          <div class="footfall-title">
            <div class="pulse"><span></span></div>
            <div>
              <h2>High traveler footfall</h2>
              <p>${merchantLocation} · 1.5km coastal radius</p>
            </div>
          </div>
          <div class="metric-row">
            <div><b data-analytics="nearbyTravelers">—</b><span>active explorers</span></div>
            <div><b data-analytics="potentialVisitors">—</b><span>seeking local picks</span></div>
            <div><b data-analytics="activeOffers">—</b><span>active offers</span></div>
          </div>
          <div class="activity-chart">
            ${[31, 48, 39, 65, 58, 82, 72, 94, 86, 100, 89, 96].map(height => `<i style="height:${height}%"></i>`).join('')}
          </div>
        </div>

        <div class="map-panel merchant-map glass">
          <div id="merchant-leaflet-map"></div>
          <div class="map-header"><span>⌖ NEARBY VERIFIED SPOTS · ${merchantLocation}</span></div>
          <div class="map-brand">HiddenGems<span>AI</span></div>
        </div>

        <form class="offer-form glass">
          <div>
            <p class="eyebrow">MAKE AN OFFER</p>
            <h2>Create a flash micro-offer</h2>
          </div>
          <label>Discount
            <div class="input-wrap">
              <input name="discount" value="20" inputmode="numeric">
              <span>% OFF</span>
            </div>
          </label>
          <label>Available for
            <select name="duration">
              <option>1 hour</option>
              <option selected>2 hours</option>
              <option>Until closing</option>
            </select>
          </label>
          <label>Target vibe
            <select name="vibe">
              ${vibes.map(vibe => `<option ${vibe === merchantCategory ? 'selected' : ''}>${vibe}</option>`).join('')}
            </select>
          </label>
          <button class="broadcast" type="submit">⚡ Broadcast to idle travelers</button>
        </form>
      </section>
    </main>
  </div>
`;

// Initialize browser Lucide icons after the dashboard markup exists.
function initializeIcons(root = app) {
  const icons = { '⌖': 'map-pin', '☀': 'sun', '←': 'arrow-left', '♧': 'bell', '☰': 'menu', '⚡': 'zap', '◆': 'gem', '✓': 'check' };
  let markup = root.innerHTML;
  Object.entries(icons).forEach(([character, name]) => { markup = markup.replaceAll(character, `<i data-lucide="${name}" aria-hidden="true"></i>`); });
  root.innerHTML = markup;
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
}

function initializeMerchant() {
  initializeIcons();
  setupAuthHandlers();
}

// --- Merchant map: merchant's approximate location + its verified experiences ---
// Same free stack as the traveler map (Leaflet + OpenStreetMap tiles, no API key).
const RATNAGIRI_CENTER = [16.9902, 73.3120];
let merchantMapInstance = null;

function getExperienceCoords(item) {
  const lat = Number(item.latitude ?? item.lat);
  const lng = Number(item.longitude ?? item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// Geocode the merchant's free-text location (from merchant-details.html) via the free
// OpenStreetMap Nominatim API - a one-time lookup, no key. Never invented: falls back
// to the fixed Ratnagiri-town center if geocoding fails, times out, or finds nothing.
function geocodeMerchantLocation(locationText) {
  return new Promise(resolve => {
    const query = /india/i.test(locationText) ? locationText : `${locationText}, India`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const timeout = setTimeout(() => resolve(null), 6000);
    fetch(url)
      .then(res => (res.ok ? res.json() : null))
      .then(results => {
        clearTimeout(timeout);
        const first = Array.isArray(results) ? results[0] : null;
        if (first && Number.isFinite(Number(first.lat)) && Number.isFinite(Number(first.lon))) {
          resolve({ lat: Number(first.lat), lng: Number(first.lon) });
        } else {
          resolve(null);
        }
      })
      .catch(() => { clearTimeout(timeout); resolve(null); });
  });
}

async function loadNearbyVerifiedExperiences() {
  try {
    // The merchant endpoint is authenticated and is scoped by the session's
    // merchant id. Do not use the public catalog here: it contains listings
    // belonging to other merchants as well.
    const response = await fetch(`${API_BASE_URL}/merchant/experiences`);
    const data = await response.json();
    if (!response.ok || data.success === false) throw new Error(data.message || `Experiences request failed: ${response.status}`);
    return data.data?.experiences || [];
  } catch (error) {
    console.error('Unable to load this merchant\'s experiences for merchant map', error);
    return [];
  }
}

function renderMerchantMap(center, experiences) {
  const container = document.getElementById('merchant-leaflet-map');
  if (!container || typeof L === 'undefined') return;

  if (merchantMapInstance) { merchantMapInstance.remove(); merchantMapInstance = null; }

  const map = L.map(container, { zoomControl: false }).setView(center, 13);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  const boundsPoints = [center];
  const merchantIcon = L.divIcon({ className: '', html: '<div class="hg-marker-user"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
  L.marker(center, { icon: merchantIcon }).addTo(map).bindPopup('Your business (approximate location)');

  experiences.forEach(item => {
    const coords = getExperienceCoords(item);
    if (!coords) return; // never invent a coordinate for an experience that doesn't have one
    const markerIcon = L.divIcon({
      className: '',
      html: `<div class="hg-marker-pin"><span>${item.pin || '★'}</span></div>`,
      iconSize: [29, 29],
      iconAnchor: [14, 29],
      popupAnchor: [0, -26]
    });
    const marker = L.marker([coords.lat, coords.lng], { icon: markerIcon }).addTo(map);
    marker.bindPopup(`<div class="hg-popup"><h4>${item.title}</h4><p>${item.kind || ''} · ${item.budget || ''}</p></div>`);
    boundsPoints.push([coords.lat, coords.lng]);
  });

  if (boundsPoints.length > 1) map.fitBounds(boundsPoints, { padding: [28, 28] });
  merchantMapInstance = map;
}

async function loadMerchantMap() {
  const [center, experiences] = await Promise.all([
    geocodeMerchantLocation(merchantLocation),
    loadNearbyVerifiedExperiences()
  ]);
  renderMerchantMap(center || RATNAGIRI_CENTER, experiences);
}

async function verifyAuth() {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`);
    if (!res.ok) {
      window.location.href = 'login.html?redirect=merchant.html&role=merchant';
      return false;
    }
    const data = await res.json();
    if (!data.success || !data.data?.user || data.data.user.role !== 'merchant') {
      window.location.href = 'login.html?redirect=merchant.html&role=merchant';
      return false;
    }
    currentMerchantUser = data.data.user;
    localStorage.setItem('hgai_user', JSON.stringify(currentMerchantUser));
    const nameEl = document.querySelector('#merchant-user-name');
    if (nameEl) nameEl.textContent = currentMerchantUser.businessName || currentMerchantUser.name || 'Merchant';
    return true;
  } catch (err) {
    console.error('Merchant auth check failed:', err);
    window.location.href = 'login.html?redirect=merchant.html&role=merchant';
    return false;
  }
}

function setupAuthHandlers() {
  const logoutBtn = document.querySelector('#logout-button');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      logoutBtn.disabled = true;
      logoutBtn.textContent = 'Logging out...';
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
      } catch (e) {}
      localStorage.removeItem('hgai_user');
      window.location.href = 'login.html';
    };
  }
}

initializeMerchant();

async function broadcastOffer(offer) {
  if (!USE_REMOTE_API) return { ...offer, status: 'demo' };
  const response = await fetch(`${API_BASE_URL}/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(offer)
  });
  const payload = await response.json();
  if (!response.ok || payload.success === false) throw new Error(payload.message || `Offer request failed: ${response.status}`);
  return payload;
}

async function loadActiveOffer() {
  if (!USE_REMOTE_API) return;
  try {
    const response = await fetch(`${API_BASE_URL}/offers`);
    const data = await response.json();
    if (!response.ok || data.success === false) throw new Error(data.message || `Offer request failed: ${response.status}`);
    const offer = data.data?.offers && data.data.offers[data.data.offers.length - 1];
    if (offer) updateOfferStatus(offer, { status: offer.status });
  } catch (error) {
    console.error('Unable to load active offers', error);
    offerStatus.textContent = error.message || 'Unable to load offers. Please try again.';
  }
}

async function loadAnalytics() {
  try {
    const response = await fetch(`${API_BASE_URL}/merchant/analytics`);
    const responseData = await response.json();
    if (!response.ok || responseData.success === false) throw new Error(responseData.message || `Analytics request failed: ${response.status}`);
    const analytics = responseData.data.analytics;
    Object.entries(analytics).forEach(([key, value]) => {
      const metric = document.querySelector(`[data-analytics="${key}"]`);
      if (metric) metric.textContent = key === 'potentialVisitors' ? `${value}%` : value;
    });
  } catch (error) {
    console.error('Unable to load analytics', error);
    offerStatus.textContent = error.message || 'Unable to load live analytics. Please try again.';
  }
}

function validateOffer(offer) {
  return Number.isInteger(offer.discount) && offer.discount >= 1 && offer.discount <= 100 && Boolean(offer.duration) && Boolean(offer.targetVibe);
}
function updateOfferStatus(offer, result) {
  offerStatus.textContent = `${offer.discount}% off · ${offer.duration} · ${offer.targetVibe} · ${result.status === 'demo' ? 'Demo offer active' : 'Live'}`;
}

const offerForm = document.querySelector('.offer-form');
const discountInput = offerForm.querySelector('[name="discount"]');
discountInput.type = 'number';
discountInput.min = '1';
discountInput.max = '100';
discountInput.required = true;
const offerStatus = document.createElement('p');
offerStatus.className = 'offer-status';
offerStatus.textContent = 'No live offer yet';
offerForm.append(offerStatus);

offerForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('.broadcast');
  const formData = new FormData(event.currentTarget);
  const discount = Number(formData.get('discount'));
  const offer = { discount, duration: formData.get('duration'), targetVibe: formData.get('vibe') };
  if (!validateOffer(offer)) {
    discountInput.setCustomValidity('Enter a discount from 1 to 100 percent.');
    discountInput.reportValidity();
    return;
  }
  discountInput.setCustomValidity('');
  button.disabled = true;
  button.textContent = 'Broadcasting offer...';
  try {
    const result = await broadcastOffer(offer);
    button.classList.add('sent');
    button.textContent = '✓ Broadcast live';
    updateOfferStatus(result.data.offer, result);
    loadAnalytics();
  } catch (error) {
    console.error('Unable to broadcast offer', error);
    button.textContent = 'Try broadcast again';
    offerStatus.textContent = error.message || 'Offer could not be broadcast. Please try again.';
  } finally {
    button.disabled = false;
  }
});

document.querySelector('.notification').onclick = () => {
  offerStatus.textContent = 'No new merchant notifications.';
};
document.querySelector('.mobile-menu').onclick = () => {
  offerStatus.textContent = 'Ratnagiri merchant console active.';
};

// Verify authentication and load data
verifyAuth().then(authenticated => {
  if (authenticated) {
    loadActiveOffer();
    loadAnalytics();
    loadMerchantMap();
  }
});
