<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({ locations: { type: Array, default: () => [] } })
const router = useRouter()
const mapElement = ref(null)
// Same green "P" pin as the Results / Map / Compare maps (see CarparkMap.vue)
const PIN_PATH = 'M16 1C7.7 1 1 7.7 1 16c0 10 15 23 15 23s15-13 15-23C31 7.7 24.3 1 16 1Z'
const reviewIcon = L.divIcon({
  className: 'cc-pin',
  html: `<svg viewBox="0 0 32 40" width="34" height="42" aria-hidden="true">
      <path d="${PIN_PATH}" fill="#0f9b6e" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
      <text x="16" y="20.5" text-anchor="middle" font-size="13" font-weight="800" font-family="system-ui, -apple-system, Segoe UI, sans-serif" fill="#fff">P</text>
    </svg>`,
  iconSize: [34, 42],
  iconAnchor: [17, 42],
  popupAnchor: [0, -38],
})
let map
let markers
let resizeObserver

function renderLocations() {
  if (!map) return
  markers.clearLayers()
  const bounds = []

  for (const location of props.locations) {
    // Use textContent so carpark names are displayed as text inside the popup.
    const popup = document.createElement('div')
    popup.className = 'profile-map-popup'
    const name = document.createElement('strong')
    name.textContent = location.name
    popup.append(name)

    for (const review of location.reviews) {
      const score = document.createElement('p')
      score.textContent = `★ ${review.overallRating}/5`
      const link = document.createElement('a')
      link.textContent = 'View review and discussion →'
      link.href = router.resolve(review.detailsLink).href
      link.addEventListener('click', event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        router.push(review.detailsLink)
      })
      popup.append(score, link)
    }

    const coordinates = [location.latitude, location.longitude]
    L.marker(coordinates, { icon: reviewIcon, title: location.name, alt: `Reviewed carpark: ${location.name}` })
      .bindPopup(popup, { maxWidth: 280 })
      .addTo(markers)
    bounds.push(coordinates)
  }

  if (bounds.length) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 })
}

onMounted(() => {
  map = L.map(mapElement.value, { scrollWheelZoom: false }).setView([1.3521, 103.8198], 11)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
  markers = L.layerGroup().addTo(map)
  renderLocations()
  resizeObserver = new ResizeObserver(() => map.invalidateSize())
  resizeObserver.observe(mapElement.value)
})

watch(() => props.locations, renderLocations, { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  map?.remove()
})
</script>

<template>
  <div class="review-map-wrapper">
    <div ref="mapElement" class="review-map" role="region" aria-label="Map of reviewed carparks"></div>
    <span class="review-map-legend">
      <svg class="legend-pin-icon" viewBox="0 0 32 40" aria-hidden="true">
        <path :d="PIN_PATH" fill="#0f9b6e" stroke="#fff" stroke-width="2" stroke-linejoin="round" />
        <text x="16" y="20.5" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">P</text>
      </svg>
      Reviewed carpark
    </span>
  </div>
</template>

<style scoped>
.review-map-wrapper { position: relative; }
.review-map { height: clamp(16rem, 35vw, 21rem); border: 1px solid #b8cec5; border-radius: 1rem; background: #edf5ef; }
.review-map-legend { position: absolute; z-index: 500; left: .75rem; bottom: 1.5rem; display: inline-flex; align-items: center; gap: .4rem; padding: .45rem .65rem; border: 1px solid #d6e5df; border-radius: .65rem; color: #174f40; background: #fffffff2; font-size: .75rem; font-weight: 650; pointer-events: none; }
.legend-pin-icon { width: 1rem; height: 1.25rem; flex-shrink: 0; filter: drop-shadow(0 1px 1.5px rgba(7, 63, 50, .3)); }
.review-map :deep(.cc-pin) { background: none; border: 0; }
.review-map :deep(.cc-pin svg) { display: block; filter: drop-shadow(0 3px 4px rgba(7, 63, 50, .35)); transition: transform .15s; transform-origin: bottom center; }
.review-map :deep(.cc-pin:hover svg) { transform: scale(1.1); }
.review-map :deep(.leaflet-popup-content-wrapper) { border: 1px solid #b8cec5; border-radius: .85rem; }
.review-map :deep(.profile-map-popup) { color: #17202a; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.review-map :deep(.profile-map-popup strong) { display: block; line-height: 1.4; overflow-wrap: anywhere; }
.review-map :deep(.profile-map-popup p) { margin: .65rem 0; color: #087a58; font-weight: 750; }
.review-map :deep(.profile-map-popup a) { display: inline-block; margin-bottom: .25rem; color: #087a58; font-weight: 750; text-decoration: none; }
.review-map :deep(.profile-map-popup a:hover) { text-decoration: underline; }
</style>
