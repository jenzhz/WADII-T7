<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '@/services/api'
import { getCurrentUser } from '@/services/auth'
import RateSchedule from '@/components/RateSchedule.vue'

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
    default: null,
  },
  destLng: {
    type: [Number, String],
    default: null,
  },
  destinationName: {
    type: String,
    default: '',
  },
  lotType: {
    type: String,
    default: 'C',
  },
  hasEvCharger: {
    type: Boolean,
    default: false,
  },
})

const carparkDetails = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')
const lastUpdated = ref('')
const signedIn = Boolean(getCurrentUser())
const carparkFavourite = ref(null)
const favouriteSaving = ref(false)
const favouriteStatus = ref('')
const favouriteError = ref(false)

const showEvLeaf = computed(() =>
  Boolean(carparkDetails.value?.hasEvCharger ?? props.hasEvCharger)
)

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
      lotType: props.lotType,
    }

    if (props.destLat !== null && props.destLat !== '' && props.destLng !== null && props.destLng !== '') {
      params.destLat = props.destLat
      params.destLng = props.destLng
      params.destinationName = props.destinationName
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

async function loadCarparkFavourite() {
  if (!signedIn) return
  try {
    const { data } = await api.get('/favourites')
    carparkFavourite.value = data.favourites.find(
      item => item.type === 'carpark' && item.carparkId === props.carparkId,
    ) || null
  } catch {
    carparkFavourite.value = null
  }
}

async function toggleCarparkFavourite() {
  if (!carparkDetails.value || favouriteSaving.value) return
  favouriteSaving.value = true
  favouriteStatus.value = ''
  favouriteError.value = false
  try {
    if (carparkFavourite.value) {
      await api.delete(`/favourites/${carparkFavourite.value.id}`)
      carparkFavourite.value = null
      favouriteStatus.value = 'Removed from favourites.'
    } else {
      const latitude = Number(carparkDetails.value.coordinates?.latitude)
      const longitude = Number(carparkDetails.value.coordinates?.longitude)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('This carpark does not have valid coordinates.')
      }
      const { data } = await api.post('/favourites', {
        type: 'carpark',
        label: carparkDetails.value.carparkName || carparkDetails.value.name || props.carparkName,
        carparkId: props.carparkId,
        latitude,
        longitude,
      })
      carparkFavourite.value = data.favourite
      favouriteStatus.value = 'Added to favourites.'
    }
  } catch (error) {
    favouriteError.value = true
    favouriteStatus.value = error.response?.data?.message || error.message || 'Unable to update favourite.'
  } finally {
    favouriteSaving.value = false
  }
}

onMounted(() => {
  fetchCarparkDetails()
  loadCarparkFavourite()
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
    favouriteStatus.value = ''
    loadCarparkFavourite()
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
          <h1 class="h2 fw-bold mb-1 d-flex align-items-center gap-2 flex-wrap">
            <span>{{ carparkDetails?.carparkName || carparkDetails?.name || carparkName }}</span>
            <span
              v-if="showEvLeaf"
              class="ev-leaf-badge"
              title="EV charging point available"
              aria-label="EV charging point available"
            >
              <svg class="ev-leaf-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66l.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8Z"
                />
              </svg>
            </span>
          </h1>
          <p v-if="carparkDetails?.destination" class="text-muted mb-0">
            <span v-if="carparkDetails?.area">Area: {{ carparkDetails.area }} &bull; </span>
            Walking route to
            <strong>{{ carparkDetails?.destination?.name || destinationName }}</strong>
          </p>
        </div>

        <div class="d-flex flex-column align-items-md-end gap-2">
          <button
            v-if="signedIn"
            type="button"
            class="detail-heart-button"
            :class="{ active: carparkFavourite }"
            :disabled="favouriteSaving || !carparkDetails"
            @click="toggleCarparkFavourite"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9C.9 8.4 2.8 5 6.4 5c2.1 0 3.7 1.2 4.6 2.4C11.9 6.2 13.5 5 15.6 5c3.6 0 5.5 3.4 3.9 7-2 4.4-7.5 9-7.5 9Z" /></svg>
            {{ favouriteSaving ? 'Saving…' : carparkFavourite ? 'Favourited' : 'Add to favourites' }}
          </button>
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
          <small v-if="favouriteStatus" :class="favouriteError ? 'text-danger' : 'text-success'">{{ favouriteStatus }}</small>
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
                {{ carparkDetails.walkingTime ?? '—' }} mins
              </div>
            </div>
            <p class="text-muted small mb-0 mt-2">
              Approx. {{ carparkDetails.totalTimeSeconds || (carparkDetails.walkingTime || 0) * 60 }}s pedestrian walk
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Parking Rates -->
    <div v-if="carparkDetails?.rate" class="card route-card mt-4">
      <div class="card-header bg-white py-3 border-0">
        <h2 class="h5 mb-0 fw-semibold">Parking Rates</h2>
      </div>
      <div class="card-body p-4 pt-0">
        <RateSchedule :rate="carparkDetails.rate" />
      </div>
    </div>

    <!-- Route Summary & Turn-by-Turn Instructions -->
    <div v-if="carparkDetails?.destination" class="card route-card mt-4">
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
.ev-leaf-badge { display: inline-flex; align-items: center; justify-content: center; width: 2.15rem; height: 2.15rem; border-radius: 50%; background: #dcfce7; color: #15803d; flex-shrink: 0; }
.ev-leaf-icon { width: 1.35rem; height: 1.35rem; }
.id-badge, .type-badge { color: #10243a; background: #edf2f5; }
.agency-badge { border: 1px solid #20c980; color: #087a58; background: #eafbf4; }
.refresh-button { min-height: 3rem; padding-inline: 1.25rem; border: 1.5px solid #174f40; border-radius: .8rem; color: #073f32; background: white; font-weight: 700; }
.refresh-button:hover { border-color: #0a9e70; background: #eafbf4; }
.detail-heart-button { display: inline-flex; min-height: 3rem; align-items: center; gap: .5rem; padding: .65rem 1rem; border: 1.5px solid #c0536d; border-radius: .8rem; color: #a92d4c; background: white; font-weight: 750; }
.detail-heart-button svg { width: 1.25rem; height: 1.25rem; fill: transparent; stroke: currentColor; stroke-width: 1.8; }
.detail-heart-button:hover:not(:disabled), .detail-heart-button.active { color: #a92d4c; background: #fff0f4; }
.detail-heart-button.active svg { fill: currentColor; }
.detail-heart-button:disabled { opacity: .55; }

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
