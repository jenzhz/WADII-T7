<script setup>
import { computed } from 'vue'
import { formatDistance } from '@/utils/carparkResults'

const props = defineProps({
  carpark: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  selectionDisabled: { type: Boolean, default: false },
  contextQuery: { type: Object, default: () => ({}) },
})
defineEmits(['toggle-compare'])
const availability = computed(() => {
  const lots = props.carpark.availableLots
  if (lots == null) return { label: 'Availability unknown', className: 'unknown' }
  if (lots === 0) return { label: 'Full', className: 'full' }
  if (lots <= 20) return { label: 'Limited lots', className: 'limited' }
  return { label: 'Lots available', className: 'available' }
})
const detailsQuery = computed(() => ({
  ...props.contextQuery,
  name: props.carpark.name,
  ...(props.carpark.hasEvCharger ? { hasEv: '1' } : {}),
}))
</script>

<template>
  <article class="carpark-card h-100" :class="{ selected }">
    <div class="d-flex justify-content-between align-items-start gap-2 mb-4">
      <span class="parking-icon" aria-hidden="true">P</span>
      <span class="availability" :class="availability.className">{{ availability.label }}</span>
    </div>
    <h3 class="h5 fw-bold mb-1 d-flex align-items-center gap-2 flex-wrap">
      <span>{{ carpark.name }}</span>
      <span
        v-if="carpark.hasEvCharger"
        class="ev-leaf-badge"
        title="EV charging point available"
        aria-label="EV charging point available"
      >
        <svg class="ev-leaf-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66l.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8Z"
          />
        </svg>
      </span>
    </h3>
    <p class="text-secondary small mb-4">{{ carpark.agency || 'Carpark' }} · {{ carpark.carparkId || carpark.id }} · {{ { C: 'Car', Y: 'Motorcycle', H: 'Heavy vehicle' }[carpark.lotType] || carpark.lotType }}</p>
    <p class="rate-line small mb-3">
      <span class="rate-pill">{{ carpark.rate?.label ?? '—' }}</span>
      <span v-if="carpark.rate?.rateType" class="text-secondary ms-1">{{ carpark.rate.rateType }}</span>
    </p>
    <p class="small text-secondary" v-if="carpark.latitude != null && carpark.longitude != null">Coordinates: {{ carpark.latitude }}, {{ carpark.longitude }}</p>
    <dl class="metrics">
      <div><dt>Available lots</dt><dd>{{ carpark.availableLots ?? '—' }}</dd></div>
      <div><dt>Est. walk</dt><dd>{{ carpark.walkingTime == null ? '—' : `${carpark.walkingTime} min` }}</dd></div>
      <div><dt>Straight-line distance</dt><dd>{{ formatDistance(carpark.distance ?? null) }}</dd></div>
    </dl>
    <div class="mt-auto pt-3 border-top d-flex flex-wrap align-items-center justify-content-between gap-3">
      <label class="d-flex align-items-center gap-2 small">
        <input class="form-check-input mt-0" type="checkbox" :checked="selected"
          :disabled="selectionDisabled && !selected" @change="$emit('toggle-compare', carpark.id)" />
        Compare<span class="visually-hidden"> {{ carpark.name }}</span>
      </label>
      <RouterLink class="details-link" :to="{ name: 'carpark-details', params: { id: carpark.id }, query: detailsQuery }">
        View details <span aria-hidden="true">→</span>
      </RouterLink>
    </div>
  </article>
</template>

<style scoped>
.carpark-card { display: flex; flex-direction: column; padding: 1.7rem; border: 2px solid #174f40; border-radius: 1.4rem; background: white; transition: border-color .15s, box-shadow .15s, transform .15s; }
.carpark-card:hover { border-color: #75a798; box-shadow: 0 8px 24px #173e3010; }
.carpark-card.selected { border-color: #0f5c4d; box-shadow: 0 0 0 1px #0f5c4d; }
.parking-icon { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: .75rem; background: #2cd790; color: #073f32; font-weight: 800; font-size: 1.4rem; }
.ev-leaf-badge { display: inline-flex; align-items: center; justify-content: center; width: 1.65rem; height: 1.65rem; border-radius: 50%; background: #dcfce7; color: #15803d; flex-shrink: 0; }
.ev-leaf-icon { width: 1.05rem; height: 1.05rem; }
.availability { padding: .35rem .65rem; border-radius: 2rem; font-size: .72rem; font-weight: 700; }
.available { background: #e6f4f0; color: #0f5c4d; }
.limited { background: #fff1cf; color: #785100; }
.full { background: #fce5e5; color: #9f3030; }
.unknown { background: #edf0f3; color: #52606d; }
.metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; margin-bottom: 1.5rem; }
.metrics dt { color: #63716a; font-size: .72rem; font-weight: 400; margin-bottom: .4rem; }
.metrics dd { font-size: 1.1rem; font-weight: 700; margin: 0; }
.details-link { color: #0f5c4d; font-size: .85rem; font-weight: 700; text-decoration: none; }
.details-link:hover { text-decoration: underline; }
.rate-pill { display: inline-block; padding: .25rem .6rem; border-radius: 2rem; background: #f3f6f5; color: #173e30; font-weight: 700; font-size: .78rem; }
.form-check-input:checked { background-color: #0f5c4d; border-color: #0f5c4d; }
</style>
