<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import CarparkMap from '@/components/CarparkMap.vue'

const route = useRoute()
const router = useRouter()
let savedSearch = null
try {
  savedSearch = JSON.parse(localStorage.getItem('carparkcompare.search'))
} catch {
  localStorage.removeItem('carparkcompare.search')
}
const savedDestination = savedSearch?.selectedDestination
const routeLatitude = Number(route.query.latitude)
const routeLongitude = Number(route.query.longitude)
const hasRouteDestination = Number.isFinite(routeLatitude) && Number.isFinite(routeLongitude)
const fallbackLatitude = Number(savedDestination?.LATITUDE)
const fallbackLongitude = Number(savedDestination?.LONGITUDE)
const hasSavedDestination = Number.isFinite(fallbackLatitude) && Number.isFinite(fallbackLongitude)
const carparks = ref([])
const loading = ref(false)
const error = ref('')
const radius = ref(['500', '1000', '2000', '5000'].includes(String(route.query.radius))
  ? String(route.query.radius)
  : '1000')
const initialVehicleType = route.query.vehicleType || savedSearch?.vehicleType
const vehicleType = ['C', 'Y', 'H'].includes(initialVehicleType)
  ? initialVehicleType
  : 'C'

const destination = ref({
  latitude: hasRouteDestination ? routeLatitude : fallbackLatitude,
  longitude: hasRouteDestination ? routeLongitude : fallbackLongitude,
  label: String(route.query.destination || savedDestination?.SEARCHVAL || 'Searched destination'),
})

async function loadCarparks() {
  if (!Number.isFinite(destination.value.latitude) || !Number.isFinite(destination.value.longitude)) {
    error.value = 'Open the map from a destination search to show nearby carparks.'
    return
  }

  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/carparks/nearby', {
      params: {
        ...destination.value,
        vehicleType,
        radius: Number(radius.value),
      },
    })
    carparks.value = data.carparks || []
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Unable to load carparks.'
  } finally {
    loading.value = false
  }
}

async function applyFilters() {
  await router.replace({
    query: {
      ...route.query,
      radius: radius.value,
    },
  })
  await loadCarparks()
}

onMounted(async () => {
  if (!hasRouteDestination && hasSavedDestination) {
    await router.replace({
      query: {
        destination: destination.value.label,
        latitude: String(destination.value.latitude),
        longitude: String(destination.value.longitude),
        vehicleType,
        radius: radius.value,
      },
    })
  }
  await loadCarparks()
})
</script>

<template>
  <section class="map-page">
    <div class="map-toolbar">
      <div>
        <h1>Map explorer</h1>
        <p class="text-secondary mb-0">Find parking around your selected destination.</p>
      </div>

      <div class="map-controls card card-body">
        <div class="row g-3 align-items-end">
          <div class="col-sm-9">
            <label class="form-label" for="map-radius">Distance from destination</label>
            <select id="map-radius" v-model="radius" class="form-select">
              <option value="500">Within 500 m</option>
              <option value="1000">Within 1 km</option>
              <option value="2000">Within 2 km</option>
              <option value="5000">Within 5 km</option>
            </select>
          </div>
          <div class="col-sm-3">
            <button class="btn map-apply w-100" type="button" :disabled="loading" @click="applyFilters">Apply</button>
          </div>
        </div>
      </div>
    </div>

    <div class="map-summary d-flex flex-wrap justify-content-between gap-2 mb-2">
      <strong>{{ destination.label }}</strong>
      <span class="small text-secondary">{{ carparks.length }} carparks within {{ Number(radius) / 1000 }} km</span>
    </div>

    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
    <div v-if="loading" class="map-loading">Loading carparks…</div>
    <CarparkMap v-else :carparks="carparks" :destination="destination" :context-query="route.query" />
  </section>
</template>

<style scoped>
.map-page { min-height: 100%; padding: 1.75rem clamp(1rem, 3vw, 3rem) 2.5rem; background-color: #f0fbf6; background-image: radial-gradient(#bfe9d7 1.1px, transparent 1.1px); background-size: 19px 19px; }
.map-toolbar { display: grid; grid-template-columns: 1fr minmax(22rem, 32rem); align-items: center; gap: 1.5rem; margin-bottom: 1rem; }
.map-toolbar h1 { font-size: clamp(2.5rem, 4vw, 3.25rem); margin-bottom: .5rem; }
.map-page :deep(.map) { height: calc(100dvh - 18rem); min-height: 26rem; border: 2px solid #174f40; }
.map-controls { padding: 1.25rem; border: 2px solid #174f40; border-radius: 1.25rem; }
.map-controls .form-label { color: #173e30; font-size: .85rem; font-weight: 750; }
.map-controls .form-select { min-height: 3.2rem; border: 1.5px solid #174f40; border-radius: .8rem; color: #173e30; }
.map-apply { min-height: 3.2rem; border: 1px solid #07875f; border-radius: .8rem; color: #06271f; background: #2cd790; font-weight: 750; }
.map-apply:hover:not(:disabled) { border-color: #067651; color: #06271f; background: #25c985; }
.map-summary strong { color: #173e30; }
.map-loading { display: grid; place-items: center; min-height: 30rem; border: 2px solid #174f40; border-radius: 1rem; color: #63716a; background: white; }

@media (max-width: 767px) {
  .map-toolbar { grid-template-columns: 1fr; gap: 1rem; }
  .map-page :deep(.map) { height: 65dvh; min-height: 24rem; }
}
</style>

