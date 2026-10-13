<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const mapElement = ref(null)
let map

onMounted(() => {
  map = L.map(mapElement.value).setView([1.3521, 103.8198], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
})

onBeforeUnmount(() => map?.remove())
</script>

<template>
  <div ref="mapElement" class="placeholder-map rounded border" aria-label="Placeholder Singapore map"></div>
</template>

<style scoped>
.placeholder-map {
  min-height: 24rem;
}
</style>
