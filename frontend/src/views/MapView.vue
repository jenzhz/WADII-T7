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
    <div class="mb-4">
      <p class="text-uppercase text-primary fw-semibold small mb-2">Explore parking</p>
      <h1>Map Explorer</h1>
      <p class="text-secondary mb-0">Carparks around the destination selected on the Search page.</p>
    </div>

    <div class="map-controls card card-body mb-3 shadow-sm">
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
          <button class="btn btn-success w-100" type="button" :disabled="loading" @click="applyFilters">Apply</button>
        </div>
      </div>
    </div>

    <div class="d-flex flex-wrap justify-content-between gap-2 mb-2">
      <strong>{{ destination.label }}</strong>
      <span class="small text-secondary">{{ carparks.length }} carparks within {{ Number(radius) / 1000 }} km</span>
    </div>

    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
    <div v-if="loading" class="map-loading">Loading carparks…</div>
    <CarparkMap v-else :carparks="carparks" :destination="destination" :context-query="route.query" />
  </section>
</template>

<style scoped>
.map-page { max-width: 1140px; margin: auto; }
.map-controls { border: 1px solid #d9e3df; border-radius: 1rem; }
.map-loading { display: grid; place-items: center; min-height: 30rem; border: 1px solid #d9e3df; border-radius: 1rem; color: #63716a; background: #f4f7f6; }
</style>

