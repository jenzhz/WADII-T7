<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router' 
import api from '@/services/api'

const router = useRouter()
const SEARCH_KEY = 'carparkcompare.search'

const destination = ref("")
const results = ref([])

const selectedDestination = ref(null)

const vehicleType = ref('C')
const favourites = ref([])
const loadingFavourites = ref(true)
const favouritesError = ref('')
const destinationFavourites = computed(() => favourites.value.filter(favourite => favourite.type === 'destination').slice(0, 3))
const carparkFavourites = computed(() => favourites.value.filter(favourite => favourite.type === 'carpark').slice(0, 3))

async function loadFavourites() {
  loadingFavourites.value = true
  favouritesError.value = ''
  try {
    const response = await api.get('/favourites')
    favourites.value = response.data.favourites
  } catch (error) {
    favouritesError.value = error.response?.data?.message || 'Unable to load your favourites.'
  } finally {
    loadingFavourites.value = false
  }
}

function searchFavourite(favourite) {
  selectDestination({
    SEARCHVAL: favourite.label,
    LATITUDE: favourite.latitude,
    LONGITUDE: favourite.longitude,
  })
  goToResults()
}

function favouriteDetailsLink(favourite) {
  const lotType = favourite.carparkId?.split(':').at(-1)
  return {
    name: 'carpark-details',
    params: { id: favourite.carparkId },
    query: {
      name: favourite.label,
      lotType: ['C', 'Y', 'H'].includes(lotType) ? lotType : 'C',
      from: 'search',
    },
  }
}

onMounted(loadFavourites)

function saveSearch() {
  localStorage.setItem(SEARCH_KEY, JSON.stringify({
    destination: destination.value,
    selectedDestination: selectedDestination.value,
    vehicleType: vehicleType.value,
  }))
  window.dispatchEvent(new Event('search-changed'))
}

function clearSearch() {
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
  selectedDestination.value = null

  if (destination.value.trim() === '') {
    results.value = []
    return
  }
  
  const response = await api.get('/locations/search', {
    params : {
      q : destination.value
    }
  })
  results.value = response.data.results
}


function selectDestination(item) {
  selectedDestination.value = item
  destination.value = item.SEARCHVAL
  results.value = []
  saveSearch()
}

function goToResults() {
  if (selectedDestination.value === null) {
    return
  }

  saveSearch()

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
              placeholder="e.g. Suntec City or a postal code" autocomplete="off" aria-describedby="destination-help" @input="searchDestination" />
            <ul v-if="results.length > 0" class="dropdown-menu show w-100 top-100 start-0 shadow destination-suggestions"
              aria-label="Destination suggestions">
              <li v-for="(item, index) in results" :key="index">
                <button class="dropdown-item text-wrap" type="button" @click="selectDestination(item)">{{ item.SEARCHVAL }}</button>
              </li>
            </ul>
          </div>
          <small id="destination-help">{{ selectedDestination ? 'Destination selected. Ready to search.' : 'Choose a matching destination from the suggestions.' }}</small>
        </div>

        <div class="vehicle-field">
          <label for="vehicle-type">Vehicle type</label>
          <select id="vehicle-type" v-model="vehicleType">
            <option value="C">Car</option>
            <option value="Y">Motorcycle</option>
            <option value="H">Heavy Vehicle</option>
          </select>
        </div>

        <div class="search-actions">
          <button v-if="destination" class="clear-button" type="button" @click="clearSearch">Clear</button>
          <button class="search-button" type="submit" :disabled="!selectedDestination">Search</button>
        </div>
      </form>

      <section class="home-favourites" aria-labelledby="home-favourites-heading">
        <div class="favourites-heading">
          <h2 id="home-favourites-heading">My favourites</h2>
          <RouterLink to="/favourites">View all →</RouterLink>
        </div>
        <p v-if="loadingFavourites" class="favourites-state" role="status">Loading your favourites…</p>
        <div v-else-if="favouritesError" class="favourites-state" role="alert">
          <p>{{ favouritesError }}</p>
          <button class="btn btn-outline-success" type="button" @click="loadFavourites">Try again</button>
        </div>
        <div v-else-if="!favourites.length" class="favourites-state">
          <p class="mb-0">No favourites yet. Save a destination or carpark to find it here next time.</p>
        </div>
        <template v-else>
          <section class="favourite-group" aria-labelledby="home-destinations-heading">
            <h3 id="home-destinations-heading">Favourite destinations</h3>
            <div v-if="destinationFavourites.length" class="favourites-grid">
              <article v-for="favourite in destinationFavourites" :key="favourite.id" class="favourite-card">
                <span class="favourite-type"><span aria-hidden="true">♥</span> Destination</span>
                <h4>{{ favourite.label }}</h4>
                <button class="favourite-action" type="button" @click="searchFavourite(favourite)">Find parking →</button>
              </article>
            </div>
            <p v-else class="favourite-group-empty">No saved destinations yet.</p>
          </section>
          <section class="favourite-group" aria-labelledby="home-carparks-heading">
            <h3 id="home-carparks-heading">Favourite carparks</h3>
            <div v-if="carparkFavourites.length" class="favourites-grid">
              <article v-for="favourite in carparkFavourites" :key="favourite.id" class="favourite-card">
                <span class="favourite-type"><span aria-hidden="true">♥</span> Carpark</span>
                <h4>{{ favourite.label }}</h4>
                <RouterLink class="favourite-action" :to="favouriteDetailsLink(favourite)">View carpark →</RouterLink>
              </article>
            </div>
            <p v-else class="favourite-group-empty">No saved carparks yet.</p>
          </section>
        </template>
      </section>

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
.destination-suggestions { z-index: 20; max-height: 16rem; overflow-y: auto; }
.search-actions { display: flex; min-width: 10rem; gap: .5rem; margin-top: 1.65rem; }
.search-button, .clear-button { min-height: 3.2rem; border-radius: .8rem; font-weight: 750; }
.search-button { flex: 1; border: 1px solid #07875f; color: #06271f; background: #2cd790; }
.search-button:hover:not(:disabled) { background: #25c985; }
.search-button:disabled { opacity: .5; }
.clear-button { padding-inline: .8rem; border: 1px solid #82958e; color: #40534c; background: white; }

.home-favourites { margin-top: 2.25rem; }
.favourites-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.favourites-heading h2 { margin: 0; color: #073f32; font-size: 1.4rem; }
.favourites-heading a, .favourite-action { color: #087a58; font-weight: 750; text-decoration: none; }
.favourites-heading a:hover, .favourite-action:hover { text-decoration: underline; }
.favourite-group + .favourite-group { margin-top: 1.5rem; }
.favourite-group > h3 { margin: 0 0 .85rem; color: #173e30; font-size: 1.05rem; }
.favourite-group-empty { margin: 0; padding: 1rem; border: 1px dashed #9ebfb3; border-radius: .85rem; color: #63716a; background: #ffffff99; }
.favourites-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.favourite-card { display: flex; flex-direction: column; align-items: flex-start; padding: 1.4rem; border: 2px solid #174f40; border-radius: 1.3rem; background: white; }
.favourite-type { display: inline-flex; align-items: center; gap: .4rem; color: #63716a; font-size: .8rem; }
.favourite-type span { color: #c92f54; font-size: 1.1rem; }
.favourite-card h4 { margin: .6rem 0 1.25rem; font-size: 1.1rem; overflow-wrap: anywhere; }
.favourite-action { margin-top: auto; padding: 0; border: 0; background: transparent; text-align: left; }
.favourites-state { margin: 0; padding: 1.5rem; border: 1.5px dashed #9ebfb3; border-radius: 1rem; color: #52665d; background: #ffffffbb; }

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
  .favourites-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 575px) {
  .hero-inner, .search-content { width: min(100% - 2rem, 76rem); }
  .hero-copy { width: 100%; padding-block: 2.5rem 4rem; }
  .hero-inner { min-height: 14rem; }
  .route-graphic { display: none; }
  .search-card { grid-template-columns: 1fr; padding: 1.15rem; }
  .destination-field { grid-column: auto; }
  .search-actions { margin-top: 0; }
  .favourites-grid { grid-template-columns: 1fr; }
  .community-feature { grid-template-columns: auto minmax(0, 1fr); padding: 1.25rem; }
  .community-cta { grid-column: 2; white-space: normal; }
}
</style>

