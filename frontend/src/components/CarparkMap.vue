<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import carparkIconUrl from '@/assets/parking-location-svgrepo-com.svg'
import polyline from '@mapbox/polyline'

const props = defineProps({
  carparks: { type: Array, default: () => [] },
  destination: { type: Object, default: null },
  contextQuery: { type: Object, default: () => ({}) },
  routeGeometry: { type: String, default: null },
  showActions: { type: Boolean, default: true },
});
const emit = defineEmits(['select-carpark']);
const router = useRouter();
const mapElement = ref(null);
let map;
let markerLayer;
let routeLayer;
const carparkIcon = L.icon({
  iconUrl: carparkIconUrl,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  className: 'carpark-marker-icon',
});

const unavailableCarparkIcon = L.icon({
  iconUrl: carparkIconUrl,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  className: 'carpark-marker-icon carpark-marker-icon--unavailable',
});

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

  // the route line
  if (routePoints.length > 0) {
    routeLayer = L.polyline(routePoints, {
      color: '#0a9e70',
      weight: 6,
    }).addTo(map)
    bounds.push(...routePoints)
  }

  // destination marker
  if (props.destination && Number.isFinite(props.destination.latitude) && Number.isFinite(props.destination.longitude)) {
    L.circleMarker([props.destination.latitude, props.destination.longitude], {
      radius: 18,
      stroke: false,
      fillColor: '#1677ff',
      fillOpacity: 0.2,
    }).addTo(markerLayer);
    L.circleMarker([props.destination.latitude, props.destination.longitude], {
      radius: 10,
      color: '#ffffff',
      fillColor: '#1677ff',
      fillOpacity: 1,
      weight: 4,
    }).bindPopup(`<strong>${escapeHtml(props.destination.label || 'Selected destination')}</strong><br>Search centre`).addTo(markerLayer);
    bounds.push([props.destination.latitude, props.destination.longitude]);
  }

  for (const carpark of props.carparks) {
    // carpark marker
    if (!Number.isFinite(carpark.latitude) || !Number.isFinite(carpark.longitude)) continue
    const unavailable = carpark.availableLots == null || Number(carpark.availableLots) === 0
    const marker = L.marker([carpark.latitude, carpark.longitude], {
      icon: unavailable ? unavailableCarparkIcon : carparkIcon,
    })
    const detailsHref = router.resolve({
      name: 'carpark-details',
      params: { id: carpark.id },
      query: props.contextQuery,
    }).href
    const popupActions = props.showActions
      ? `<br><a class="view-details" href="${escapeHtml(detailsHref)}">View details</a><br><a class="show-route" href="#" data-action="show-route">Show walking route</a>`
      : ''
    marker.bindPopup(`<strong>${escapeHtml(carpark.name)}</strong><br>Available lots: ${escapeHtml(carpark.availableLots ?? 'Unavailable')}${popupActions}`);
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
})

watch(() => [props.carparks, props.routeGeometry], renderMarkers, { deep: true });

onBeforeUnmount(() => {
  markerLayer?.clearLayers()
  routeLayer?.remove()
  map?.remove()
})

</script>

<template>
  <div class="map-wrapper">
    <div ref="mapElement" class="map" aria-label="Carpark map"></div>
    <div class="map-legend" aria-label="Map marker legend">
      <span><i class="legend-dot destination"></i> Destination</span>
      <span><i class="legend-pin available"></i> Lots available</span>
      <span><i class="legend-pin unavailable"></i> Full or unavailable</span>
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

.legend-dot {
  width: .8rem;
  height: .8rem;
  border-radius: 50%;
  background: #1677ff;
  box-shadow: 0 0 0 3px #1677ff33;
}

.legend-pin {
  width: .65rem;
  height: .85rem;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
}

.legend-pin.available {
  background: #198754;
}

.legend-pin.unavailable {
  background: #c0392b;
}

@media (max-width: 575px) {
  .map-legend {
    right: 1rem;
    gap: .5rem;
  }
}

:global(.carpark-marker-icon--unavailable) {
  filter: brightness(0) saturate(100%) invert(25%) sepia(86%) saturate(2115%) hue-rotate(343deg) brightness(89%) contrast(89%);
}
</style>
