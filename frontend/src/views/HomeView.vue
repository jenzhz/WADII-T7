<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router' 
import api from '@/services/api'

const router = useRouter()
const SEARCH_KEY = 'carparkcompare.search'

const destination = ref("")
const results = ref([])

const selectedDestination = ref(null)

const vehicleType = ref('C')

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
          <p class="hero-eyebrow">Find parking</p>
          <h1>Find parking near your<br><span>destination</span></h1>
          <p>Search for a destination and choose your vehicle type.</p>
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
          <small>Choose a matching destination from the suggestions.</small>
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
          <button class="search-button" type="submit">Search</button>
        </div>
      </form>

      <div class="feature-grid">
        <article><h2>Live availability</h2><p>Real-time lots from LTA DataMall.</p></article>
        <article><h2>Walking routes</h2><p>Distance and time from carpark to destination.</p></article>
        <article><h2>Side-by-side compare</h2><p>Pick carparks and weigh them up.</p></article>
        <RouterLink class="community-feature" to="/community">
          <h2>Community reviews</h2>
          <p>See ratings and experiences shared by other drivers.</p>
          <span>Explore Community →</span>
        </RouterLink>
      </div>
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
  min-height: 23rem;
  margin-inline: auto;
  display: flex;
  align-items: center;
}

.hero-copy { position: relative; z-index: 2; width: 62%; padding-block: 4rem; }
.hero-eyebrow { margin-bottom: 1rem; color: #2cd790; font-size: .82rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.hero-copy h1 { color: white; font-size: clamp(2.7rem, 5vw, 4.5rem); line-height: 1.02; letter-spacing: -.055em; }
.hero-copy h1 span { color: #2cd790; }
.hero-copy > p:last-child { margin: 1.25rem 0 0; font-size: 1.05rem; }

.route-graphic { position: absolute; inset: 0 0 0 58%; overflow: hidden; }
.road { position: absolute; display: block; background: #17684f; }
.road-one { top: 18%; right: 7%; width: 1.1rem; height: 47%; border-radius: 1rem; }
.road-two { top: 50%; right: 7%; width: 62%; height: 1rem; border-radius: 1rem; }
.road-three { right: 42%; bottom: -8%; width: 1.2rem; height: 58%; border-radius: 1rem 1rem 0 0; background: #2cd790; box-shadow: 0 0 0 .35rem #17684f; }
.route-dot { position: absolute; top: 20%; left: 40%; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: #168063; }
.route-pin { position: absolute; top: 42%; right: 0; display: grid; width: 2.5rem; height: 2.5rem; place-items: center; border-radius: 50%; color: #073f32; background: #2cd790; font-weight: 800; box-shadow: -5rem 0 0 -.9rem #2cd790; }

.search-content { width: min(100% - 3rem, 76rem); margin-inline: auto; padding-block: 2rem 5rem; }
.search-card { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1.25rem; align-items: start; padding: 1.6rem; border: 2px solid #174f40; border-radius: 1.4rem; background: white; box-shadow: 0 10px 24px #073f3210; }
.search-card label { display: block; margin-bottom: .45rem; font-size: .8rem; font-weight: 750; }
.search-card input, .search-card select { width: 100%; min-height: 3.2rem; padding: .8rem 1rem; border: 1.5px solid #174f40; border-radius: .8rem; background: white; outline: none; }
.search-card input:focus, .search-card select:focus { border-color: #0a9e70; box-shadow: 0 0 0 .2rem #2cd79025; }
.destination-field small { display: block; margin-top: .5rem; color: #52606d; }
.destination-suggestions { z-index: 20; max-height: 16rem; overflow-y: auto; }
.search-actions { display: flex; gap: .5rem; margin-top: 1.65rem; }
.search-button, .clear-button { min-height: 3.2rem; border-radius: .8rem; font-weight: 750; }
.search-button { flex: 1; border: 1px solid #07875f; color: #06271f; background: #2cd790; }
.search-button:hover { background: #25c985; }
.clear-button { padding-inline: .8rem; border: 1px solid #82958e; color: #40534c; background: white; }

.feature-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; margin-top: 2rem; }
.feature-grid > * { min-height: 8.5rem; padding: 1.5rem; border: 2px solid #174f40; border-radius: 1.3rem; background: white; }
.feature-grid h2 { margin-bottom: .35rem; font-size: 1.05rem; font-weight: 750; }
.feature-grid p { margin: 0; color: #52606d; line-height: 1.35; }
.community-feature { display: flex; flex-direction: column; color: inherit; text-decoration: none; transition: transform .15s, border-color .15s, box-shadow .15s; }
.community-feature span { margin-top: auto; padding-top: .75rem; color: #087a58; font-size: .82rem; font-weight: 800; }
.community-feature:hover { border-color: #0a9e70; box-shadow: 0 8px 20px #073f3212; transform: translateY(-2px); }

@media (max-width: 850px) {
  .hero-inner { min-height: 20rem; }
  .hero-copy { width: 75%; }
  .route-graphic { inset-inline-start: 62%; opacity: .7; }
  .search-card { grid-template-columns: 1fr 1fr; }
  .destination-field { grid-column: 1 / -1; }
  .feature-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 575px) {
  .hero-inner, .search-content { width: min(100% - 2rem, 76rem); }
  .hero-copy { width: 100%; }
  .route-graphic { display: none; }
  .search-card { grid-template-columns: 1fr; padding: 1.15rem; }
  .destination-field { grid-column: auto; }
  .search-actions { margin-top: 0; }
  .feature-grid { grid-template-columns: 1fr; }
}
</style>

