<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import carparkIconUrl from '@/assets/parking-location-svgrepo-com.svg'

const props = defineProps({
    carparks: { type: Array, default: () => [] },
    destination: { type: Object, default: null },
    contextQuery: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:destination'])

const router = useRouter()
const mapElement = ref(null)
let map
let markerLayer
let destinationMarker
const carparkIcon = L.icon({
    iconUrl: carparkIconUrl,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    className: 'carpark-marker-icon',
})

const unavailableCarparkIcon = L.icon({
    iconUrl: carparkIconUrl,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    className: 'carpark-marker-icon carpark-marker-icon--unavailable',
})

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character])
}

function renderMarkers() {
  if (!map) return
  markerLayer?.clearLayers()
  markerLayer = L.layerGroup().addTo(map)
  destinationMarker = null

  const bounds = []
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
      marker.bindPopup(`<strong>${escapeHtml(carpark.name)}</strong><br>Available lots: ${escapeHtml(carpark.availableLots ?? 'Unavailable')}<br><a href="${escapeHtml(detailsHref)}">View details</a>`)
      marker.addTo(markerLayer)
      bounds.push([carpark.latitude, carpark.longitude])
    }

    // destination marker
    if (props.destination && Number.isFinite(props.destination.latitude) && Number.isFinite(props.destination.longitude)) {
      destinationMarker = L.circleMarker([props.destination.latitude, props.destination.longitude], {
          radius: 9,
          color: '#a33b2f',
          fillColor: '#dc6b5d',
          fillOpacity: 0.95,
          weight: 2,
      }).bindPopup('<strong>Destination</strong>').addTo(markerLayer)
      bounds.push([props.destination.latitude, props.destination.longitude])
    }

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 })
}

function moveDestination(event) {
    const latitude = Number(event.latlng.lat.toFixed(6))
    const longitude = Number(event.latlng.lng.toFixed(6))
    destinationMarker?.setLatLng([latitude, longitude])
    emit('update:destination', { latitude, longitude })
}

onMounted(() => {
    map = L.map(mapElement.value).setView([1.3521, 103.8198], 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    map.on('click', moveDestination)
    renderMarkers()
})

watch(() => props.carparks, renderMarkers, { deep: true })

onBeforeUnmount(() => {
    markerLayer?.clearLayers()
    map?.off('click', moveDestination)
    map?.remove()
})
</script>

<template>
  <div ref="mapElement" class="map rounded border" aria-label="Carpark map"></div>
</template>

<style scoped>
.map {
  min-height: 30rem;
}

:global(.carpark-marker-icon--unavailable) {
  filter: brightness(0) saturate(100%) invert(25%) sepia(86%) saturate(2115%) hue-rotate(343deg) brightness(89%) contrast(89%);
}
</style>
