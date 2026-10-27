<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '@/services/api'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { formatDistance, normaliseCarparks } from '@/utils/carparkResults'
import { rankCarparks } from '@/utils/ranking'

const weightOptions = {
  lots: { lots: 0.7, walk: 0.3, mode: 'lots', label: 'More lots' },
  balanced: { lots: 0.5, walk: 0.5, mode: 'balanced', label: 'Balanced' },
  walk: { lots: 0.3, walk: 0.7, mode: 'walk', label: 'Closer' },
}

const favourites = ref([])
const activeFavourite = ref(null)
const carparks = ref([])
const preference = ref('balanced')
const vehicleType = ref('C')
const loadingFavourites = ref(true)
const loadingCarparks = ref(false)
const favouritesError = ref('')
const carparksError = ref('')

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
  } catch (error) {
    favouritesError.value = error.response?.data?.message || 'Unable to load favourites.'
  } finally {
    loadingFavourites.value = false
  }
}

async function loadCarparks() {
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
        radius: 5000,
      },
    })
    carparks.value = normaliseCarparks(data.carparks)
  } catch (error) {
    carparksError.value = error.response?.data?.message || 'Unable to load nearby carparks.'
  } finally {
    loadingCarparks.value = false
  }
}

async function selectFavourite(favourite) {
  activeFavourite.value = favourite
  preference.value = 'balanced'
  await loadCarparks()
}

async function removeFavourite(favourite) {
  favouritesError.value = ''
  try {
    await api.delete(`/favourites/${favourite.id}`)
    favourites.value = favourites.value.filter(item => item.id !== favourite.id)
    if (activeFavourite.value?.id === favourite.id) {
      activeFavourite.value = null
      carparks.value = []
      carparksError.value = ''
    }
  } catch (error) {
    favouritesError.value = error.response?.data?.message || 'Unable to remove favourite.'
  }
}

onMounted(loadFavourites)
</script>

<template>
  <section class="favourites-page">
    <div class="favourites-inner">
    <div class="mb-4">
      <p class="text-uppercase text-primary fw-semibold small mb-2">Your places</p>
      <h1>Favourite destinations</h1>
      <p class="text-secondary mb-0">Choose a saved destination to see its best live parking options.</p>
    </div>

    <div v-if="favouritesError" class="alert alert-danger" role="alert">{{ favouritesError }}</div>
    <div v-if="loadingFavourites" class="state-panel"><LoadingSpinner /><p class="mt-3 mb-0">Loading favourites…</p></div>
    <div v-else-if="favourites.length === 0" class="state-panel">
      <h2 class="h5">No favourite destinations yet</h2>
      <p class="text-secondary">Search for a destination and add it to favourites from the results page.</p>
      <RouterLink class="btn btn-success" to="/">Find a destination</RouterLink>
    </div>

    <div v-else class="row g-4 align-items-start">
      <div class="col-lg-4">
        <h2 class="h5 mb-3">Destinations</h2>
        <div class="d-grid gap-2">
          <article v-for="favourite in favourites" :key="favourite.id" class="destination-card"
            :class="{ active: activeFavourite?.id === favourite.id }">
            <button class="destination-select text-start" type="button" @click="selectFavourite(favourite)">
              <strong>{{ favourite.label }}</strong>
              <span>View nearby carparks</span>
            </button>
            <button class="btn btn-sm btn-link text-danger" type="button" @click="removeFavourite(favourite)">Remove</button>
          </article>
        </div>
      </div>

      <div class="col-lg-8">
        <div v-if="!activeFavourite" class="selection-empty-state">
          <span class="empty-parking-icon" aria-hidden="true">P</span>
          <h2>Select a favourite destination</h2>
          <p>Choose one of your saved places to see its top three live carpark options.</p>
          <span class="selection-hint" aria-hidden="true">← Select a destination</span>
        </div>

        <template v-else>
          <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
            <div>
              <p class="small text-secondary mb-1">Parking near</p>
              <h2 class="h4 mb-0">{{ activeFavourite.label }}</h2>
            </div>
            <div>
              <label class="form-label small" for="favourite-vehicle">Vehicle type</label>
              <select id="favourite-vehicle" v-model="vehicleType" class="form-select" @change="loadCarparks">
                <option value="C">Car</option>
                <option value="Y">Motorcycle</option>
                <option value="H">Heavy vehicle</option>
              </select>
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
            <div v-for="carpark in rankedCarparks" :key="carpark.id" class="col-md-4">
              <article class="carpark-card h-100" :class="{ recommended: carpark.rank === 1 }">
                <span class="badge mb-3" :class="carpark.rank === 1 ? 'bg-success' : 'bg-secondary'">
                  {{ carpark.rank === 1 ? 'Recommended' : `#${carpark.rank}` }}
                </span>
                <h3 class="h6 fw-bold">{{ carpark.name }}</h3>
                <dl class="small mb-3">
                  <div><dt>Available lots</dt><dd>{{ carpark.availableLots ?? '—' }}</dd></div>
                  <div><dt>Distance</dt><dd>{{ formatDistance(carpark.distance) }}</dd></div>
                </dl>
                <RouterLink class="mt-auto" :to="{ name: 'carpark-details', params: { id: carpark.id }, query: contextQuery }">View details →</RouterLink>
              </article>
            </div>
          </div>
        </template>
      </div>
    </div>
    </div>
  </section>
</template>

<style scoped>
.favourites-page { min-height: 100%; padding: 2.5rem 1.5rem 5rem; background-color: #f0fbf6; background-image: radial-gradient(#bfe9d7 1.1px, transparent 1.1px); background-size: 19px 19px; }
.favourites-inner { width: min(100%, 76rem); margin: auto; }
.favourites-page h1 { font-size: clamp(2.5rem, 5vw, 4rem); }
.state-panel { text-align: center; padding: 3rem 1rem; border: 2px dashed #9ebfb3; border-radius: 1.3rem; background: rgba(255, 255, 255, .72); }
.destination-card { display: flex; align-items: center; gap: .5rem; border: 2px solid #174f40; border-radius: 1.25rem; background: white; overflow: hidden; }
.destination-card.active { border-color: #174f40; background: #dff7ec; box-shadow: none; }
.destination-select { flex: 1; display: grid; gap: .2rem; padding: 1rem; border: 0; background: transparent; color: inherit; }
.destination-select span { color: #63716a; font-size: .8rem; }
.destination-card .text-danger { padding-right: 1rem; color: #b62d24 !important; font-weight: 650; }
.selection-empty-state { display: grid; min-height: 22rem; padding: 3rem 2rem; place-items: center; align-content: center; border: 2px dashed #9ebfb3; border-radius: 1.4rem; color: #52665d; background: rgba(255, 255, 255, .7); text-align: center; }
.selection-empty-state h2 { margin: 1rem 0 .5rem; color: #10243a; font-size: 1.5rem; }
.selection-empty-state p { max-width: 28rem; margin: 0; }
.empty-parking-icon { display: grid; width: 4rem; height: 4rem; place-items: center; border-radius: 1.1rem; color: #073f32; background: #2cd790; box-shadow: 0 8px 20px #07875f22; font-size: 2rem; font-weight: 800; }
.selection-hint { margin-top: 1.25rem; color: #087a58; font-size: .85rem; font-weight: 750; }
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
  .selection-hint { display: none; }
}
</style>

