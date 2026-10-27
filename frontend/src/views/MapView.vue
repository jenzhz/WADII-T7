<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import CarparkMap from '@/components/CarparkMap.vue'

const route = useRoute()
const router = useRouter()
const carparks = ref([])
const loading = ref(false)
const error = ref('')

const destination = ref({
  latitude: Number(route.query.latitude) || 1.3521, 
  longitude: Number(route.query.longitude) || 103.8198,
})

async function updateDestination(value) {
  destination.value = value
  await router.replace({
    query: {
      ...route.query,
      latitude: String(value.latitude),
      longitude: String(value.longitude),
    },
  })
  await loadCarparks()
}

async function loadCarparks() {
  if (!Number.isFinite(destination.value.latitude) || !Number.isFinite(destination.value.longitude)) {
    error.value = 'Open the map from a destination search to show nearby carparks.'
    return
  }

  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/carparks/nearby', {
      params: { ...destination.value, vehicleType: route.query.vehicleType || 'C', radius: 5000 },
    })
    carparks.value = data.carparks || []
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Unable to load carparks.'
  } finally {
    loading.value = false
  }
}

onMounted(loadCarparks)
</script>

<template>
  <section>
    <h1>Map Explorer</h1>
    <p class="lead">Nearby carparks are marked around your destination.</p>
    <p v-if="loading">Loading carparks...</p>
    <p v-else-if="error" class="text-danger" role="alert">{{ error }}</p>
    <CarparkMap v-else :carparks="carparks" :destination="destination" :context-query="route.query"
      @update:destination="updateDestination" />
  </section>
</template>

