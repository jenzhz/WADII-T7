<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import api from '@/services/api'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import FilterDropdown from '@/components/FilterDropdown.vue'
import destinationIconUrl from '@/assets/destination-pin.svg'
import { formatDistance, normaliseCarparks } from '@/utils/carparkResults'
import { rankCarparks } from '@/utils/ranking'

const weightOptions = {
  walk: { lots: 0.3, walk: 0.7, mode: 'walk', label: 'Closer' },
  lots: { lots: 0.7, walk: 0.3, mode: 'lots', label: 'Available Lots' },
}

const favourites = ref([])
const carparkFavourites = ref([])
const liveCarparkData = ref(new Map())
const activeFavourite = ref(null)
const carparks = ref([])
const preference = ref('walk')
const vehicleType = ref('C')
const vehicleOptions = [
  { value: 'C', label: 'Car' },
  { value: 'Y', label: 'Motorcycle' },
  { value: 'H', label: 'Heavy vehicle' },
]
const loadingFavourites = ref(true)
const loadingCarparks = ref(false)
const favouritesError = ref('')
const activeTab = ref('places')
const carparksError = ref('')
let nearbyRequest = 0
onBeforeUnmount(() => { nearbyRequest += 1 })

const rankedCarparks = computed(() =>
  rankCarparks(carparks.value, weightOptions[preference.value]).slice(0, 3),
)

const contextQuery = computed(() => activeFavourite.value ? {
  destination: activeFavourite.value.label,
  latitude: activeFavourite.value.latitude,
  longitude: activeFavourite.value.longitude,
  vehicleType: vehicleType.value,
} : {})

async function loadFavourites() {
  loadingFavourites.value = true
  favouritesError.value = ''
  try {
    const { data } = await api.get('/favourites')
    favourites.value = data.favourites.filter(favourite => favourite.type === 'destination')
    carparkFavourites.value = data.favourites.filter(favourite => favourite.type === 'carpark')
    if (!favourites.value.length && carparkFavourites.value.length) activeTab.value = 'carparks'
  } catch (error) {
    favouritesError.value = error.response?.data?.message || 'Unable to load favourites.'
  } finally {
    loadingFavourites.value = false
  }

  if (!favouritesError.value && carparkFavourites.value.length) {
    try {
      const { data: liveData } = await api.get('/carparks')
      liveCarparkData.value = new Map((liveData.carparks || []).map(carpark => [carpark.id, carpark]))
    } catch {
      liveCarparkData.value = new Map()
    }
  }
}

async function loadCarparks() {
  const requestId = ++nearbyRequest
  if (!activeFavourite.value) return
  loadingCarparks.value = true
  carparksError.value = ''
  carparks.value = []
  try {
    const { data } = await api.get('/carparks/nearby', {
      params: {
        latitude: activeFavourite.value.latitude,
        longitude: activeFavourite.value.longitude,
        vehicleType: vehicleType.value,
        radius: 1000,
      },
    })
    if (requestId === nearbyRequest) carparks.value = normaliseCarparks(data.carparks)
  } catch (error) {
    if (requestId === nearbyRequest) carparksError.value = error.response?.data?.message || 'Unable to load nearby carparks.'
  } finally {
    if (requestId === nearbyRequest) loadingCarparks.value = false
  }
}

async function selectFavourite(favourite) {
  activeFavourite.value = favourite
  preference.value = 'walk'
  await loadCarparks()
}

async function removeFavourite(favourite) {
  favouritesError.value = ''
  try {
    await api.delete(`/favourites/${favourite.id}`)
    favourites.value = favourites.value.filter(item => item.id !== favourite.id)
    if (activeFavourite.value?.id === favourite.id) {
      nearbyRequest += 1
      loadingCarparks.value = false
      activeFavourite.value = null
      carparks.value = []
      carparksError.value = ''
    }
  } catch (error) {
    favouritesError.value = error.response?.data?.message || 'Unable to remove favourite.'
  }
}

async function removeCarparkFavourite(favourite) {
  favouritesError.value = ''
  try {
    await api.delete(`/favourites/${favourite.id}`)
    carparkFavourites.value = carparkFavourites.value.filter(item => item.id !== favourite.id)
  } catch (error) {
    favouritesError.value = error.response?.data?.message || 'Unable to remove favourite carpark.'
  }
}

function favouriteDetailsLink(favourite) {
  const live = liveCarparkData.value.get(favourite.carparkId)
  return {
    name: 'carpark-details',
    params: { id: favourite.carparkId },
    query: {
      name: favourite.label,
      lotType: favourite.carparkId?.split(':').at(-1) || 'C',
      ...(live?.hasEvCharger ? { hasEv: '1' } : {}),
    },
  }
}

onMounted(loadFavourites)
</script>

<template>
  <section class="favourites-page">
    <div class="favourites-inner">
    <div class="mb-4">
      <h1>Your favourites</h1>
    </div>

    <div v-if="favouritesError" class="alert alert-danger" role="alert">{{ favouritesError }}</div>
    <div v-if="loadingFavourites" class="state-panel"><LoadingSpinner /><p class="mt-3 mb-0">Loading favourites…</p></div>
    <template v-else-if="!favouritesError">
    <ul class="nav nav-pills favourite-tabs mb-4" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link" :class="{ active: activeTab === 'places' }" type="button" role="tab"
          :aria-selected="activeTab === 'places'" @click="activeTab = 'places'">
          Places you often visit <span class="tab-count">{{ favourites.length }}</span>
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" :class="{ active: activeTab === 'carparks' }" type="button" role="tab"
          :aria-selected="activeTab === 'carparks'" @click="activeTab = 'carparks'">
          Your favourite carparks <span class="tab-count">{{ carparkFavourites.length }}</span>
        </button>
      </li>
    </ul>

    <!-- Tab 1: places -->
    <template v-if="activeTab === 'places'">
    <div v-if="!favourites.length" class="state-panel">
      <h2 class="h5">No saved places yet</h2>
      <p class="text-secondary">Save places you often go to, like home, work or a mall, from the search results page.</p>
      <RouterLink class="btn btn-success" to="/">Find a destination</RouterLink>
    </div>

    <section v-else class="saved-destinations">
      <div class="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
        <div>
          <h2 class="h4 mb-1">Places you often visit</h2>
          <p class="small text-secondary mb-0">Pick a place to see the best carparks near it right now.</p>
        </div>
        <span class="small text-secondary">{{ favourites.length }} saved</span>
      </div>
      <div class="saved-destination-grid">
        <article v-for="favourite in favourites" :key="favourite.id" class="destination-card"
          :class="{ active: activeFavourite?.id === favourite.id }">
          <button class="destination-select text-start" type="button" :aria-pressed="activeFavourite?.id === favourite.id" @click="selectFavourite(favourite)">
            <span class="saved-destination-icon" aria-hidden="true"><img :src="destinationIconUrl" alt="" /></span>
            <span class="destination-copy">
              <strong>{{ favourite.label }}</strong>
              <span class="destination-status">{{ activeFavourite?.id === favourite.id ? 'Showing nearby carparks' : 'Saved place' }}</span>
            </span>
            <span class="destination-action">View nearby carparks <span aria-hidden="true">→</span></span>
          </button>
          <button class="saved-favourite-remove heart-button" type="button" title="Remove from favourites" :aria-label="`Remove ${favourite.label} from favourites`" @click="removeFavourite(favourite)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9C.9 8.4 2.8 5 6.4 5c2.1 0 3.7 1.2 4.6 2.4C11.9 6.2 13.5 5 15.6 5c3.6 0 5.5 3.4 3.9 7-2 4.4-7.5 9-7.5 9Z" /></svg>
          </button>
        </article>
      </div>

      <section v-if="activeFavourite" class="destination-results" aria-label="Nearby carparks for selected destination">
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
          <div>
            <p class="small text-secondary mb-1">Parking near</p>
            <h2 class="h4 mb-0">{{ activeFavourite.label }}</h2>
          </div>
          <div>
            <FilterDropdown id="favourite-vehicle" v-model="vehicleType" label="Vehicle type" label-class="form-label small" :options="vehicleOptions" @change="loadCarparks" />
          </div>
        </div>

        <p class="small text-secondary mb-2">What matters most?</p>
        <div class="btn-group mb-4" role="group" aria-label="Carpark ranking preference">
          <template v-for="(option, key) in weightOptions" :key="key">
            <input :id="`favourite-${key}`" v-model="preference" class="btn-check" type="radio" :value="key" />
            <label class="btn btn-outline-success" :for="`favourite-${key}`">{{ option.label }}</label>
          </template>
        </div>

        <div v-if="loadingCarparks" class="state-panel"><LoadingSpinner /><p class="mt-3 mb-0">Finding live carparks…</p></div>
        <div v-else-if="carparksError" class="alert alert-danger" role="alert">
          {{ carparksError }}
          <button class="btn btn-sm btn-outline-danger ms-2" type="button" @click="loadCarparks">Try again</button>
        </div>
        <div v-else-if="rankedCarparks.length === 0" class="state-panel">No nearby carparks were found for this vehicle type.</div>
        <div v-else class="row g-3">
          <div v-for="carpark in rankedCarparks" :key="carpark.id" class="col-12 col-md-6 col-lg-4">
            <article class="carpark-card h-100" :class="{ recommended: carpark.rank === 1 }">
              <span class="badge mb-3" :class="carpark.rank === 1 ? 'bg-success' : 'bg-secondary'">
                {{ carpark.rank === 1 ? 'Recommended' : `#${carpark.rank}` }}
              </span>
              <h3 class="h6 fw-bold">{{ carpark.name }}</h3>
              <span v-if="carpark.hasEvCharger" class="ev-badge mb-2">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66l.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8Z" /></svg>
                EV Charging
              </span>
              <dl class="small mb-3">
                <div><dt>Available lots</dt><dd>{{ carpark.availableLots ?? '—' }}</dd></div>
                <div><dt>Distance</dt><dd>{{ formatDistance(carpark.distance) }}</dd></div>
              </dl>
              <RouterLink class="mt-auto" :to="{ name: 'carpark-details', params: { id: carpark.id }, query: contextQuery }">View details →</RouterLink>
            </article>
          </div>
        </div>
      </section>
    </section>
    </template>

    <!-- Tab 2: carparks -->
    <template v-else>
    <div v-if="!carparkFavourites.length" class="state-panel">
      <h2 class="h5">No favourite carparks yet</h2>
      <p class="text-secondary">Tap the heart on any carpark card to keep it here.</p>
      <RouterLink class="btn btn-success" to="/">Search carparks</RouterLink>
    </div>
    <section v-else class="saved-carparks mb-4">
      <div class="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
        <div>
          <h2 class="h4 mb-1">Your favourite carparks</h2>
          <p class="small text-secondary mb-0">Carparks you like to park at. Open one to check live lots.</p>
        </div>
        <span class="small text-secondary">{{ carparkFavourites.length }} saved</span>
      </div>
      <div class="saved-carpark-grid">
        <article v-for="favourite in carparkFavourites" :key="favourite.id" class="saved-carpark-card">
          <span class="saved-parking-icon" aria-hidden="true">P</span>
          <div>
            <h3>{{ favourite.label }}</h3>
          </div>
          <div class="saved-carpark-footer">
            <RouterLink :to="favouriteDetailsLink(favourite)">View details →</RouterLink>
            <span v-if="liveCarparkData.get(favourite.carparkId)?.hasEvCharger" class="ev-badge">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66l.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8Z" /></svg>
              EV Charging
            </span>
          </div>
          <button class="saved-favourite-remove heart-button" type="button" title="Remove from favourites" :aria-label="`Remove ${favourite.label} from favourites`" @click="removeCarparkFavourite(favourite)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9C.9 8.4 2.8 5 6.4 5c2.1 0 3.7 1.2 4.6 2.4C11.9 6.2 13.5 5 15.6 5c3.6 0 5.5 3.4 3.9 7-2 4.4-7.5 9-7.5 9Z" /></svg>
          </button>
        </article>
      </div>
    </section>
    </template>
    </template>
    </div>
  </section>
</template>

<style scoped>
.favourites-page { min-height: 100%; padding: 2.5rem 1.5rem 5rem; background-color: #f0fbf6; background-image: radial-gradient(#bfe9d7 1.1px, transparent 1.1px); background-size: 19px 19px; }
.favourites-inner { width: min(100%, 76rem); margin: auto; }
.favourite-tabs { gap: .5rem; flex-wrap: wrap; }
.favourite-tabs .nav-link { display: inline-flex; align-items: center; gap: .5rem; padding: .6rem 1.1rem; border: 1.5px solid #174f40; border-radius: 2rem; color: #0f5c4d; background: white; font-weight: 700; }
.favourite-tabs .nav-link:hover { background: #dff7ec; }
.favourite-tabs .nav-link.active { color: #06271f; background: #2cd790; border-color: #087a58; }
.tab-count { display: inline-grid; min-width: 1.5rem; height: 1.5rem; padding: 0 .4rem; place-items: center; border-radius: 1rem; background: #e6f3ee; font-size: .75rem; }
.nav-link.active .tab-count { background: rgba(255, 255, 255, .6); }
.favourites-page h1 { font-size: clamp(2.5rem, 5vw, 4rem); }
.state-panel { text-align: center; padding: 3rem 1rem; border: 2px dashed #9ebfb3; border-radius: 1.3rem; background: rgba(255, 255, 255, .72); }
.destination-card { position: relative; display: flex; border: 1.5px solid #b8cec5; border-radius: 1rem; background: #f7fcf9; }
.destination-card.active { border-color: #087a58; background: #dff7ec; box-shadow: inset 0 0 0 1px #087a58; }
.destination-card:hover { border-color: #087a58; }
.destination-select { display: grid; width: 100%; min-height: 10rem; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: 1fr auto; align-items: start; gap: 1.5rem .75rem; padding: 1rem 3.25rem 1rem 1rem; border: 0; border-radius: inherit; background: transparent; color: inherit; }
.saved-destination-icon { display: grid; width: 2.4rem; height: 2.4rem; place-items: center; border-radius: .65rem; background: #ece5ff; }
.saved-destination-icon img { width: 1.2rem; height: 1.5rem; }
.destination-copy { display: grid; min-width: 0; gap: .3rem; }
.destination-copy strong { font-size: .95rem; line-height: 1.4; overflow-wrap: anywhere; }
.destination-status { color: #63716a; font-size: .75rem; }
.destination-card.active .destination-status { color: #087a58; }
.destination-action { grid-column: 1 / -1; align-self: end; color: #087a58; font-size: .82rem; font-weight: 750; }
.saved-carparks, .saved-destinations { padding: 1.35rem; border: 2px solid #174f40; border-radius: 1.35rem; background: white; }
.saved-destinations { margin-bottom: 1.5rem; }
.saved-carpark-grid, .saved-destination-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .85rem; }
.destination-results { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #d6e5df; }
.saved-carpark-card { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: 1fr auto; align-items: start; gap: 1.25rem .75rem; padding: 1rem; border: 1.5px solid #b8cec5; border-radius: 1rem; background: #f7fcf9; }
.saved-carpark-card > div { min-width: 0; }
.saved-carpark-card > div:not(.saved-carpark-footer) { padding-right: 2rem; }
.saved-carpark-footer { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .65rem; }
.saved-carpark-footer .ev-badge { margin-top: 0; white-space: nowrap; }
.saved-parking-icon { display: grid; width: 2.4rem; height: 2.4rem; place-items: center; border-radius: .65rem; color: #073f32; background: #2cd790; font-weight: 800; }
.saved-carpark-card h3 { margin: 0; font-size: .95rem; overflow-wrap: anywhere; }
.saved-carpark-card p { margin: .15rem 0 0; color: #63716a; font-size: .75rem; }
.saved-carpark-card a { grid-column: 1 / -1; align-self: end; color: #087a58; font-size: .82rem; font-weight: 750; text-decoration: none; }
.saved-favourite-remove { position: absolute; top: .8rem; right: .8rem; display: grid; width: 2rem; height: 2rem; padding: 0; place-items: center; border: 1px solid #df6a84; border-radius: 50%; color: #c92f54; background: #fff0f4; }
.saved-favourite-remove:hover { color: #a61f43; border-color: #c92f54; background: #ffe1e9; }
.saved-favourite-remove svg { width: 1rem; fill: currentColor; stroke: currentColor; }
.ev-badge { display: inline-flex; width: fit-content; align-items: center; gap: .3rem; margin-top: .45rem; padding: .25rem .55rem; border-radius: 2rem; color: #15803d; background: #dcfce7; font-size: .7rem; font-weight: 750; }
.ev-badge svg { width: 1rem; height: 1rem; }
.selection-hint { margin-top: 1.25rem; padding: .65rem 1rem; border: 1.5px solid #087a58; border-radius: .7rem; color: #087a58; background: white; font-size: .85rem; font-weight: 750; text-decoration: none; }
.selection-hint:hover { color: #06271f; background: #2cd790; }
.destination-empty { display: flex; align-items: center; justify-content: space-between; gap: 1.25rem; padding: 1.25rem 1.5rem; border: 1.5px dashed #9ebfb3; border-radius: 1rem; color: #52665d; background: #ffffffbb; }
.destination-empty h2 { color: #173e30; }
.destination-empty .selection-hint { margin-top: 0; white-space: nowrap; }
.btn-group { padding: .25rem; border: 1.5px solid #174f40; border-radius: .9rem; background: white; overflow: hidden; }
.btn-group .btn { border: 0; border-radius: .65rem !important; color: #087a58; font-weight: 700; }
.btn-check:checked + .btn { color: #06271f; background: #2cd790; }
#favourite-vehicle { min-height: 3rem; border: 1.5px solid #174f40; border-radius: .8rem; }
.carpark-card { display: flex; flex-direction: column; padding: 1.35rem; border: 2px solid #174f40; border-radius: 1.35rem; background: white; }
.carpark-card.recommended { border: 2px solid #0f5c4d; }
.carpark-card.recommended { background: #dff7ec; }
.carpark-card .badge { align-self: flex-start; }
.carpark-card dl div { display: flex; justify-content: space-between; gap: .5rem; }
.carpark-card dt { color: #63716a; font-weight: 400; }
.carpark-card dd { margin: 0; font-weight: 700; }
.carpark-card a { color: #0f5c4d; font-weight: 700; text-decoration: none; }
.carpark-card a:hover { text-decoration: underline; }

@media (max-width: 991px) {
  .saved-carpark-grid, .saved-destination-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 575px) {
  .saved-carpark-grid, .saved-destination-grid { grid-template-columns: 1fr; }
  .destination-empty { align-items: flex-start; flex-direction: column; }
}
</style>

