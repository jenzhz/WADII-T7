<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import { rankCarparks } from '../utils/ranking'
import { normaliseCarparks, formatDistance } from '../utils/carparkResults'

const route = useRoute()
const router = useRouter()
const COMPARISON_KEY = 'lastComparison'
const preference = ref('walk')
const weightOptions = {
  walk: { lots: 0.3, walk: 0.7, mode: 'walk', label: 'Closer' },
  lots: { lots: 0.7, walk: 0.3, mode: 'lots', label: 'Available Lots' }
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
        radius: 1000
      }
    })
    const allCarparks = normaliseCarparks(response.data.carparks)
    selectedCarparks.value = allCarparks.filter(carpark => selectedIds.value.includes(carpark.id))
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

const ranked = computed(() => rankCarparks(selectedCarparks.value, weightOptions[preference.value]))
const  columnClass = computed(()=>{
  const count = ranked.value.length
  return 'col-md-' + Math.floor(12 / count)
})
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

// Shortest distance among the selected carparks (null values are skipped)
const bestDistance = computed(() => {
  let best = null
  for (const carpark of ranked.value) {
    if (carpark.distance != null && (best == null || carpark.distance < best)) {
      best = carpark.distance
    }
  }
  return best
})

</script>

<template>
  <section class="compare-page">
    <div class="compare-inner">
    <h1 class="h2 mb-3">Compare Carparks</h1>

    <!-- Loading / error / not enough carparks -->
    <p v-if="loading" class="text-secondary">Loading carparks…</p>
    <div v-else-if="message" class="alert alert-danger">{{ message }}</div>
    <div v-else-if="ranked.length < 2" class="alert alert-info">
      Select at least 2 carparks on the results page to compare them.
      <RouterLink :to="{ name: 'results', query: route.query }" class="alert-link">Back to results</RouterLink>
    </div>

    <template v-else>
      <!-- Preference buttons -->
      <p class="text-secondary mb-2">What matters more to you?</p>
      <div class="btn-group mb-4" role="group" aria-label="Ranking preference">
        <template v-for="(value, key) in weightOptions" :key="key">
          <input type="radio" class="btn-check" :id="'pref-' + key" :value="key" v-model="preference">
          <label class="btn btn-outline-success" :for="'pref-' + key">{{ value.label }}</label>
        </template>
      </div>
      
      <!-- 2 cards: 6/12 each, 3 cards: 4/12 each; stacked on phones -->
      <div class="row g-3">
        <div v-for="carpark in ranked" :key="carpark.id" class="col-12" :class="columnClass">
          <div class="card h-100 compare-card" :class="{ recommended: carpark.rank === 1 }">
            <div class="card-body d-flex flex-column">
              <div class="mb-2">
                <span v-if="carpark.rank === 1" class="badge bg-success">⭐ Recommended</span>
                <span v-else class="badge bg-secondary">#{{ carpark.rank }}</span>
              </div>

              <h2 class="h6 fw-bold mb-1">{{ carpark.name }}</h2>
              <span v-if="carpark.hasEvCharger" class="ev-charging-badge mb-3"
                title="EV charging point available" aria-label="EV charging point available">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66l.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8Z" />
                </svg>
                EV Charging
              </span>

              <dl class="metrics mb-3">
                <div :class="{ best: bestLots != null && carpark.availableLots === bestLots }">
                  <dt>Available lots</dt>
                  <dd>{{ carpark.availableLots ?? '—' }}</dd>
                </div>
                <div :class="{ best: bestDistance != null && carpark.distance === bestDistance }">
                  <dt>Distance</dt>
                  <dd>{{ formatDistance(carpark.distance ?? null) }}</dd>
                </div>
              </dl>

              <RouterLink class="details-link mt-auto"
                :to="{ name: 'carpark-details', params: { id: carpark.id }, query: { ...route.query, ...(carpark.hasEvCharger ? { hasEv: '1' } : {}) } }">
                View details →
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

      <p class="small text-secondary mt-3">
        Highlighted values are the best in each category. Distance is the straight-line distance from your destination.
      </p>
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
.compare-card {
  border-radius: 1rem;
  border: 1px solid #d9e3df;
}
.compare-card.recommended {
  border: 2px solid #0f5c4d;
}
.ev-charging-badge { display: inline-flex; align-self: flex-start; align-items: center; gap: .3rem; padding: .3rem .6rem; border-radius: 2rem; color: #15803d; background: #dcfce7; font-size: .72rem; font-weight: 750; white-space: nowrap; }
.ev-charging-badge svg { width: 1rem; height: 1rem; }
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
