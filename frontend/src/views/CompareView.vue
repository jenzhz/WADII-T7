<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import { rankCarparks } from '../utils/ranking'
import { normaliseCarparks, formatDistance } from '../utils/carparkResults'
import RateSchedule from '@/components/RateSchedule.vue'

const route = useRoute()
const router = useRouter()
const COMPARISON_KEY = 'lastComparison'
const duration = ref(120) // minutes, used for the estimated cost
const durationOptions = [60, 120, 180, 240]
// Compare always ranks by one combined score: 50% available lots + 50% distance.
// Stars show the same score, so more stars always means a higher rank.
const RANKING_WEIGHT = { lots: 0.5, walk: 0.5, mode: 'balanced' }

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
        radius: 5000,
        duration: duration.value
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

// Re-fetch so the backend recalculates the estimated cost for the new duration
watch(duration, loadCarparks)

const ranked = computed(() => rankCarparks(selectedCarparks.value, RANKING_WEIGHT))
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
  if (carpark.estimatedCost != null) return `$${carpark.estimatedCost.toFixed(2)}`
  return carpark.rate?.costLabel ?? '—'
}

function toStar(score) {
  const filled = Math.round(score * 5)
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}
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
      <div class="d-flex flex-wrap align-items-center gap-2 mb-4">
        <label class="text-secondary mb-0" for="duration">How long will you park?</label>
        <select id="duration" v-model.number="duration" class="form-select w-auto">
          <option v-for="minutes in durationOptions" :key="minutes" :value="minutes">
            {{ minutes / 60 }} hour{{ minutes > 60 ? 's' : '' }}
          </option>
        </select>
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
              <p class="stars mb-3" :aria-label="Math.round(carpark.score * 5) + ' out of 5 stars'">
                {{ toStar(carpark.score) }}
              </p>

              <dl class="metrics mb-3">
                <div :class="{ best: bestLots != null && carpark.availableLots === bestLots }">
                  <dt>Available lots</dt>
                  <dd>{{ carpark.availableLots ?? '—' }}</dd>
                </div>
                <div :class="{ best: bestDistance != null && carpark.distance === bestDistance }">
                  <dt>Distance</dt>
                  <dd>{{ formatDistance(carpark.distance ?? null) }}</dd>
                </div>
                <div>
                  <dt>Rate type</dt>
                  <dd>{{ carpark.rate?.rateType ?? '—' }}</dd>
                </div>
                <div>
                  <dt>Rate now</dt>
                  <dd>{{ carpark.rate?.detail ?? carpark.rate?.label ?? '—' }}</dd>
                </div>
                <div :class="{ best: bestCost != null && carpark.estimatedCost === bestCost }">
                  <dt>Est. cost ({{ duration / 60 }}h)</dt>
                  <dd>{{ formatCost(carpark) }}</dd>
                </div>
              </dl>

              <div v-if="carpark.rate?.schedule" class="mb-3">
                <h3 class="h6 fw-bold mb-2">Parking rates</h3>
                <RateSchedule :rate="carpark.rate" compact :show-now="false" />
              </div>

              <RouterLink class="details-link mt-auto"
                :to="{ name: 'carpark-details', params: { id: carpark.id }, query: route.query }">
                View details →
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

      <aside class="compare-notes mt-4" aria-label="About these figures">
        <h2 class="notes-title">About these figures</h2>
        <ul class="notes-list">
          <li><span class="notes-swatch" aria-hidden="true"></span>Highlighted values are the best in each category.</li>
          <li><strong>HDB carparks:</strong> estimated cost based on HDB short-term parking charges, starting from now.</li>
          <li><strong>Malls &amp; buildings:</strong> published rates from LTA OneMotoring, shown under <em>Parking rates</em>. Each mall sets its own pricing rules, so the estimated cost shows <em>Varies</em> instead of a single amount.</li>
          <li><strong>URA carparks:</strong> rate information is currently not available (shown as —).</li>
        </ul>
      </aside>
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
.stars {
  color: #f5a623;
  letter-spacing: 2px;
  font-size: 1.1rem;
}
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
.compare-notes {
  padding: 1rem 1.25rem;
  border: 1px solid #d9e3df;
  border-left: 4px solid #0f5c4d;
  border-radius: 0.75rem;
  background: white;
}
.notes-title {
  margin-bottom: 0.5rem;
  color: #0f5c4d;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.notes-list {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding-left: 1.1rem;
  color: #4b5b54;
  font-size: 0.875rem;
}
.notes-list li::marker {
  color: #0f5c4d;
}
.notes-list strong {
  color: #173e30;
}
.notes-swatch {
  display: inline-block;
  width: 0.8rem;
  height: 0.8rem;
  margin-right: 0.4rem;
  border-radius: 0.2rem;
  background: #e6f4f0;
  border: 1px solid #b9ddd1;
  vertical-align: -0.1rem;
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
