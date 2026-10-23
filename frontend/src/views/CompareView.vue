<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mockCarparks } from '../data/mockCarparks'
import { rankCarparks } from '../utils/ranking';

const route = useRoute()
const preference = ref('lots')
const weightOptions = {
  lots: { lots: 0.7, walk: 0.3, label: 'More lots' },
  balanced: { lots: 0.5, walk: 0.5, label: 'Balanced' },
  walk: { lots: 0.3, walk: 0.7, label: 'Shorter walk' }
}

const selectedIds = computed(() => {
  const ids = route.query.ids
  if (!ids) {
    return []
  }
  return ids.split(',')
})

const selectedCarparks = computed(() =>
  mockCarparks.filter(carpark => selectedIds.value.includes(carpark.id))
)
const ranked = computed(() => rankCarparks(selectedCarparks.value, weightOptions[preference.value]))

function toStar(score) {
  const filled = Math.round(score * 5)
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

const expandedIds = ref([])
function toggle(id) {
  if (expandedIds.value.includes(id)) {
    expandedIds.value = expandedIds.value.filter(x => x != id)
  } else {
    expandedIds.value.push(id)
  }
}
</script>

<template>
  <h2>Compare Carparks</h2>
  <p class="text-secondary mb-2">What matters more to you?</p>
  <div class="btn-group mb-4">
    <template v-for="(value, key) in weightOptions" :key="key">
      <input type="radio" class="btn-check" :id="'pref-' + key" :value="key" v-model="preference">
      <label class="btn btn-outline-success" :for="'pref-' + key">{{ value.label }}</label>
    </template>
  </div>


  <table class="table table-bordered">
    <thead>
      <tr>
        <th>Rank</th>
        <th>Carpark</th>
        <th>Rating</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <template v-for="carpark in ranked" :key='carpark.id'>
        <tr>
          <td>{{ carpark.rank }}</td>
          <td>{{ carpark.name }}</td>
          <td>{{ toStar(carpark.score) }}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" @click="toggle(carpark.id)">
              {{ expandedIds.includes(carpark.id) ? 'Hide' : 'More' }}
            </button>
          </td>
        </tr>
        <tr v-if="expandedIds.includes(carpark.id)">
          <td colspan="4" class="bg-light">
            Available lots: {{ carpark.availableLots ?? '-' }} <br />
            Walking time: {{ carpark.walkingTime }} min
          </td>
        </tr>
      </template>

    </tbody>
  </table>

</template>
