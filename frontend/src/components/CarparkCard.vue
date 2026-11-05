<script setup>
import { computed } from 'vue'
import { formatDistance } from '@/utils/carparkResults'
import { parkingDifficultyDetails } from '@/utils/parkingDifficulty'
import { carparkTypeLabel } from '@/utils/carparkLabels'

const props = defineProps({
  carpark: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  selectionDisabled: { type: Boolean, default: false },
  contextQuery: { type: Object, default: () => ({}) },
  communitySummary: { type: Object, default: null },
  favourite: { type: Boolean, default: false },
  favouriteSaving: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle-compare', 'toggle-favourite'])

const canToggle = computed(() => props.selected || !props.selectionDisabled)
function onCardClick(event) {
  if (event.target !== event.currentTarget && event.target.closest('a, button, input, label')) return
  if (!canToggle.value) return
  emit('toggle-compare', props.carpark.id)
}
const availability = computed(() => {
  const lots = props.carpark.availableLots
  if (lots == null) return { label: 'Availability unknown', className: 'unknown' }
  if (lots === 0) return { label: 'Full', className: 'full' }
  if (lots <= 20) return { label: 'Limited lots', className: 'limited' }
  return { label: 'Lots available', className: 'available' }
})
const parkingDifficulty = computed(() => parkingDifficultyDetails(props.communitySummary?.parkingDifficulty))
const detailsQuery = computed(() => ({
  ...props.contextQuery,
  name: props.carpark.name,
  ...(props.carpark.hasEvCharger ? { hasEv: '1' } : {}),
}))
</script>

<template>
  <article
    class="carpark-card h-100"
    :class="{ selected, 'compare-locked': !canToggle }"
    :title="canToggle ? (selected ? 'Click to remove from Compare' : 'Click to add to Compare') : 'You can compare up to 3 carparks'"
    tabindex="0"
    :aria-label="`${carpark.name}. ${selected ? 'Selected for comparison' : 'Not selected for comparison'}. Press Enter to ${selected ? 'remove from' : 'add to'} Compare.`"
    @click="onCardClick"
    @keydown.enter.self.prevent="onCardClick"
    @keydown.space.self.prevent="onCardClick"
  >
    <!-- Header: icon + favourite -->
    <div class="card-header-row">
      <span class="parking-icon" aria-hidden="true">P</span>
      <button
        class="heart-button"
        :class="{ active: favourite }"
        type="button"
        :disabled="favouriteSaving"
        :aria-label="favourite ? `Remove ${carpark.name} from favourites` : `Add ${carpark.name} to favourites`"
        :title="favourite ? 'Remove from favourites' : 'Add to favourites'"
        @click="$emit('toggle-favourite', carpark)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9C.9 8.4 2.8 5 6.4 5c2.1 0 3.7 1.2 4.6 2.4C11.9 6.2 13.5 5 15.6 5c3.6 0 5.5 3.4 3.9 7-2 4.4-7.5 9-7.5 9Z" /></svg>
      </button>
    </div>

    <!-- Name + basic info -->
    <h3 class="carpark-name">{{ carpark.name }}</h3>
    <p class="carpark-meta">{{ carparkTypeLabel(carpark.agency) }} · {{ { C: 'Car', Y: 'Motorcycle', H: 'Heavy vehicle' }[carpark.lotType] || carpark.lotType }}</p>

    <!-- All status tags in one row, same style -->
    <div v-if="carpark.hasEvCharger || parkingDifficulty" class="tag-row">
      <span v-if="carpark.hasEvCharger" class="tag tag-ev" title="EV charging point available">
        <svg class="ev-leaf-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66l.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8Z"
          />
        </svg>
        EV Charging
      </span>
      <span
        v-if="parkingDifficulty"
        class="tag"
        :class="`difficulty-${parkingDifficulty.value}`"
        :title="`Community-rated parking difficulty: ${parkingDifficulty.label}. ${parkingDifficulty.description}`"
      >Parking: {{ parkingDifficulty.label }}</span>
    </div>

    <!-- Community rating -->
    <div class="community-preview" :class="{ empty: !communitySummary?.reviewCount }">
      <span aria-hidden="true">★</span>
      <strong v-if="communitySummary?.reviewCount">{{ Number(communitySummary.overallRating).toFixed(1) }}</strong>
      <span v-if="communitySummary?.reviewCount">({{ communitySummary.reviewCount }} review{{ communitySummary.reviewCount === 1 ? '' : 's' }})</span>
      <span v-else>No reviews yet</span>
    </div>

    <!-- Key numbers, 2 x 2 -->
    <dl class="metrics">
      <!-- Colour shows the status: green = plenty, amber = limited (20 or fewer), red = full -->
      <div>
        <dt>Available lots</dt>
        <dd class="lots-value" :class="`lots-${availability.className}`" :title="availability.label">
          {{ carpark.availableLots === 0 ? 'Full' : (carpark.availableLots ?? '—') }}
        </dd>
      </div>
      <div>
        <dt>Distance</dt>
        <!-- Walking distance from OneMap (same as the details page) once it has loaded;
             until then the straight-line distance, marked with "~" as an estimate -->
        <dd v-if="carpark.walkingDistance != null" title="Walking distance">{{ formatDistance(carpark.walkingDistance) }}</dd>
        <dd v-else-if="carpark.distance != null" title="Straight-line estimate">~{{ formatDistance(carpark.distance) }}</dd>
        <dd v-else>—</dd>
      </div>
      <div><dt>Walk</dt><dd>{{ carpark.walkingTime == null ? '—' : `${carpark.walkingTime} min` }}</dd></div>
      <div>
        <dt>Rate now</dt>
        <dd :title="carpark.rate?.detail && carpark.rate.detail !== carpark.rate.label ? carpark.rate.detail : undefined">{{ carpark.rate?.label ?? '—' }}</dd>
      </div>
    </dl>

    <div class="card-footer-row">
      <!-- Compare status (the whole card is the toggle) -->
      <span class="compare-status" :class="{ on: selected }" aria-hidden="true">
        <span class="compare-dot">{{ selected ? '✓' : '+' }}</span>
        {{ selected ? 'Added to Compare' : 'Tap card to compare' }}
      </span>
      <RouterLink class="details-link" :to="{ name: 'carpark-details', params: { id: carpark.id }, query: detailsQuery }">
        View details <span aria-hidden="true">→</span>
      </RouterLink>
    </div>
  </article>
</template>

<style scoped>
.carpark-card { display: flex; flex-direction: column; padding: 1.5rem; border: 2px solid #174f40; border-radius: 1.4rem; background: white; transition: border-color .15s, box-shadow .15s, transform .15s; }
.carpark-card:hover { border-color: #75a798; box-shadow: 0 8px 24px #173e3010; }
.carpark-card.selected { border-color: #0f5c4d; box-shadow: 0 0 0 1px #0f5c4d; }
.carpark-card { cursor: pointer; }
.carpark-card.selected { background: #f3fbf7; }
.carpark-card.selected .metrics { background: white; }
.carpark-card.compare-locked { cursor: default; }

.card-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.parking-icon { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: .75rem; background: #2cd790; color: #073f32; font-weight: 800; font-size: 1.4rem; }
.heart-button { display: grid; width: 2.2rem; height: 2.2rem; padding: 0; place-items: center; border: 1.5px solid #b7c9c2; border-radius: 50%; color: #60736b; background: white; transition: color .15s, border-color .15s, background .15s, transform .15s; }
.heart-button svg { width: 1.25rem; height: 1.25rem; fill: transparent; stroke: currentColor; stroke-width: 1.8; }
.heart-button:hover:not(:disabled) { border-color: #df3f65; color: #c92f54; transform: scale(1.05); }
.heart-button.active { border-color: #df3f65; color: #c92f54; background: #fff0f4; }
.heart-button.active svg { fill: currentColor; }
.heart-button:disabled { opacity: .55; }

.carpark-name { margin: 0 0 .25rem; color: #10243a; font-size: 1.15rem; font-weight: 750; line-height: 1.3; }
.carpark-meta { margin: 0 0 .75rem; color: #63716a; font-size: .82rem; }

.tag-row { display: flex; flex-wrap: wrap; gap: .4rem; margin-bottom: .75rem; }
.tag { display: inline-flex; align-items: center; gap: .3rem; min-height: 1.6rem; padding: .2rem .6rem; border-radius: 2rem; font-size: .72rem; font-weight: 750; white-space: nowrap; }
.tag-ev { background: #dcfce7; color: #15803d; }
.ev-leaf-icon { width: .95rem; height: .95rem; }
.metrics dd.lots-available { color: #0f7a5f; }
.metrics dd.lots-limited { color: #9a6700; }
.metrics dd.lots-full { color: #b42318; }
.metrics dd.lots-unknown { color: #52606d; }
.available { background: #e6f4f0; color: #0f5c4d; }
.limited { background: #fff1cf; color: #785100; }
.full { background: #fce5e5; color: #9f3030; }
.unknown { background: #edf0f3; color: #52606d; }
.difficulty-beginner-friendly { color: #087a58; background: #dff7ec; }
.difficulty-moderate { color: #805b00; background: #fff0bf; }
.difficulty-challenging { color: #a02f2f; background: #fde2e2; }

.community-preview { display: flex; align-items: center; gap: .3rem; margin-bottom: 1rem; color: #52606d; font-size: .8rem; }
.community-preview > span:first-child { color: #f2a900; font-size: 1rem; }
.community-preview.empty > span:first-child { color: #aeb9b4; }

.metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: .75rem 1rem; margin: 0 0 1.25rem; padding: .9rem 1rem; border-radius: .9rem; background: #f6faf8; }
.metrics dt { color: #63716a; font-size: .72rem; font-weight: 500; margin-bottom: .2rem; }
.metrics dd { font-size: 1.05rem; font-weight: 750; margin: 0; color: #10243a; }

.card-footer-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; margin-top: auto; padding-top: 1rem; border-top: 1px solid #e3ebe7; }
.compare-status { display: inline-flex; align-items: center; gap: .45rem; color: #63716a; font-size: .85rem; font-weight: 650; }
.compare-status.on { color: #0f5c4d; }
.compare-dot { display: grid; width: 1.35rem; height: 1.35rem; place-items: center; border: 1.5px solid currentColor; border-radius: 50%; font-size: .8rem; font-weight: 800; line-height: 1; }
.compare-status.on .compare-dot { color: white; background: #0f5c4d; border-color: #0f5c4d; }
.carpark-card:focus-visible { outline: 3px solid #2cd790; outline-offset: 3px; }
.details-link { color: #0f5c4d; font-size: .85rem; font-weight: 700; text-decoration: none; }
.details-link:hover { text-decoration: underline; }
</style>
