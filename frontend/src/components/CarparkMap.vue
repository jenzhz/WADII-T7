<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import destinationIconUrl from '@/assets/destination-pin.svg'
import polyline from '@mapbox/polyline'

const props = defineProps({
  carparks: { type: Array, default: () => [] },
  destination: { type: Object, default: null },
  contextQuery: { type: Object, default: () => ({}) },
  routeGeometry: { type: String, default: null },
  showActions: { type: Boolean, default: true },
  showRank: { type: Boolean, default: false },
  activeCarparkId: { type: String, default: null },
  mapHeight: { type: String, default: '30rem' },
});
const emit = defineEmits(['select-carpark']);
const router = useRouter();
const mapElement = ref(null);
let map;
let markerLayer;
let routeLayer;
let resizeObserver;
const destinationIcon = L.icon({
  iconUrl: destinationIconUrl,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
});




const PIN_COLOURS = {
  available: { fill: '#0f9b6e', text: '#ffffff' },
  full: { fill: '#c0392b', text: '#ffffff' },
  top: { fill: '#f5b400', text: '#3d2c00' },
  other: { fill: '#0f5c4d', text: '#ffffff' },
}

function pinIcon(tone, label, { active = false } = {}) {
  const colour = PIN_COLOURS[tone]
  const size = active ? 1.2 : 1
  const width = Math.round(34 * size)
  const height = Math.round(42 * size)
  return L.divIcon({
    className: `cc-pin${active ? ' cc-pin--active' : ''}`,
    html: `<svg viewBox="0 0 32 40" width="${width}" height="${height}" aria-hidden="true">
        <path d="M16 1C7.7 1 1 7.7 1 16c0 10 15 23 15 23s15-13 15-23C31 7.7 24.3 1 16 1Z" fill="${colour.fill}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
        <text x="16" y="20.5" text-anchor="middle" font-size="${String(label).length > 1 ? 11 : 13}" font-weight="800" font-family="system-ui, -apple-system, Segoe UI, sans-serif" fill="${colour.text}">${escapeHtml(label)}</text>
      </svg>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 4],
  })
}

const legendItems = computed(() => props.showRank
  ? [
      { label: 'Recommended', symbol: '★', ...legendColour('top') },
      { label: 'Other choices', symbol: '', ...legendColour('other') },
      { label: 'Full', symbol: '', ...legendColour('full') },
    ]
  : [
      { label: 'Lots available', symbol: 'P', ...legendColour('available') },
      { label: 'Full or unavailable', symbol: 'P', ...legendColour('full') },
    ])
function legendColour(tone) {
  return { fill: PIN_COLOURS[tone].fill, text: PIN_COLOURS[tone].text }
}

function rankIcon(carpark) {
  const full = carpark.availableLots != null && Number(carpark.availableLots) === 0
  const tone = full ? 'full' : carpark.rank === 1 ? 'top' : 'other'
  return pinIcon(tone, carpark.rank === 1 ? '★' : carpark.rank, { active: carpark.id === props.activeCarparkId })
}

const POPUP_OPTIONS = { className: 'cc-popup', minWidth: 200, maxWidth: 260 }

function getRoutePoints() {
  if (!props.routeGeometry) return []
  return polyline.decode(props.routeGeometry)
    .map(([latitude, longitude]) => [latitude, longitude])
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character])
}

function renderMarkers() {
  if (!map) {
    return;
  }

  markerLayer?.clearLayers();
  markerLayer = L.layerGroup().addTo(map);
  routeLayer?.remove();

  const bounds = []
  const routePoints = getRoutePoints()

  if (routePoints.length > 0) {
    routeLayer = L.polyline(routePoints, {
      color: '#0a9e70',
      weight: 6,
    }).addTo(map)
    bounds.push(...routePoints)
  }

  if (props.destination && Number.isFinite(props.destination.latitude) && Number.isFinite(props.destination.longitude)) {
    L.marker([props.destination.latitude, props.destination.longitude], {
      icon: destinationIcon,
      title: props.destination.label || props.destination.name || 'Selected destination',
      alt: 'Destination',
      zIndexOffset: 1000,
    }).bindPopup(
      `<div class="cc-popup-body">
        <span class="cc-popup-tag cc-popup-tag--destination">Destination</span>
        <strong class="cc-popup-title">${escapeHtml(props.destination.label || props.destination.name || 'Selected destination')}</strong>
        <span class="cc-popup-note">Carparks are shown around this point</span>
      </div>`,
      POPUP_OPTIONS,
    ).addTo(markerLayer);
    bounds.push([props.destination.latitude, props.destination.longitude]);
  }

  for (const carpark of props.carparks) {
    if (!Number.isFinite(carpark.latitude) || !Number.isFinite(carpark.longitude)) continue
    const unavailable = carpark.availableLots == null || Number(carpark.availableLots) === 0
    const ranked = props.showRank && carpark.rank != null
    const marker = L.marker([carpark.latitude, carpark.longitude], {
      icon: ranked
        ? rankIcon(carpark)
        : pinIcon(unavailable ? 'full' : 'available', 'P', { active: carpark.id === props.activeCarparkId }),
      title: ranked ? `#${carpark.rank} ${carpark.name}` : carpark.name,
      zIndexOffset: ranked ? 500 - carpark.rank : 0,
    })
    const detailsHref = router.resolve({
      name: 'carpark-details',
      params: { id: carpark.id },
      query: props.contextQuery,
    }).href
    const popupActions = props.showActions
      ? `<div class="cc-popup-actions">
          <a class="cc-popup-btn cc-popup-btn--primary show-route" href="#" data-action="show-route">Show walking route</a>
          <a class="cc-popup-btn view-details" href="${escapeHtml(detailsHref)}">View details</a>
        </div>`
      : ''
    const rankTag = ranked
      ? `<span class="cc-popup-tag ${carpark.rank === 1 ? 'cc-popup-tag--top' : ''}">${carpark.rank === 1 ? '★ Recommended' : `#${escapeHtml(carpark.rank)}`}</span>`
      : ''
    const lots = carpark.availableLots
    const lotsTone = lots == null ? 'unknown' : Number(lots) === 0 ? 'full' : Number(lots) <= 20 ? 'limited' : 'available'
    const lotsText = lots == null ? 'Unknown' : Number(lots) === 0 ? 'Full' : escapeHtml(lots)
    marker.bindPopup(
      `<div class="cc-popup-body">
        ${rankTag}
        <strong class="cc-popup-title">${escapeHtml(carpark.name)}</strong>
        <span class="cc-popup-lots">Available lots <b class="cc-lots cc-lots--${lotsTone}">${lotsText}</b></span>
        ${popupActions}
      </div>`,
      POPUP_OPTIONS,
    );
    if (props.showActions) {
      marker.on('popupopen', ({ popup }) => {
        const routeLink = popup.getElement()?.querySelector('[data-action="show-route"]')
        routeLink?.addEventListener('click', (event) => {
          event.preventDefault()
          emit('select-carpark', carpark)
        }, { once: true })
      })
    }
    marker.addTo(markerLayer);
    bounds.push([carpark.latitude, carpark.longitude]);
  }

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 })
  }
}

onMounted(() => {
  map = L.map(mapElement.value).setView([1.3521, 103.8198], 18);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  renderMarkers();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => map?.invalidateSize({ pan: false }))
    resizeObserver.observe(mapElement.value)
  }
})

watch(() => [props.carparks, props.destination, props.routeGeometry, props.activeCarparkId], renderMarkers, { deep: true });

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  markerLayer?.clearLayers()
  routeLayer?.remove()
  map?.remove()
})

</script>

<template>
  <div class="map-wrapper">
    <div ref="mapElement" class="map" :style="{ minHeight: mapHeight }" aria-label="Carpark map"></div>
    <div class="map-legend" aria-label="Map marker legend">
      <span><img :src="destinationIconUrl" class="legend-destination" alt="" /> Destination</span>
      <!-- Legend uses small copies of the real map pins -->
      <span v-for="item in legendItems" :key="item.label">
        <svg class="legend-pin-icon" viewBox="0 0 32 40" aria-hidden="true">
          <path d="M16 1C7.7 1 1 7.7 1 16c0 10 15 23 15 23s15-13 15-23C31 7.7 24.3 1 16 1Z" :fill="item.fill" stroke="#fff" stroke-width="2" stroke-linejoin="round" />
          <text x="16" y="20.5" text-anchor="middle" font-size="13" font-weight="800" font-family="system-ui, -apple-system, Segoe UI, sans-serif" :fill="item.text">{{ item.symbol }}</text>
        </svg>
        {{ item.label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
}

.map {
  min-height: 30rem;
  border: 1px solid #d9e3df;
  border-radius: 1rem;
  box-shadow: 0 10px 30px #173e3015;
}

.map-legend {
  position: absolute;
  z-index: 500;
  left: 1rem;
  bottom: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: .75rem;
  padding: .65rem .8rem;
  border-radius: .75rem;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 4px 16px #173e3025;
  font-size: .75rem;
}

.map-legend span {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
}

.legend-destination {
  width: 1rem;
  height: 1.25rem;
  filter: drop-shadow(0 1px 1.5px rgba(7, 63, 50, .3));
}

@media (max-width: 575px) {
  .map-legend {
    right: 1rem;
    gap: .5rem;
  }
}

.legend-pin-icon { width: 1rem; height: 1.25rem; flex-shrink: 0; filter: drop-shadow(0 1px 1.5px rgba(7, 63, 50, .3)); }

/* Pin markers (Leaflet adds them outside this component, so :global) */
:global(.cc-pin) { background: none; border: 0; }
:global(.cc-pin svg) { display: block; filter: drop-shadow(0 3px 4px rgba(7, 63, 50, .35)); transition: transform .15s; transform-origin: bottom center; }
:global(.cc-pin:hover svg) { transform: scale(1.1); }
:global(.cc-pin--active svg) { filter: drop-shadow(0 0 0 #2cd790) drop-shadow(0 0 6px #2cd790); }

/* Popups (Leaflet renders them outside this component, so :global) */
:global(.cc-popup .leaflet-popup-content-wrapper) { padding: 0; border: 1.5px solid #174f40; border-radius: .9rem; box-shadow: 0 12px 28px #073f322e; }
:global(.cc-popup .leaflet-popup-content) { margin: 0; font-family: inherit; }
:global(.cc-popup .leaflet-popup-tip) { border: 1.5px solid #174f40; box-shadow: none; }
:global(.cc-popup a.leaflet-popup-close-button) { top: .35rem; right: .35rem; color: #52665d; }
:global(.cc-popup-body) { display: grid; gap: .35rem; padding: .85rem 1rem .9rem; }
:global(.cc-popup-tag) { justify-self: start; padding: .15rem .55rem; border-radius: 2rem; color: #0f5c4d; background: #e6f4f0; font-size: .7rem; font-weight: 800; letter-spacing: .02em; }
:global(.cc-popup-tag--top) { color: #3d2c00; background: #fde9a6; }
:global(.cc-popup-tag--destination) { color: #5b21b6; background: #ede9fe; text-transform: uppercase; }
:global(.cc-popup-title) { padding-right: 1rem; color: #10243a; font-size: .95rem; line-height: 1.3; }
:global(.cc-popup-note) { color: #63716a; font-size: .78rem; }
:global(.cc-popup-lots) { color: #52665d; font-size: .8rem; }
:global(.cc-lots) { margin-left: .2rem; font-size: .9rem; }
:global(.cc-lots--available) { color: #0f7a5f; }
:global(.cc-lots--limited) { color: #9a6700; }
:global(.cc-lots--full) { color: #b42318; }
:global(.cc-lots--unknown) { color: #52606d; }
:global(.cc-popup-actions) { display: grid; gap: .4rem; margin-top: .35rem; }
:global(.cc-popup-btn) { display: block; padding: .45rem .6rem; border: 1.5px solid #174f40; border-radius: .6rem; color: #123d32 !important; background: white; font-size: .8rem; font-weight: 700; text-align: center; text-decoration: none; }
:global(.cc-popup-btn:hover) { background: #e7f8f0; }
:global(.cc-popup-btn--primary) { border-color: #07875f; color: #06271f !important; background: #2cd790; }
:global(.cc-popup-btn--primary:hover) { background: #25c985; }

</style>
