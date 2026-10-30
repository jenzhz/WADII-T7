<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import carparkIconUrl from '@/assets/parking-location-svgrepo-com.svg'

const props = defineProps({ locations: { type: Array, default: () => [] } })
const router = useRouter()
const mapElement = ref(null)
const reviewIcon = L.icon({
  iconUrl: carparkIconUrl,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
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
    <span class="review-map-legend"><img :src="carparkIconUrl" alt="" /> Reviewed carpark</span>
  </div>
</template>

<style scoped>
.review-map-wrapper { position: relative; }
.review-map { height: clamp(16rem, 35vw, 21rem); border: 1px solid #b8cec5; border-radius: 1rem; background: #edf5ef; }
.review-map-legend { position: absolute; z-index: 500; left: .75rem; bottom: 1.5rem; display: inline-flex; align-items: center; gap: .4rem; padding: .45rem .65rem; border: 1px solid #d6e5df; border-radius: .65rem; color: #174f40; background: #fffffff2; font-size: .75rem; font-weight: 650; pointer-events: none; }
.review-map-legend img { width: 1rem; height: 1rem; }
.review-map :deep(.leaflet-popup-content-wrapper) { border: 1px solid #b8cec5; border-radius: .85rem; }
.review-map :deep(.profile-map-popup) { color: #17202a; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.review-map :deep(.profile-map-popup strong) { display: block; line-height: 1.4; overflow-wrap: anywhere; }
.review-map :deep(.profile-map-popup p) { margin: .65rem 0; color: #087a58; font-weight: 750; }
.review-map :deep(.profile-map-popup a) { display: inline-block; margin-bottom: .25rem; color: #087a58; font-weight: 750; text-decoration: none; }
.review-map :deep(.profile-map-popup a:hover) { text-decoration: underline; }
</style>
