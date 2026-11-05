<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import { rankCarparks } from '../utils/ranking'
import { normaliseCarparks, formatDistance } from '../utils/carparkResults'
import RateSchedule from '@/components/RateSchedule.vue'
import FilterDropdown from '@/components/FilterDropdown.vue'
import CarparkMap from '@/components/CarparkMap.vue'
import { getCommunitySummaries } from '@/services/reviews'
import { carparkTypeLabel } from '@/utils/carparkLabels'
import { parkingDifficultyDetails } from '@/utils/parkingDifficulty'

const route = useRoute()
const router = useRouter()
const COMPARISON_KEY = 'lastComparison'
const duration = ref(120)
const durationOptions = [60, 120, 180, 240, 360, 480]
  .map(minutes => ({ value: minutes, label: `${minutes / 60} hour${minutes > 60 ? 's' : ''}` }))
const preference = ref('walk')
const weightOptions = {
  walk: { lots: 0.3, walk: 0.7, mode: 'walk', label: 'Closer' },
  lots: { lots: 0.7, walk: 0.3, mode: 'lots', label: 'Available lots' },
  price: { lots: 0, walk: 0, mode: 'price', label: 'Cheapest' },
}

const selectedIds = computed(() => {
  const ids = route.query.ids
  if (!ids) {
    return []
  }
  return ids.split(',')
})

const selectedCarparks = ref([])
const loading = ref(false)
const message = ref('')

async function loadCarparks() {
  if (selectedIds.value.length ==0){
    return
  }
  loading.value = true
  message.value = ''
  try {
    const response = await api.get('/carparks/nearby', {
      params: {
        latitude: route.query.latitude,
        longitude: route.query.longitude,
        vehicleType: route.query.vehicleType || 'C',
        radius: 5000, // Results lets users pick carparks up to 5 km away
        duration: duration.value,
      }
    })
    const allCarparks = normaliseCarparks(response.data.carparks)
    selectedCarparks.value = allCarparks.filter(carpark => selectedIds.value.includes(carpark.id))
    loadCommunity()
    loadWalking()
  } catch (error) {
    message.value = 'HTTP Error ' + error.message
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  if (route.query.ids) {
    localStorage.setItem(COMPARISON_KEY, JSON.stringify(route.query))
  } else {
    try {
      const savedQuery = JSON.parse(localStorage.getItem(COMPARISON_KEY))
      if (savedQuery?.ids) {
        await router.replace({ name: 'compare', query: savedQuery })
      }
    } catch {
      localStorage.removeItem(COMPARISON_KEY)
    }
  }
  await loadCarparks()
})

// Community rating and parking difficulty for the selected carparks
const communitySummaries = ref(new Map())
async function loadCommunity() {
  try {
    const data = await getCommunitySummaries(selectedCarparks.value.map(carpark => carpark.id))
    communitySummaries.value = new Map(data.summaries.map(item => [item.carparkId, item]))
  } catch {
    communitySummaries.value = new Map()
  }
}
const communityFor = carpark => communitySummaries.value.get(carpark.id) || null
const difficultyFor = carpark => parkingDifficultyDetails(communityFor(carpark)?.parkingDifficulty)

// Real walking distance and time (same OneMap route as Results and the details page).
// At most 3 carparks are compared, so all of them are fetched.
async function loadWalking() {
  await Promise.all(selectedCarparks.value.map(async carpark => {
    if (carpark.walkingDistance != null || carpark.latitude == null || carpark.longitude == null) return
    try {
      const { data } = await api.get('/locations/walking-route', {
        params: { originLat: carpark.latitude, originLng: carpark.longitude, destLat: route.query.latitude, destLng: route.query.longitude },
      })
      selectedCarparks.value = selectedCarparks.value.map(item => item.id === carpark.id
        ? { ...item, walkingDistance: data.walkingDistance, walkingTime: data.walkingTime }
        : item)
    } catch {
      // Keep the straight-line estimate
    }
  }))
}

// Map of the compared carparks: numbered markers match the card ranks.
// Clicking "Show walking route" on a marker draws the route to the destination.
const mapDestination = computed(() => ({
  latitude: Number(route.query.latitude),
  longitude: Number(route.query.longitude),
  label: String(route.query.destination || 'Your destination'),
}))
const routeGeometry = ref(null)
const routeCarparkId = ref(null)
const routeError = ref('')

async function showRoute(carpark) {
  routeError.value = ''
  routeCarparkId.value = carpark.id
  routeGeometry.value = null
  try {
    const { data } = await api.get('/carpark-details', {
      params: {
        carparkId: carpark.id,
        lotType: route.query.vehicleType || 'C',
        originLat: carpark.latitude,
        originLng: carpark.longitude,
        destLat: mapDestination.value.latitude,
        destLng: mapDestination.value.longitude,
        destinationName: mapDestination.value.label,
      },
    })
    if (routeCarparkId.value !== carpark.id) return
    routeGeometry.value = data.data?.routeGeometry || null
    if (!routeGeometry.value) routeError.value = data.data?.routeError || 'No walking route is available for this carpark.'
  } catch (error) {
    if (routeCarparkId.value !== carpark.id) return
    routeError.value = error.response?.data?.message || 'Unable to load the walking route.'
  }
}

// Walking distance when known, otherwise straight-line distance
const distanceOf = carpark => carpark.walkingDistance ?? carpark.distance ?? null

function lotsClass(carpark) {
  const lots = carpark.availableLots
  if (lots == null) return 'lots-unknown'
  if (lots === 0) return 'lots-full'
  return lots <= 20 ? 'lots-limited' : 'lots-available'
}

// When the duration changes, only update the estimated costs.
// The cards stay on screen (no "Loading carparks…"); only the cost line shows "Updating…".
const updatingCost = ref(false)
const costError = ref('')
let costRequestId = 0

async function refreshCosts() {
  if (selectedIds.value.length === 0) return
  const requestId = ++costRequestId
  updatingCost.value = true
  costError.value = ''
  try {
    const response = await api.get('/carparks/nearby', {
      params: {
        latitude: route.query.latitude,
        longitude: route.query.longitude,
        vehicleType: route.query.vehicleType || 'C',
        radius: 5000, // Results lets users pick carparks up to 5 km away
        duration: duration.value,
      }
    })
    if (requestId !== costRequestId) return // a newer duration was chosen; ignore this answer
    const costs = new Map(response.data.carparks.map(carpark => [String(carpark.id), carpark.estimatedCost ?? null]))
    selectedCarparks.value = selectedCarparks.value.map(carpark =>
      costs.has(carpark.id) ? { ...carpark, estimatedCost: costs.get(carpark.id) } : carpark
    )
  } catch {
    if (requestId !== costRequestId) return
    selectedCarparks.value = selectedCarparks.value.map(carpark => ({ ...carpark, estimatedCost: null }))
    costError.value = 'Could not update parking costs for this duration. Choose a duration again to retry.'
  } finally {
    if (requestId === costRequestId) updatingCost.value = false
  }
}

watch(duration, refreshCosts)

const ranked = computed(() => rankCarparks(selectedCarparks.value, weightOptions[preference.value]))
// Responsive columns: 3 cards -> 3 / 2 / 1 per row (large / tablet / phone),
// 2 cards -> 2 / 2 / 1
const columnClass = computed(() => (ranked.value.length >= 3 ? 'col-md-6 col-lg-4' : 'col-md-6'))
// Most available lots among the selected carparks (null values are skipped)
const bestLots = computed(() => {
  let best = null
  for (const carpark of ranked.value) {
    if (carpark.availableLots != null && (best == null || carpark.availableLots > best)) {
      best = carpark.availableLots
    }
  }
  return best
})

// Shortest distance among the selected carparks (walking distance when known)
const bestDistance = computed(() => {
  let best = null
  for (const carpark of ranked.value) {
    const distance = distanceOf(carpark)
    if (distance != null && (best == null || distance < best)) best = distance
  }
  return best
})

// Cheapest estimated cost among the selected carparks (unknown costs are skipped)
const bestCost = computed(() => {
  let best = null
  for (const carpark of ranked.value) {
    if (carpark.estimatedCost != null && (best == null || carpark.estimatedCost < best)) {
      best = carpark.estimatedCost
    }
  }
  return best
})

// HDB: calculated cost. LTA: "Varies". URA: dash.
function formatCost(carpark) {
  if (costError.value) return 'Unavailable'
  if (carpark.estimatedCost != null) return `$${carpark.estimatedCost.toFixed(2)}`
  return carpark.rate?.costLabel ?? '—'
}

</script>

<template>
  <section class="compare-page">
    <div class="compare-inner">
    <h1 class="compare-title mb-4">Compare carparks</h1>

    <!-- Loading / error / not enough carparks -->
    <p v-if="loading" class="text-secondary">Loading carparks…</p>
    <div v-else-if="message" class="alert alert-danger">{{ message }}</div>
    <div v-else-if="ranked.length < 2" class="alert alert-info">
      Select at least 2 carparks on the results page to compare them.
      <RouterLink :to="{ name: 'results', query: route.query }" class="alert-link">Back to results</RouterLink>
    </div>

    <template v-else>
      <div class="compare-controls">
        <div class="duration-field">
          <FilterDropdown id="duration" v-model="duration" label="Parking duration" label-class="control-label" :options="durationOptions" />
        </div>

        <fieldset class="preference-field">
          <legend>What matters most? <small class="legend-hint">We'll recommend the best match.</small></legend>
          <div class="preference-options">
            <template v-for="(value, key) in weightOptions" :key="key">
              <input :id="`pref-${key}`" v-model="preference" type="radio" name="comparison-preference" class="btn-check" :value="key">
              <label class="btn preference-button" :for="`pref-${key}`">{{ value.label }}</label>
            </template>
          </div>
        </fieldset>
      </div>

      <!-- 2 cards: 6/12 each, 3 cards: 4/12 each; stacked on phones -->
      <p v-if="costError" class="alert alert-warning" role="alert">{{ costError }}</p>
      <TransitionGroup name="card-list" tag="div" class="row g-3">
        <div v-for="carpark in ranked" :key="carpark.id" class="col-12" :class="columnClass">
          <div class="card h-100 compare-card" :class="{ recommended: carpark.rank === 1 }">
            <div class="card-body d-flex flex-column">
              <div class="mb-2">
                <span v-if="carpark.rank === 1" class="badge bg-success">⭐ Recommended</span>
                <span v-else class="badge bg-secondary">#{{ carpark.rank }}</span>
              </div>

              <h2 class="h6 fw-bold mb-1">{{ carpark.name }}</h2>
              <p class="compare-meta">{{ carparkTypeLabel(carpark.agency) }} · {{ { C: 'Car', Y: 'Motorcycle', H: 'Heavy vehicle' }[carpark.lotType] || carpark.lotType }}</p>
              <div v-if="carpark.hasEvCharger || difficultyFor(carpark)" class="compare-tags">
              <span v-if="carpark.hasEvCharger" class="ev-charging-badge"
                title="EV charging point available" aria-label="EV charging point available">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66l.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8Z" />
                </svg>
                EV Charging
              </span>
                <span v-if="difficultyFor(carpark)" class="difficulty-tag" :class="`difficulty-${difficultyFor(carpark).value}`" :title="difficultyFor(carpark).description">Parking: {{ difficultyFor(carpark).label }}</span>
              </div>
              <p class="compare-rating" :class="{ empty: !communityFor(carpark)?.reviewCount }">
                <span aria-hidden="true">★</span>
                <template v-if="communityFor(carpark)?.reviewCount">
                  <strong>{{ Number(communityFor(carpark).overallRating).toFixed(1) }}</strong>
                  ({{ communityFor(carpark).reviewCount }} review{{ communityFor(carpark).reviewCount === 1 ? '' : 's' }})
                </template>
                <template v-else>No reviews yet</template>
              </p>

              <dl class="metrics mb-3">
                <div :class="{ best: bestLots != null && bestLots > 0 && carpark.availableLots === bestLots, full: carpark.availableLots === 0 }">
                  <dt>Available lots</dt>
                  <dd :class="lotsClass(carpark)">{{ carpark.availableLots === 0 ? 'Full' : (carpark.availableLots ?? '—') }}</dd>
                </div>
                <div :class="{ best: bestDistance != null && distanceOf(carpark) === bestDistance }">
                  <dt>Distance</dt>
                  <dd v-if="carpark.walkingDistance != null" title="Walking distance">{{ formatDistance(carpark.walkingDistance) }}</dd>
                  <dd v-else-if="carpark.distance != null" title="Straight-line estimate">~{{ formatDistance(carpark.distance) }}</dd>
                  <dd v-else>—</dd>
                </div>
                <div>
                  <dt>Walk</dt>
                  <dd>{{ carpark.walkingTime == null ? '—' : `${carpark.walkingTime} min` }}</dd>
                </div>
                <div :class="{ best: bestCost != null && carpark.estimatedCost === bestCost }">
                  <dt>Est. cost ({{ duration / 60 }}h)</dt>
                  <dd :class="{ 'cost-updating': updatingCost }">{{ updatingCost ? 'Updating…' : formatCost(carpark) }}</dd>
                </div>
              </dl>

              <div v-if="carpark.rate?.schedule" class="mb-3">
                <h3 class="h6 fw-bold mb-2">Parking rates</h3>
                <RateSchedule :rate="carpark.rate" compact :show-now="false" />
              </div>

              <RouterLink class="details-link mt-auto"
                :to="{ name: 'carpark-details', params: { id: carpark.id }, query: { ...route.query, ...(carpark.hasEvCharger ? { hasEv: '1' } : {}) } }">
                View details →
              </RouterLink>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <section class="compare-map-section mt-4" aria-label="Compared carparks on the map">
        <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
          <h2 class="h5 fw-bold mb-0">On the map</h2>
          <span class="small text-secondary">Numbers match the ranking above. Tap a marker to see its walking route.</span>
          <RouterLink class="open-map-link" :to="{ name: 'map', query: { ...route.query, ids: ranked.map(carpark => carpark.id).join(','), from: 'compare' } }">
            Open full map ↗
          </RouterLink>
        </div>
        <div v-if="routeError" class="alert alert-warning py-2 mb-2" role="alert">{{ routeError }}</div>
        <CarparkMap
          :carparks="ranked"
          :destination="mapDestination"
          :context-query="route.query"
          :route-geometry="routeGeometry"
          :active-carpark-id="routeCarparkId"
          show-rank
          map-height="24rem"
          @select-carpark="showRoute"
        />
      </section>

    </template>
    </div>
  </section>
</template>

<style scoped>
.compare-page {
  min-height: 100%;
  padding: 2.5rem 1.5rem 5rem;
  background-color: #f0fbf6;
  background-image: radial-gradient(#bfe9d7 1.1px, transparent 1.1px);
  background-size: 19px 19px;
}
.compare-inner { width: min(100%, 76rem); margin: auto; }
.compare-title { font-size: clamp(2.5rem, 5vw, 4rem); }
.compare-controls { display: grid; grid-template-columns: minmax(12rem, .65fr) minmax(0, 1.35fr); align-items: end; gap: 2rem; margin-bottom: 1.5rem; padding: 1.4rem 1.5rem; border: 2px solid #174f40; border-radius: 1.25rem; background: white; }
.control-label, .preference-field legend { display: block; float: none; width: auto; margin: 0 0 .5rem; color: #173e30; font-size: .85rem; font-weight: 750; }
.cost-updating { color: #63716a; font-weight: 500; }
.duration-field .form-select { min-height: 3.25rem; padding: .75rem 2.5rem .75rem 1rem; border: 1.5px solid #174f40; border-radius: .8rem; color: #173e30; }
.preference-field { min-width: 0; margin: 0; padding: 0; border: 0; }
.preference-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .25rem; padding: .25rem; border: 1.5px solid #174f40; border-radius: .85rem; background: #edf3f1; }
.preference-button { display: flex; min-height: 2.7rem; align-items: center; justify-content: center; margin: 0; padding: .6rem .75rem; border: 0; border-radius: .6rem; color: #52665d; background: transparent; font-size: .95rem; font-weight: 700; }
.preference-button:hover { color: #073f32; background: #e0eee7; }
.btn-check:checked + .preference-button { color: #06271f; background: #2cd790; box-shadow: 0 2px 6px #073f3212; }
.btn-check:focus-visible + .preference-button { outline: 2px solid #087a58; outline-offset: 2px; }
@media (max-width: 700px) {
  .compare-controls { grid-template-columns: 1fr; gap: 1.25rem; padding: 1.25rem; }
  .preference-button { padding-inline: .35rem; font-size: .85rem; }
}
.compare-card {
  border-radius: 1rem;
  border: 1px solid #d9e3df;
}
.compare-card.recommended {
  border: 2px solid #0f5c4d;
}
.ev-charging-badge { display: inline-flex; align-self: flex-start; align-items: center; gap: .3rem; padding: .3rem .6rem; border-radius: 2rem; color: #15803d; background: #dcfce7; font-size: .72rem; font-weight: 750; white-space: nowrap; }
.ev-charging-badge svg { width: 1rem; height: 1rem; }
.open-map-link { color: #087a58; font-size: .875rem; font-weight: 750; text-decoration: none; }
.open-map-link:hover { text-decoration: underline; }
.compare-meta { margin: 0 0 .6rem; color: #63716a; font-size: .8rem; }
.compare-tags { display: flex; flex-wrap: wrap; gap: .4rem; margin-bottom: .6rem; }
.compare-tags .ev-charging-badge { margin: 0; }
.difficulty-tag { display: inline-flex; align-items: center; padding: .3rem .6rem; border-radius: 2rem; font-size: .72rem; font-weight: 750; white-space: nowrap; }
.difficulty-beginner-friendly { color: #087a58; background: #dff7ec; }
.difficulty-moderate { color: #805b00; background: #fff0bf; }
.difficulty-challenging { color: #a02f2f; background: #fde2e2; }
.compare-rating { display: flex; align-items: center; gap: .3rem; margin: 0 0 .9rem; color: #52606d; font-size: .8rem; }
.compare-rating > span:first-child { color: #f2a900; font-size: 1rem; }
.compare-rating.empty > span:first-child { color: #aeb9b4; }
.legend-hint { margin-left: .35rem; color: #63716a; font-size: .78rem; font-weight: 500; }
.metrics dd.lots-available { color: #0f7a5f; }
.metrics dd.lots-limited { color: #9a6700; }
.metrics dd.lots-full { color: #b42318; }
.metrics div {
  display: flex;
  justify-content: space-between;
  padding: 0.4rem 0.6rem;
  border-radius: 0.5rem;
}
.metrics dt {
  font-weight: 400;
  color: #63716a;
}
.metrics dd {
  margin: 0;
  font-weight: 700;
}
.metrics .best {
  background: #e6f4f0;
  color: #0f5c4d;
}
/* 0 available lots: red, never green */
.metrics .full {
  background: #fce5e5;
  color: #9f3030;
}
.details-link {
  color: #0f5c4d;
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;
}
.details-link:hover {
  text-decoration: underline;
}
</style>
