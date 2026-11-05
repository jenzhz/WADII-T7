<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router' 
import api from '@/services/api'
import FilterDropdown from '@/components/FilterDropdown.vue'
import {
  addRecentSearch as saveRecentSearch,
  clearRecentSearches as clearAllRecentSearches,
  deleteRecentSearch,
  getRecentSearches,
} from '@/services/recentSearches'

const router = useRouter()
const SEARCH_KEY = 'carparkcompare.search'

const destination = ref("")
const results = ref([])
const searchError = ref('')
let searchRequest = 0
onBeforeUnmount(() => { searchRequest += 1 })

const selectedDestination = ref(null)

const vehicleType = ref('C')
const vehicleOptions = [
  { value: 'C', label: 'Car' },
  { value: 'Y', label: 'Motorcycle' },
  { value: 'H', label: 'Heavy vehicle' },
]

// Recent searches: saved to the signed-in user's account, so they follow the
// user to any browser or device. Failures are ignored (the feature is optional).
const recentSearches = ref([])

// Backend items -> same shape as OneMap results, so selectDestination() can use them
function toDestination(item) {
  return { id: item.id, SEARCHVAL: item.label, LATITUDE: item.latitude, LONGITUDE: item.longitude }
}

function setRecentSearches(items) {
  recentSearches.value = Array.isArray(items) ? items.map(toDestination) : []
}

onMounted(async () => {
  try {
    setRecentSearches(await getRecentSearches())
  } catch {
    recentSearches.value = []
  }
})

async function addRecentSearch(item) {
  try {
    setRecentSearches(await saveRecentSearch({ label: item.SEARCHVAL, latitude: item.LATITUDE, longitude: item.LONGITUDE }))
  } catch {
    // Not saved; the search itself still works
  }
}

async function removeRecentSearch(item) {
  const previous = recentSearches.value
  recentSearches.value = previous.filter(recent => recent.id !== item.id) // update the screen straight away
  try {
    setRecentSearches(await deleteRecentSearch(item.id))
  } catch {
    recentSearches.value = previous
  }
}

async function clearRecentSearches() {
  const previous = recentSearches.value
  recentSearches.value = []
  try {
    await clearAllRecentSearches()
  } catch {
    recentSearches.value = previous
  }
}

// Clicking a recent search goes straight to the results
function useRecentSearch(item) {
  selectDestination(item)
  goToResults()
}

function saveSearch() {
  localStorage.setItem(SEARCH_KEY, JSON.stringify({
    destination: destination.value,
    selectedDestination: selectedDestination.value,
    vehicleType: vehicleType.value,
  }))
  window.dispatchEvent(new Event('search-changed'))
}

function clearSearch() {
  searchRequest += 1
  searchError.value = ''
  destination.value = ''
  results.value = []
  selectedDestination.value = null
  vehicleType.value = 'C'
  localStorage.removeItem(SEARCH_KEY)
  localStorage.removeItem('lastComparison')
  window.dispatchEvent(new Event('search-changed'))
}

watch(vehicleType, () => {
  if (selectedDestination.value) saveSearch()
})


async function searchDestination() {
  // Only the latest request may update the suggestions, even on a slow connection.
  const requestId = ++searchRequest
  selectedDestination.value = null
  searchError.value = ''
  results.value = []

  if (destination.value.trim() === '') {
    results.value = []
    return
  }
  
  try {
    const response = await api.get('/locations/search', {
      params: { q: destination.value.trim() },
    })
    if (requestId !== searchRequest) return
    results.value = Array.isArray(response.data.results) ? response.data.results : []
    if (!results.value.length) searchError.value = 'No matching destinations. Try another name or postal code.'
  } catch (error) {
    if (requestId !== searchRequest) return
    searchError.value = error.response?.data?.message || 'Unable to search destinations. Please try again.'
  }
}


function selectDestination(item) {
  searchRequest += 1
  searchError.value = ''
  selectedDestination.value = item
  destination.value = item.SEARCHVAL
  results.value = []
  saveSearch()
}

// "Use my current location": the browser's Geolocation API gives the user's
// position, which is used as the destination (no typing needed).
const locating = ref(false)
const locationError = ref('')

function useCurrentLocation() {
  locationError.value = ''
  if (!('geolocation' in navigator)) {
    locationError.value = 'Your browser does not support location access.'
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locating.value = false
      const { latitude, longitude } = position.coords
      // The app only has Singapore carpark data
      const inSingapore = latitude > 1.15 && latitude < 1.48 && longitude > 103.6 && longitude < 104.1
      if (!inSingapore) {
        locationError.value = 'Your location seems to be outside Singapore. Please search for a destination instead.'
        return
      }
      results.value = []
      searchRequest += 1
      searchError.value = ''
      destination.value = 'Current location'
      selectedDestination.value = {
        SEARCHVAL: 'Current location',
        LATITUDE: latitude.toFixed(6),
        LONGITUDE: longitude.toFixed(6),
        isCurrentLocation: true,
      }
      goToResults()
    },
    (error) => {
      locating.value = false
      locationError.value = error.code === error.PERMISSION_DENIED
        ? 'Location access was blocked. Allow location in your browser settings, or search for a destination.'
        : 'Could not get your location. Please try again or search for a destination.'
    },
    { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
  )
}

function goToResults() {
  if (selectedDestination.value === null) {
    return
  }

  saveSearch()
  // "Current location" changes every time, so it is not kept in recent searches
  if (!selectedDestination.value.isCurrentLocation) addRecentSearch(selectedDestination.value)

  router.push({
    name : "results",
    query : {
      destination : selectedDestination.value.SEARCHVAL,
      latitude : selectedDestination.value.LATITUDE,
      longitude : selectedDestination.value.LONGITUDE,
      vehicleType : vehicleType.value
    }
  })

}
</script>
<template>
  <section class="search-page">
    <div class="search-hero">
      <div class="hero-inner">
        <div class="hero-copy">
          <h1>Find parking near your<br><span>destination</span></h1>
        </div>

        <div class="route-graphic" aria-hidden="true">
          <span class="road road-one"></span>
          <span class="road road-two"></span>
          <span class="road road-three"></span>
          <span class="route-dot"></span>
          <span class="route-pin">P</span>
        </div>
      </div>
    </div>

    <div class="search-content">
      <form class="search-card" @submit.prevent="goToResults">
        <div class="destination-field">
          <label for="destination">Destination</label>
          <div class="position-relative">
            <input id="destination" v-model="destination" type="text" name="destination"
              placeholder="e.g. Suntec City or a postal code" autocomplete="off" @input="searchDestination" />
            <ul v-if="results.length > 0" class="dropdown-menu show w-100 top-100 start-0 shadow destination-suggestions"
              aria-label="Destination suggestions">
              <li v-for="(item, index) in results" :key="index">
                <button class="dropdown-item text-wrap" type="button" @click="selectDestination(item)">{{ item.SEARCHVAL }}</button>
              </li>
            </ul>
          </div>
          <small v-if="searchError" class="location-error" role="alert">{{ searchError }}</small>
          <button class="location-button" type="button" :disabled="locating" @click="useCurrentLocation">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M12 5.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z" /></svg>
            {{ locating ? 'Finding your location…' : 'Use my current location' }}
          </button>
          <small v-if="locationError" class="location-error" role="alert">{{ locationError }}</small>
        </div>

        <div class="vehicle-field">
          <FilterDropdown id="vehicle-type" v-model="vehicleType" label="Vehicle type" label-class="" :options="vehicleOptions" />
        </div>

        <div class="search-actions">
          <button v-if="destination" class="clear-button" type="button" @click="clearSearch">Clear</button>
          <button class="search-button" type="submit" :disabled="!selectedDestination">Search</button>
        </div>
        <section v-if="recentSearches.length" class="recent-searches" aria-label="Recent searches">
          <div class="recent-header">
            <h2>Recent searches</h2>
            <button class="recent-clear" type="button" @click="clearRecentSearches">Clear all</button>
          </div>
          <ul class="recent-list">
            <li v-for="item in recentSearches" :key="item.id" class="recent-chip">
              <button class="recent-chip-main" type="button" :title="`Search parking near ${item.SEARCHVAL}`" @click="useRecentSearch(item)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z" /></svg>
                <span>{{ item.SEARCHVAL }}</span>
              </button>
              <button class="recent-chip-remove" type="button" :aria-label="`Remove ${item.SEARCHVAL} from recent searches`" @click="removeRecentSearch(item)">×</button>
            </li>
          </ul>
        </section>
      </form>

      <RouterLink class="community-feature" to="/community">
        <span class="community-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-3 3V11.5A7.5 7.5 0 0 1 9.5 4h3a7.5 7.5 0 0 1 7.5 7.5Z" />
            <path d="M7 10h8M7 14h5" />
          </svg>
        </span>
        <div class="community-copy">
          <h2>Community reviews</h2>
          <p>Read ratings and parking tips shared by other drivers.</p>
        </div>
        <span class="community-cta">Explore Community <span aria-hidden="true">→</span></span>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.search-page {
  min-height: 100%;
  background-color: #f0fbf6;
  background-image: radial-gradient(#bfe9d7 1.1px, transparent 1.1px);
  background-size: 19px 19px;
}

.search-hero {
  overflow: hidden;
  color: white;
  background: #073f32;
}

.hero-inner {
  position: relative;
  width: min(100% - 3rem, 76rem);
  min-height: 16rem;
  margin-inline: auto;
  display: flex;
  align-items: center;
}

.hero-copy { position: relative; z-index: 2; width: 72%; padding-block: 2.75rem 4rem; }
.hero-copy h1 { color: white; font-size: clamp(2.3rem, 4.5vw, 3.5rem); line-height: 1.05; letter-spacing: -.045em; }
.hero-copy h1 span { color: #2cd790; }

.route-graphic { position: absolute; inset: 0 0 0 58%; overflow: hidden; }
.road { position: absolute; display: block; background: #17684f; }
.road-one { top: 18%; right: 7%; width: 1.1rem; height: 47%; border-radius: 1rem; }
.road-two { top: 50%; right: 7%; width: 62%; height: 1rem; border-radius: 1rem; }
.road-three { right: 42%; bottom: -8%; width: 1.2rem; height: 58%; border-radius: 1rem 1rem 0 0; background: #2cd790; box-shadow: 0 0 0 .35rem #17684f; }
.route-dot { position: absolute; top: 20%; left: 40%; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: #168063; }
.route-pin { position: absolute; top: 42%; right: 0; display: grid; width: 2.5rem; height: 2.5rem; place-items: center; border-radius: 50%; color: #073f32; background: #2cd790; font-weight: 800; box-shadow: -5rem 0 0 -.9rem #2cd790; }

.search-content { position: relative; width: min(100% - 3rem, 76rem); margin: -2rem auto 0; padding-bottom: 3rem; }
.search-card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(10rem, .45fr) auto; gap: 1.25rem; align-items: start; padding: 1.6rem; border: 2px solid #174f40; border-radius: 1.25rem; background: white; box-shadow: 0 10px 24px #073f3210; }
.search-card label { display: block; margin-bottom: .45rem; font-size: .8rem; font-weight: 750; }
.search-card input, .search-card select { width: 100%; min-height: 3.2rem; padding: .8rem 1rem; border: 1.5px solid #174f40; border-radius: .8rem; background: white; outline: none; }
.search-card input:focus, .search-card select:focus { border-color: #0a9e70; box-shadow: 0 0 0 .2rem #2cd79025; }
.destination-field small { display: block; margin-top: .5rem; color: #52606d; }
.destination-field small.location-error { color: #a02f2f; }
.location-button { display: inline-flex; align-items: center; gap: .4rem; margin-top: .6rem; padding: 0; border: 0; color: #087a58; background: none; font-size: .85rem; font-weight: 750; }
.location-button:hover:not(:disabled) { text-decoration: underline; }
.location-button:disabled { opacity: .6; }
.location-button svg { width: 1.05rem; height: 1.05rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.destination-suggestions { z-index: 20; max-height: 16rem; overflow-y: auto; }
.search-actions { display: flex; min-width: 10rem; gap: .5rem; margin-top: 1.65rem; }
.search-button, .clear-button { min-height: 3.2rem; border-radius: .8rem; font-weight: 750; }
.search-button { flex: 1; border: 1px solid #07875f; color: #06271f; background: #2cd790; }
.search-button:hover:not(:disabled) { background: #25c985; }
.search-button:disabled { opacity: .5; }
.clear-button { padding-inline: .8rem; border: 1px solid #82958e; color: #40534c; background: white; }

.recent-searches { grid-column: 1 / -1; margin-top: -.25rem; padding-top: 1rem; border-top: 1px solid #e3ebe7; }
.recent-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .6rem; }
.recent-header h2 { margin: 0; color: #173e30; font-size: .85rem; font-weight: 750; }
.recent-clear { padding: 0; border: 0; color: #087a58; background: none; font-size: .8rem; font-weight: 700; }
.recent-clear:hover { text-decoration: underline; }
.recent-list { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0; padding: 0; list-style: none; }
.recent-chip { display: inline-flex; align-items: center; max-width: 100%; border: 1.5px solid #b8cec5; border-radius: 2rem; background: white; }
.recent-chip:hover { border-color: #0a9e70; }
.recent-chip-main { display: inline-flex; align-items: center; gap: .4rem; min-width: 0; padding: .45rem .3rem .45rem .8rem; border: 0; color: #173e30; background: none; font-size: .85rem; font-weight: 650; }
.recent-chip-main span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 16rem; }
.recent-chip-main svg { width: 1rem; height: 1rem; flex-shrink: 0; fill: none; stroke: #087a58; stroke-width: 2; stroke-linecap: round; }
.recent-chip-remove { padding: .3rem .7rem .3rem .3rem; border: 0; color: #82958e; background: none; font-size: 1.05rem; line-height: 1; }
.recent-chip-remove:hover { color: #a02f2f; }
.community-feature { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 1rem; margin-top: 2rem; padding: 1.25rem 1.5rem; border: 1px solid #b8cec5; border-radius: 1rem; background: #e5f6ed; color: inherit; text-decoration: none; }
.community-icon { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; border-radius: .8rem; color: #087a58; background: white; }
.community-icon svg { width: 1.5rem; height: 1.5rem; }
.community-copy h2 { margin: 0 0 .3rem; font-size: 1.1rem; font-weight: 750; }
.community-copy p { margin: 0; color: #52665d; font-size: .9rem; }
.community-cta { color: #087a58; font-size: .9rem; font-weight: 750; white-space: nowrap; }
.community-feature:hover { border-color: #0a9e70; }

@media (max-width: 850px) {
  .hero-copy { width: 75%; }
  .route-graphic { inset-inline-start: 62%; opacity: .7; }
  .search-card { grid-template-columns: 1fr 1fr; }
  .destination-field { grid-column: 1 / -1; }
}

@media (max-width: 575px) {
  .hero-inner, .search-content { width: min(100% - 2rem, 76rem); }
  .hero-copy { width: 100%; padding-block: 2.5rem 4rem; }
  .hero-inner { min-height: 14rem; }
  .route-graphic { display: none; }
  .search-card { grid-template-columns: 1fr; padding: 1.15rem; }
  .destination-field { grid-column: auto; }
  .search-actions { margin-top: 0; }
  .community-feature { grid-template-columns: auto minmax(0, 1fr); padding: 1.25rem; }
  .community-cta { grid-column: 2; white-space: normal; }
}
</style>

