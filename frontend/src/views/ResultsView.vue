<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import CarparkCard from '@/components/CarparkCard.vue'
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
const maxDistance = ref('1000')
const sortBy = ref('walk')
const availableOnly = ref(false)
const evOnly = ref(false)
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

const contextQuery = computed(() => ({ ...route.query, destination: destination.value, vehicleType: vehicleType.value }))
const results = computed(() => filterAndSortCarparks(carparks.value, {
  vehicleType: vehicleType.value, maxDistance: maxDistance.value,
  availableOnly: availableOnly.value, evOnly: evOnly.value, sortBy: sortBy.value,
}))
const selectedCarparks = computed(() => carparks.value.filter(carpark => selectedIds.value.includes(carpark.id)))
const updatedLabel = computed(() => updatedAt.value ? updatedAt.value.toLocaleString('en-SG') : '')

function toggleCompare(id) {
  if (selectedIds.value.includes(id)) selectedIds.value = selectedIds.value.filter(value => value !== id)
  else if (selectedIds.value.length < 3) selectedIds.value.push(id)
}
function resetFilters() {
  maxDistance.value = '1000'
  availableOnly.value = false
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
    const next = new Map(carparkFavourites.value)
    if (existing) {
      await api.delete(`/favourites/${existing.id}`)
      next.delete(carpark.id)
      favouriteMessage.value = `${carpark.name} removed from favourites.`
    } else {
      const { data } = await api.post('/favourites', {
        type: 'carpark',
        label: carpark.name,
        carparkId: carpark.id,
        latitude: carpark.latitude,
        longitude: carpark.longitude,
      })
      next.set(carpark.id, data.favourite)
      favouriteMessage.value = `${carpark.name} added to favourites.`
    }
    favouriteMessageIsError.value = false
    carparkFavourites.value = next
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
  resetFilters()
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
        <RouterLink class="btn btn-success explore-button" :to="{ name: 'map', query: contextQuery }">Explore map ↗</RouterLink>
      </div>
    </div>

    <div v-if="favouriteMessage" class="alert py-2" :class="favouriteMessageIsError ? 'alert-danger' : 'alert-success'" role="status">
      {{ favouriteMessage }}
    </div>

    <div v-if="!isDemo" class="demo-notice mb-4">Source: LTA DataMall · Data is cached for up to 60 seconds. Refresh to retrieve the latest available response.</div>
    <div v-if="isDemo" class="demo-notice mb-4" role="note">
      <strong>Sample results</strong> · Showing the project's Suntec sample data. Lot counts and walking estimates are not live.
    </div>

    <div class="filter-panel mb-4">
      <div class="row g-3 align-items-end">
        <div class="col-sm-6 col-lg-3">
          <label for="vehicle" class="form-label">Vehicle type</label>
          <select id="vehicle" v-model="vehicleType" class="form-select" @change="loadCarparks">
            <option value="C">Car</option><option value="Y">Motorcycle</option><option value="H">Heavy vehicle</option>
          </select>
        </div>
        <div class="col-sm-6 col-lg-3">
          <label for="distance" class="form-label">Nearby radius (straight-line)</label>
          <select id="distance" v-model="maxDistance" class="form-select">
            <option value="5000">Within 5 km</option><option value="250">Within 250 m</option>
            <option value="500">Within 500 m</option><option value="1000">Within 1 km</option><option value="2000">Within 2 km</option>
          </select>
        </div>
        <div class="col-sm-6 col-lg-3">
          <label for="sort" class="form-label">Sort results</label>
          <select id="sort" v-model="sortBy" class="form-select">
            <option value="walk">Nearest to destination</option><option value="lots">Most available lots</option>
          </select>
        </div>
        <div class="col-sm-6 col-lg-3 pb-1 d-grid gap-2">
          <label class="d-flex align-items-center gap-2">
            <input v-model="availableOnly" type="checkbox" class="form-check-input mt-0" />
            <span class="filter-parking-icon" aria-hidden="true">P</span>
            Available Lots
          </label>
          <label class="d-flex align-items-center gap-2">
            <input v-model="evOnly" type="checkbox" class="form-check-input mt-0" />
            <span class="filter-leaf-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path fill="currentColor" d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66l.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8Z" />
              </svg>
            </span>
            EV Charging Available
          </label>
        </div>
      </div>
    </div>

    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h2 class="h6 mb-0" aria-live="polite">{{ loading ? 'Finding carparks…' : `${results.length} carpark${results.length === 1 ? '' : 's'} found` }}</h2>
      <div class="d-flex align-items-center gap-3">
        <span v-if="!isDemo && updatedLabel" class="small text-secondary">Retrieved {{ updatedLabel }}</span>
        <button type="button" class="btn btn-sm btn-link text-success" :disabled="loading" @click="loadCarparks">{{ isDemo ? 'Reload samples' : 'Refresh availability' }}</button>
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
      <div v-for="carpark in results" :key="carpark.id" class="col-md-6 col-xl-4">
        <CarparkCard :carpark="carpark" :community-summary="communitySummaries.get(carpark.id)"
          :favourite="carparkFavourites.has(carpark.id)" :favourite-saving="favouriteSavingIds.includes(carpark.id)"
          :selected="selectedIds.includes(carpark.id)"
          :selection-disabled="selectedIds.length >= 3" :context-query="contextQuery"
          @toggle-compare="toggleCompare" @toggle-favourite="toggleCarparkFavourite" />
      </div>
    </TransitionGroup>
    <p class="small text-secondary mt-3">Nearby distance is straight-line distance to your destination, not a walking route. Live walking estimates require a separate routing service. Lot availability may change before arrival.</p>

    <aside v-if="selectedIds.length" class="compare-tray mt-4" aria-label="Selected carparks">
      <div>
        <strong aria-live="polite">{{ selectedIds.length }} of 3 selected</strong>
        <p class="small mb-2 mt-1">Select at least 2 carparks to compare. Selections remain when filters change.</p>
        <div class="d-flex flex-wrap gap-2">
          <button v-for="carpark in selectedCarparks" :key="carpark.id" type="button" class="selection-chip"
            :aria-label="`Remove ${carpark.name} from comparison`" @click="toggleCompare(carpark.id)">{{ carpark.name }} ×</button>
        </div>
      </div>
      <div class="d-flex align-items-center gap-3">
        <button type="button" class="btn btn-link text-success" @click="selectedIds = []">Clear</button>
        <RouterLink v-if="selectedIds.length >= 2" class="btn btn-success text-nowrap"
          :to="{ name: 'compare', query: { ...contextQuery, ids: selectedIds.join(',') } }">Compare ({{ selectedIds.length }}) →</RouterLink>
        <button v-else class="btn btn-success text-nowrap" disabled>Compare (1)</button>
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
.explore-button { min-width: 9.5rem; border-color: #07875f; color: #06271f; background: #2cd790; font-weight: 700; }
.explore-button:hover { border-color: #067651; color: #06271f; background: #25c985; }
.demo-notice { padding: .85rem 1rem; background: #eef3f8; color: #40576a; border-radius: .65rem; font-size: .85rem; }
.filter-panel { padding: 1.4rem 1.5rem; border: 2px solid #174f40; border-radius: 1.3rem; background: white; }
.filter-panel .form-select { min-height: 3.2rem; border: 1.5px solid #174f40; border-radius: .8rem; }
.filter-parking-icon, .filter-leaf-icon { display: inline-grid; width: 1.55rem; height: 1.55rem; flex: 0 0 1.55rem; place-items: center; border-radius: .45rem; color: #073f32; background: #2cd790; font-size: .82rem; font-weight: 800; }
.filter-leaf-icon { border-radius: 50%; color: #15803d; background: #dcfce7; }
.filter-leaf-icon svg { width: 1rem; height: 1rem; }
.form-label { font-size: .8rem; font-weight: 600; }
.state-panel { text-align: center; padding: 3rem 1rem; border: 1px dashed #becdc6; border-radius: 1rem; }
.compare-tray { position: sticky; bottom: 1rem; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.25rem; border: 1px solid #adccbf; border-radius: 1rem; background: #f0faf5; box-shadow: 0 8px 30px #173e3015; }
.selection-chip { background: white; border: 1px solid #adccbf; border-radius: 2rem; padding: .25rem .65rem; font-size: .8rem; color: #0f5c4d; }
@media (max-width: 767px) { .compare-tray { position: static; align-items: stretch; flex-direction: column; } }
</style>
