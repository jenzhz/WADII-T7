<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '@/services/api'

const props = defineProps({
  carparkId: {
    type: String,
    default: '1',
  },
  carparkName: {
    type: String,
    default: 'Marina Bay Carpark',
  },
  originLat: {
    type: [Number, String],
    default: null,
  },
  originLng: {
    type: [Number, String],
    default: null,
  },
  destLat: {
    type: [Number, String],
    default: 1.293,
  },
  destLng: {
    type: [Number, String],
    default: 103.857,
  },
  destinationName: {
    type: String,
    default: 'Marina Bay / Suntec City',
  },
  lotType: {
    type: String,
    default: 'C',
  },
})

const carparkDetails = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')
const lastUpdated = ref('')

const lotTypeLabel = computed(() => {
  const type = carparkDetails.value?.lotType || props.lotType
  const map = {
    C: 'Car (C)',
    Y: 'Motorcycle (Y)',
    H: 'Heavy Vehicle (H)',
  }
  return map[type] || type
})

const availabilityBadge = computed(() => {
  const lots = carparkDetails.value?.availableLots
  if (lots == null) {
    return { text: 'Availability Unknown', className: 'availability-unknown' }
  }
  if (Number(lots) === 0) {
    return { text: 'Full', className: 'availability-full' }
  }
  if (Number(lots) <= 20) {
    return { text: 'Limited Lots', className: 'availability-limited' }
  }
  return { text: 'Lots Available', className: 'availability-open' }
})

const formattedDistance = computed(() => {
  const meters = Number(carparkDetails.value?.walkingDistance)
  if (!Number.isFinite(meters)) return '—'
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km (${meters} m)`
  }
  return `${meters} m`
})

async function fetchCarparkDetails() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const params = {
      carparkId: props.carparkId,
      destLat: props.destLat,
      destLng: props.destLng,
      destinationName: props.destinationName,
      lotType: props.lotType,
    }

    if (props.originLat !== null && props.originLat !== '' && props.originLng !== null && props.originLng !== '') {
      params.originLat = props.originLat
      params.originLng = props.originLng
    }

    const { data: responsePayload } = await api.get('/carpark-details', { params })

    carparkDetails.value = responsePayload?.data || responsePayload
    lastUpdated.value = new Date().toLocaleTimeString('en-SG')
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message ||
      error.message ||
      'Unable to fetch carpark details and walking route.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchCarparkDetails()
})

watch(
  () => [
    props.carparkId,
    props.originLat,
    props.originLng,
    props.destLat,
    props.destLng,
    props.lotType,
  ],
  () => {
    fetchCarparkDetails()
  }
)
</script>

<template>
  <div class="carpark-details-component">
    <!-- Carpark Header Card -->
    <div class="card details-header mb-4">
      <div class="card-body p-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span class="badge id-badge">
              ID: {{ carparkDetails?.carparkId || carparkId }}
            </span>
            <span v-if="carparkDetails?.agency" class="badge agency-badge">
              {{ carparkDetails.agency }}
            </span>
            <span class="badge type-badge">{{ lotTypeLabel }}</span>
          </div>
          <h1 class="h2 fw-bold mb-1">
            {{ carparkDetails?.carparkName || carparkDetails?.name || carparkName }}
          </h1>
          <p class="text-muted mb-0">
            <span v-if="carparkDetails?.area">Area: {{ carparkDetails.area }} &bull; </span>
            Walking route to
            <strong>{{ carparkDetails?.destination?.name || destinationName }}</strong>
          </p>
        </div>

        <div class="d-flex flex-column align-items-md-end gap-2">
          <button
            type="button"
            class="btn refresh-button"
            :disabled="isLoading"
            @click="fetchCarparkDetails"
          >
            <span
              v-if="isLoading"
              class="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            ></span>
            Refresh Live Data
          </button>
          <small v-if="lastUpdated" class="text-muted">Last updated: {{ lastUpdated }}</small>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && !carparkDetails" class="card shadow-sm border-0 p-5 text-center">
      <div class="d-flex flex-column align-items-center justify-content-center">
        <div class="spinner-border text-success mb-3" role="status">
          <span class="visually-hidden">Loading carpark details...</span>
        </div>
        <p class="text-muted mb-0">
          Fetching real-time lot availability from LTA DataMall and calculating walking route via OneMap...
        </p>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="errorMessage"
      class="alert alert-danger d-flex flex-wrap justify-content-between align-items-center gap-3"
      role="alert"
    >
      <div>
        <h2 class="h6 fw-bold mb-1">Could not load carpark details</h2>
        <p class="mb-0">{{ errorMessage }}</p>
      </div>
      <button type="button" class="btn btn-danger btn-sm" @click="fetchCarparkDetails">
        Try Again
      </button>
    </div>

    <!-- Core Metrics Cards (Bootstrap Grid) -->
    <div v-if="carparkDetails" class="row g-4">
      <!-- Real-Time Available Lots -->
      <div class="col-md-4">
        <div class="card metric-card h-100">
          <div class="card-body p-4 text-center d-flex flex-column justify-content-between">
            <div>
              <p class="text-uppercase text-muted small fw-semibold mb-2">
                Real-Time Available Lots
              </p>
              <div class="metric-value lots-value my-2">
                {{ carparkDetails.availableLots ?? '—' }}
              </div>
            </div>
            <div class="mt-2">
              <span class="badge availability-pill rounded-pill px-3 py-2" :class="availabilityBadge.className">
                {{ availabilityBadge.text }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Walking Distance -->
      <div class="col-md-4">
        <div class="card metric-card h-100">
          <div class="card-body p-4 text-center d-flex flex-column justify-content-between">
            <div>
              <p class="text-uppercase text-muted small fw-semibold mb-2">Walking Distance</p>
              <div class="metric-value my-2">
                {{ formattedDistance }}
              </div>
            </div>
            <p class="text-muted small mb-0 mt-2">Calculated via OneMap Routing API</p>
          </div>
        </div>
      </div>

      <!-- Estimated Walk Time -->
      <div class="col-md-4">
        <div class="card metric-card h-100">
          <div class="card-body p-4 text-center d-flex flex-column justify-content-between">
            <div>
              <p class="text-uppercase text-muted small fw-semibold mb-2">Estimated Walk Time</p>
              <div class="metric-value my-2">
                {{ carparkDetails.walkingTime ?? '—' }}
                <span class="fs-4 fw-normal text-muted">mins</span>
              </div>
            </div>
            <p class="text-muted small mb-0 mt-2">
              Approx. {{ carparkDetails.totalTimeSeconds || (carparkDetails.walkingTime || 0) * 60 }}s pedestrian walk
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Route Summary & Turn-by-Turn Instructions -->
    <div v-if="carparkDetails" class="card route-card mt-4">
      <div class="card-header bg-white py-3 border-0">
        <h2 class="h5 mb-0 fw-semibold">Walking Route Summary</h2>
      </div>
      <div class="card-body p-4">
        <div class="row g-3 mb-3">
          <div class="col-sm-6">
            <div class="route-endpoint p-3 rounded">
              <div class="small text-muted text-uppercase fw-semibold">Origin (Carpark)</div>
              <div class="fw-bold">
                {{ carparkDetails.carparkName || carparkDetails.name || carparkName }}
              </div>
            </div>
          </div>
          <div class="col-sm-6">
            <div class="route-endpoint p-3 rounded">
              <div class="small text-muted text-uppercase fw-semibold">Destination</div>
              <div class="fw-bold">
                {{ carparkDetails.destination?.name || destinationName }}
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="carparkDetails.routeInstructions && carparkDetails.routeInstructions.length > 0"
          class="mt-3"
        >
          <h3 class="h6 fw-semibold mb-2">Turn-by-Turn Walking Directions</h3>
          <ol class="list-group list-group-numbered">
            <li
              v-for="(step, index) in carparkDetails.routeInstructions"
              :key="index"
              class="direction-step list-group-item d-flex justify-content-between align-items-start"
            >
              <div class="ms-2 me-auto">
                {{ Array.isArray(step) ? step[9] || step[0] : step }}
              </div>
              <span v-if="Array.isArray(step) && step[2]" class="badge direction-distance rounded-pill">
                {{ step[2] }}m
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.details-header,
.metric-card,
.route-card {
  border: 2px solid #174f40 !important;
  border-radius: 1.35rem;
  background: white;
  box-shadow: none !important;
}

.details-header { padding: .5rem; }
.details-header h1 { font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.035em; }
.id-badge, .type-badge { color: #10243a; background: #edf2f5; }
.agency-badge { border: 1px solid #20c980; color: #087a58; background: #eafbf4; }
.refresh-button { min-height: 3rem; padding-inline: 1.25rem; border: 1.5px solid #174f40; border-radius: .8rem; color: #073f32; background: white; font-weight: 700; }
.refresh-button:hover { border-color: #0a9e70; background: #eafbf4; }

.metric-card { min-height: 12rem; padding: .25rem; }
.metric-value { color: #10243a; font-size: clamp(2.6rem, 6vw, 4.25rem); font-weight: 800; line-height: 1; letter-spacing: -.05em; }
.lots-value { color: #087a58; }
.availability-pill { border: 1px solid transparent; }
.availability-open { border-color: #20c980; color: #087a58; background: #eafbf4; }
.availability-limited { border-color: #e1ac3a; color: #795300; background: #fff5d9; }
.availability-full { border-color: #d65a5a; color: #9d2929; background: #fdeaea; }
.availability-unknown { border-color: #81908b; color: #52606d; background: #edf2f0; }

.route-card { overflow: hidden; }
.route-card .card-header { padding: 1.5rem 1.75rem .5rem; }
.route-card .card-body { padding: 1rem 1.75rem 1.75rem !important; }
.route-endpoint { min-height: 5rem; background: #edf8f3; }
.direction-step { padding: .95rem 0; border-width: 0 0 1px; border-color: #cfe4dc; background: transparent; }
.direction-distance { color: #087a58; background: #dff7ec; }

@media (max-width: 767px) {
  .details-header .card-body { align-items: flex-start !important; }
  .details-header .align-items-md-end { align-items: flex-start !important; }
}
</style>

