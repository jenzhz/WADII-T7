<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import CarparkCard from '@/components/CarparkCard.vue'
import FilterDropdown from '@/components/FilterDropdown.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import api from '@/services/api'
import { getCommunitySummaries } from '@/services/reviews'
import { mockCarparks, mockDestination } from '@/data/mockCarparks'
import { filterAndSortCarparks, normaliseCarparks } from '@/utils/carparkResults'

const route = useRoute()
// Switch to "live" only once the nearby endpoint follows docs/nearby-results.md.
const isDemo = import.meta.env.VITE_CARPARK_DATA_MODE === 'sample'
const destination = computed(() => isDemo ? mockDestination.name : String(route.query.destination || ''))
const vehicleType = ref('C')
// Distance and EV filter can come from the URL (e.g. coming back from the map)
const maxDistance = ref(['250', '500', '1000', '2000', '5000'].includes(String(route.query.radius)) ? String(route.query.radius) : '1000')
const sortBy = ref('walk')
// Options for the filter dropdowns (Bootstrap Dropdown, see FilterDropdown.vue)
const vehicleOptions = [
  { value: 'C', label: 'Car' },
  { value: 'Y', label: 'Motorcycle' },
  { value: 'H', label: 'Heavy vehicle' },
]
const distanceOptions = [
  { value: '250', label: 'Within 250 m' },
  { value: '500', label: 'Within 500 m' },
  { value: '1000', label: 'Within 1 km' },
  { value: '2000', label: 'Within 2 km' },
  { value: '5000', label: 'Within 5 km' },
]
const sortOptions = [
  { value: 'walk', label: 'Nearest to destination' },
  { value: 'lots', label: 'Most available lots' },
]
const evOnly = ref(route.query.ev === '1')
const carparks = ref([])
const communitySummaries = ref(new Map())
const carparkFavourites = ref(new Map())
const favouriteSavingIds = ref([])
const selectedIds = ref([])
const loading = ref(false)
const error = ref('')
const updatedAt = ref(null)
const savingFavourite = ref(false)
const favouriteSaved = ref(false)
const favouriteMessage = ref('')
const favouriteMessageIsError = ref(false)
let latestRequest = 0

const contextQuery = computed(() => ({
  ...route.query, destination: destination.value, vehicleType: vehicleType.value,
  radius: maxDistance.value, ev: evOnly.value ? '1' : undefined, sort: sortBy.value,
}))
// The map shows the same carparks as this page: same distance and EV filter
const mapQuery = computed(() => ({
  ...contextQuery.value,
  radius: sortBy.value === 'lots' ? String(Math.min(Number(maxDistance.value), 1000)) : maxDistance.value,
  ev: evOnly.value ? '1' : undefined,
  from: 'results',
}))
const results = computed(() => filterAndSortCarparks(carparks.value, {
  vehicleType: vehicleType.value, maxDistance: maxDistance.value,
  evOnly: evOnly.value, sortBy: sortBy.value,
}))
const selectedCarparks = computed(() => carparks.value.filter(carpark => selectedIds.value.includes(carpark.id)))
// Time only (e.g. "4:15 pm"): the data is always from today
const updatedLabel = computed(() => updatedAt.value
  ? updatedAt.value.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })
  : '')

// ---------------------------------------------------------------------------
// Real walking time (same OneMap route as the details page) for the carparks
// shown first. The list appears immediately; walking times fill in as they
// arrive, a few at a time, so the page stays fast.
// ---------------------------------------------------------------------------
const WALKING_FIRST = 6 // fetched straight away (the first row or two)
const WALKING_PARALLEL = 3
const walkingRequested = new Set()
let walkingQueue = []
let walkingActive = 0
let walkingBatch = 0

function resetWalking() {
  walkingBatch += 1
  walkingRequested.clear()
  walkingQueue = []
}

function setWalking(id, route) {
  carparks.value = carparks.value.map(carpark => carpark.id === id
    ? { ...carpark, walkingTime: route.walkingTime, walkingDistance: route.walkingDistance }
    : carpark)
}

async function runWalkingQueue() {
  while (walkingActive < WALKING_PARALLEL && walkingQueue.length) {
    const { carpark, batch } = walkingQueue.shift()
    walkingActive += 1
    api.get('/locations/walking-route', {
      params: {
        originLat: carpark.latitude,
        originLng: carpark.longitude,
        destLat: route.query.latitude,
        destLng: route.query.longitude,
      },
    })
      .then(({ data }) => {
        if (batch === walkingBatch && data?.walkingTime != null) setWalking(carpark.id, data)
      })
      .catch(() => {
        // Keep "—" for this card; the details page can still show the route
      })
      .finally(() => {
        walkingActive -= 1
        runWalkingQueue()
      })
  }
}

function requestWalking(carpark) {
  if (!carpark || isDemo || !route.query.latitude || !route.query.longitude) return
  if (carpark.walkingTime != null || walkingRequested.has(carpark.id)) return
  if (carpark.latitude == null || carpark.longitude == null) return
  walkingRequested.add(carpark.id)
  walkingQueue.push({ carpark, batch: walkingBatch })
  runWalkingQueue()
}

// The first few cards get walking data straight away (load, filter, sort)...
watch(results, async (list) => {
  list.slice(0, WALKING_FIRST).forEach(requestWalking)
  // Re-check which cards are on screen (observe() reports each card's current state),
  // e.g. after Refresh or a vehicle change, and forget cards that are no longer shown.
  await nextTick()
  if (!cardObserver) return
  cardObserver.disconnect()
  for (const element of [...observedCards.keys()]) {
    if (element.isConnected) cardObserver.observe(element)
    else observedCards.delete(element)
  }
})

// ...and every other card gets it when it scrolls into view, so any card the
// user can see shows the same walking distance as its details page.
let cardObserver = null
const observedCards = new Map() // element -> carpark id
onMounted(() => {
  if (!('IntersectionObserver' in window)) return
  cardObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const id = observedCards.get(entry.target)
      requestWalking(results.value.find(carpark => carpark.id === id))
    }
  }, { rootMargin: '200px 0px' }) // start a little before the card appears
  for (const element of observedCards.keys()) cardObserver.observe(element)
})
onBeforeUnmount(() => {
  cardObserver?.disconnect()
  resetWalking()
  latestRequest += 1
})

// Template ref for each card wrapper
function trackCard(element, id) {
  if (!element) return
  if (observedCards.get(element) === id) return
  observedCards.set(element, id)
  cardObserver?.observe(element)
}

// Users may select any number, but Compare only works with 2 to 3 carparks
const MAX_COMPARE = 3
const tooManySelected = computed(() => selectedIds.value.length > MAX_COMPARE)
const canCompare = computed(() => selectedIds.value.length >= 2 && !tooManySelected.value)

function toggleCompare(id) {
  if (selectedIds.value.includes(id)) selectedIds.value = selectedIds.value.filter(value => value !== id)
  else selectedIds.value.push(id)
}
function resetFilters() {
  maxDistance.value = '1000'
  evOnly.value = false
  sortBy.value = 'walk'
}

function resetSearchJourney() {
  localStorage.removeItem('carparkcompare.search')
  localStorage.removeItem('lastComparison')
  window.dispatchEvent(new Event('search-changed'))
}

async function saveDestination() {
  const latitude = Number(route.query.latitude)
  const longitude = Number(route.query.longitude)
  if (!destination.value || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    favouriteMessage.value = 'This destination cannot be added to favourites.'
    favouriteMessageIsError.value = true
    return
  }

  savingFavourite.value = true
  favouriteMessage.value = ''
  try {
    await api.post('/favourites', {
      type: 'destination',
      label: destination.value,
      latitude,
      longitude,
    })
    favouriteSaved.value = true
    favouriteMessage.value = 'Destination added to favourites.'
    favouriteMessageIsError.value = false
  } catch (err) {
    favouriteMessage.value = err.response?.data?.message || 'Unable to add this destination.'
    favouriteMessageIsError.value = true
  } finally {
    savingFavourite.value = false
  }
}

async function loadCarparkFavourites() {
  try {
    const { data } = await api.get('/favourites')
    carparkFavourites.value = new Map(
      data.favourites.filter(item => item.type === 'carpark' && item.carparkId).map(item => [item.carparkId, item]),
    )
  } catch {
    carparkFavourites.value = new Map()
  }
}

async function toggleCarparkFavourite(carpark) {
  if (favouriteSavingIds.value.includes(carpark.id)) return
  favouriteSavingIds.value = [...favouriteSavingIds.value, carpark.id]
  favouriteMessage.value = ''
  try {
    const existing = carparkFavourites.value.get(carpark.id)
    if (existing) {
      await api.delete(`/favourites/${existing.id}`)
      carparkFavourites.value.delete(carpark.id)
      favouriteMessage.value = `${carpark.name} removed from favourites.`
    } else {
      const { data } = await api.post('/favourites', {
        type: 'carpark', label: carpark.name, carparkId: carpark.id,
        latitude: carpark.latitude, longitude: carpark.longitude,
      })
      carparkFavourites.value.set(carpark.id, data.favourite)
      favouriteMessage.value = `${carpark.name} added to favourites.`
    }
    favouriteMessageIsError.value = false
  } catch (err) {
    favouriteMessage.value = err.response?.data?.message || 'Unable to update this favourite.'
    favouriteMessageIsError.value = true
  } finally {
    favouriteSavingIds.value = favouriteSavingIds.value.filter(id => id !== carpark.id)
  }
}

async function loadCarparks() {
  const requestId = ++latestRequest
  loading.value = true
  error.value = ''
  carparks.value = []
  selectedIds.value = []
  updatedAt.value = null
  resetWalking()
  try {
    if (isDemo) {
      carparks.value = normaliseCarparks(mockCarparks.map(row => {
        const rad = x => x * Math.PI / 180
        const a = Math.sin(rad(row.latitude - mockDestination.latitude) / 2) ** 2 + Math.cos(rad(mockDestination.latitude)) * Math.cos(rad(row.latitude)) * Math.sin(rad(row.longitude - mockDestination.longitude) / 2) ** 2
        return { ...row, distance: Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) }
      }))
    } else {
      const latitude = Number(route.query.latitude)
      const longitude = Number(route.query.longitude)
      if (!destination.value || !route.query.latitude || !route.query.longitude ||
          !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        throw new Error('Choose a destination on the search page before viewing nearby carparks.')
      }
      const { data } = await api.get('/carparks/nearby', {
        params: { latitude, longitude, vehicleType: vehicleType.value, radius: 5000 },
      })
      if (requestId !== latestRequest) return
      if (data.success === false) throw new Error('The carpark service could not complete your search.')
      carparks.value = normaliseCarparks(data.carparks)
      const timestamp = data.fetchedAt ? new Date(data.fetchedAt) : null
      if (timestamp && Number.isFinite(timestamp.getTime())) updatedAt.value = timestamp
    }
    try {
      const community = await getCommunitySummaries(carparks.value.map(row => row.id))
      if (requestId === latestRequest) {
        communitySummaries.value = new Map(community.summaries.map(item => [item.carparkId, item]))
      }
    } catch {
      if (requestId === latestRequest) communitySummaries.value = new Map()
    }
  } catch (err) {
    if (requestId !== latestRequest) return
    error.value = err.response || err.request
      ? (err.response?.data?.message || 'Unable to load carparks. Check that the backend is running, then try again.')
      : err.message
  } finally {
    if (requestId === latestRequest) loading.value = false
  }
}

// Watch search context so navigating to a new destination reloads this same view.
watch(() => [route.query.destination, route.query.latitude, route.query.longitude, route.query.vehicleType], () => {
  vehicleType.value = ['C', 'Y', 'H'].includes(route.query.vehicleType) ? route.query.vehicleType : 'C'
  favouriteSaved.value = false
  favouriteMessage.value = ''
  maxDistance.value = distanceOptions.some(option => option.value === String(route.query.radius)) ? String(route.query.radius) : '1000'
  evOnly.value = route.query.ev === '1'
  sortBy.value = route.query.sort === 'lots' ? 'lots' : 'walk'
  loadCarparks()
  loadCarparkFavourites()
}, { immediate: true })
</script>

<template>
  <section class="results-page">
    <div class="results-inner">
    <RouterLink to="/" class="back-link" @click="resetSearchJourney">
      <span aria-hidden="true">←</span> Back to search
    </RouterLink>
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mt-4 mb-4">
      <div>
        <h1>Nearby carparks</h1>
        <p class="destination-context text-secondary mt-3 mb-0">Parking near <strong class="destination-name">{{ destination || 'your destination' }}</strong></p>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn favourite-button" type="button" :disabled="savingFavourite || favouriteSaved" @click="saveDestination">
          {{ savingFavourite ? 'Adding…' : favouriteSaved ? 'Added to favourites' : 'Add to favourites' }}
        </button>
        <RouterLink class="btn btn-success explore-button" :to="{ name: 'map', query: mapQuery }">Explore map ↗</RouterLink>
      </div>
    </div>

    <div v-if="favouriteMessage" class="alert py-2" :class="favouriteMessageIsError ? 'alert-danger' : 'alert-success'" role="status">
      {{ favouriteMessage }}
    </div>

    <div v-if="isDemo" class="demo-notice mb-4" role="note">
      <strong>Sample results</strong> · Showing the project's Suntec sample data. Lot counts and walking estimates are not live.
    </div>

    <div class="filter-panel mb-4">
      <div class="row g-3 align-items-end">
        <div class="col-sm-6 col-lg-3">
          <FilterDropdown id="vehicle" v-model="vehicleType" label="Vehicle type" :options="vehicleOptions" @change="loadCarparks" />
        </div>
        <div class="col-sm-6 col-lg-3">
          <FilterDropdown id="distance" v-model="maxDistance" label="Distance" :options="distanceOptions" />
        </div>
        <div class="col-sm-6 col-lg-3">
          <FilterDropdown id="sort" v-model="sortBy" label="Sort results" :options="sortOptions" />
        </div>
        <div class="col-sm-6 col-lg-3">
          <span class="form-label d-block" id="show-only-label">Show only</span>
          <!-- Toggle chip: same colours and wording as the "EV Charging" tag on each card -->
          <div class="filter-chips" role="group" aria-labelledby="show-only-label">
            <button type="button" class="filter-chip chip-ev" :class="{ on: evOnly }"
              :aria-pressed="evOnly ? 'true' : 'false'" @click="evOnly = !evOnly">
              <svg class="chip-leaf" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66l.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8Z" />
              </svg>
              EV Charging
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h2 class="h6 mb-0" aria-live="polite">{{ loading ? 'Finding carparks…' : `${results.length} carpark${results.length === 1 ? '' : 's'} found` }}</h2>
      <div class="d-flex align-items-center gap-3">
        <span v-if="!isDemo" class="small text-secondary">Live data from LTA DataMall<template v-if="updatedLabel"> · Updated {{ updatedLabel }}</template></span>
        <button type="button" class="btn refresh-button" :disabled="loading" @click="loadCarparks">
          <svg viewBox="0 0 24 24" aria-hidden="true" :class="{ spinning: loading }"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" /></svg>
          {{ isDemo ? 'Reload samples' : 'Refresh availability' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="state-panel" aria-live="polite"><LoadingSpinner /><p class="mt-3 mb-0">Loading nearby carparks…</p></div>
    <div v-else-if="error" class="state-panel" role="alert">
      <h2 class="h5">Carparks could not be loaded</h2><p>{{ error }}</p>
      <button class="btn btn-success" type="button" @click="loadCarparks">Try again</button>
    </div>
    <div v-else-if="results.length === 0" class="state-panel">
      <h2 class="h5">No matching carparks</h2>
      <p class="text-secondary">Try a larger nearby radius or include carparks with no available lots.</p>
      <p v-if="isDemo && vehicleType !== 'C'" class="small">The sample dataset only contains car lots. Choose Car to preview the cards.</p>
      <button class="btn btn-outline-success" type="button" @click="resetFilters">Reset filters</button>
    </div>
    <TransitionGroup v-else name="card-list" tag="div" class="row g-4">
      <div v-for="carpark in results" :key="carpark.id" :ref="element => trackCard(element, carpark.id)" class="col-12 col-md-6 col-lg-4">
        <CarparkCard :carpark="carpark" :community-summary="communitySummaries.get(carpark.id)"
          :favourite="carparkFavourites.has(carpark.id)" :favourite-saving="favouriteSavingIds.includes(carpark.id)"
          :selected="selectedIds.includes(carpark.id)"
          :selection-disabled="false" :context-query="contextQuery"
          @toggle-compare="toggleCompare" @toggle-favourite="toggleCarparkFavourite" />
      </div>
    </TransitionGroup>
    <p class="small text-secondary mt-3">Lot availability may change before you arrive. Kindly tap <strong>Refresh availability</strong> for the latest numbers.</p>

    <aside v-if="selectedIds.length" class="compare-tray mt-4" :class="{ 'too-many': tooManySelected }" aria-label="Selected carparks">
      <div>
        <strong aria-live="polite" :class="{ 'compare-count-over': tooManySelected }">{{ selectedIds.length }} / {{ MAX_COMPARE }} selected</strong>
        <p v-if="tooManySelected" class="small mb-2 mt-1 compare-limit" role="alert">
          You can compare up to {{ MAX_COMPARE }} carparks at a time. Please remove {{ selectedIds.length - MAX_COMPARE }} to continue.
        </p>
        <p v-else class="small mb-2 mt-1">Select 2 to {{ MAX_COMPARE }} carparks to compare.</p>
        <div class="d-flex flex-wrap gap-2">
          <button v-for="carpark in selectedCarparks" :key="carpark.id" type="button" class="selection-chip"
            :aria-label="`Remove ${carpark.name} from comparison`" @click="toggleCompare(carpark.id)">{{ carpark.name }} ×</button>
        </div>
      </div>
      <div class="d-flex align-items-center gap-3">
        <button type="button" class="btn btn-link text-success" @click="selectedIds = []">Clear</button>
        <RouterLink v-if="canCompare" class="btn btn-success text-nowrap"
          :to="{ name: 'compare', query: { ...contextQuery, ids: selectedIds.join(',') } }">Compare ({{ selectedIds.length }}) →</RouterLink>
        <button v-else class="btn btn-success text-nowrap" type="button" disabled
          :title="tooManySelected ? `You can compare up to ${MAX_COMPARE} carparks` : 'Select at least 2 carparks'">Compare ({{ selectedIds.length }})</button>
      </div>
    </aside>
    </div>
  </section>
</template>

<style scoped>
.results-page { min-height: 100%; padding: 2.5rem 1.5rem 5rem; background-color: #f0fbf6; background-image: radial-gradient(#bfe9d7 1.1px, transparent 1.1px); background-size: 19px 19px; }
.results-inner { width: min(100%, 76rem); margin: auto; }
h1 { font-size: clamp(2rem, 5vw, 3.25rem); }
.destination-context { font-size: clamp(1.1rem, 2vw, 1.3rem); line-height: 1.35; }
.destination-context strong { font-weight: 800; }
.destination-name { color: #087a58; }
.back-link { display: inline-flex; align-items: center; gap: .35rem; margin-bottom: .25rem; padding: .5rem .2rem; color: #087a58; font-weight: 750; text-decoration: none; }
.back-link:hover { color: #055c42; text-decoration: underline; }
.favourite-button { min-width: 10.5rem; border: 1.5px solid #174f40; color: #123d32; background: white; font-weight: 700; }
.favourite-button:hover:not(:disabled) { border-color: #0a9e70; color: #06271f; background: #e7f8f0; }
.refresh-button { display: inline-flex; align-items: center; gap: .4rem; padding: .45rem .9rem; border: 1.5px solid #174f40; border-radius: .7rem; color: #123d32; background: white; font-size: .875rem; font-weight: 700; }
.refresh-button:hover:not(:disabled) { border-color: #0a9e70; color: #06271f; background: #e7f8f0; }
.refresh-button svg { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.refresh-button svg.spinning { animation: refresh-spin .8s linear infinite; }
@keyframes refresh-spin { to { transform: rotate(360deg); } }
.explore-button { min-width: 9.5rem; border-color: #07875f; color: #06271f; background: #2cd790; font-weight: 700; }
.explore-button:hover { border-color: #067651; color: #06271f; background: #25c985; }
.demo-notice { padding: .85rem 1rem; background: #eef3f8; color: #40576a; border-radius: .65rem; font-size: .85rem; }
.filter-panel { padding: 1.4rem 1.5rem; border: 2px solid #174f40; border-radius: 1.3rem; background: white; }
.filter-panel .form-select { min-height: 3.2rem; border: 1.5px solid #174f40; border-radius: .8rem; }
/* "Show only" toggle chip, styled like the card's "EV Charging" tag */
.filter-chips { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
/* Same height as the dropdowns next to it */
.filter-chips .filter-chip { min-height: 3.2rem; padding-inline: 1rem; border-radius: .8rem; font-size: .9rem; }
.filter-chip { display: inline-flex; align-items: center; gap: .35rem; min-height: 2.3rem; padding: .3rem .65rem; border: 1.5px solid #b8cec5; border-radius: 2rem; color: #40534c; background: white; font-size: .78rem; font-weight: 750; white-space: nowrap; transition: background .15s, border-color .15s, color .15s; }
.filter-chip:hover { border-color: #0a9e70; }
.filter-chip:focus-visible { outline: 2px solid #087a58; outline-offset: 2px; }
.chip-leaf { width: 1rem; height: 1rem; color: #15803d; }
/* Selected: same colours as the matching card tag */
.chip-ev.on { border-color: #15803d; color: #15803d; background: #dcfce7; }
.form-label { font-size: .8rem; font-weight: 600; }
.state-panel { text-align: center; padding: 3rem 1rem; border: 1px dashed #becdc6; border-radius: 1rem; }
.compare-tray.too-many { border-color: #e7a3a3; background: #fff5f5; }
.compare-limit { color: #a02f2f; font-weight: 650; }
.compare-count-over { color: #a02f2f; }
.compare-tray { position: sticky; bottom: 1rem; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.25rem; border: 1px solid #adccbf; border-radius: 1rem; background: #f0faf5; box-shadow: 0 8px 30px #173e3015; }
.selection-chip { background: white; border: 1px solid #adccbf; border-radius: 2rem; padding: .25rem .65rem; font-size: .8rem; color: #0f5c4d; }
@media (max-width: 767px) { .compare-tray { position: static; align-items: stretch; flex-direction: column; } }
</style>
