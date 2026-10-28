<script setup>
import StarRating from './StarRating.vue'

defineProps({
  carpark: { type: Object, required: true },
  to: { type: Object, required: true },
})
</script>

<template>
  <article class="community-card">
    <div class="card-top"><span class="community-mark">C</span><span class="review-count">{{ carpark.community?.reviewCount || 0 }} reviews</span></div>
    <h3>{{ carpark.name }}</h3>
    <p v-if="Number.isFinite(carpark.distance)" class="distance-label">{{ Math.round(carpark.distance) }} m from destination</p>
    <div v-if="carpark.community" class="rating-row"><StarRating :model-value="carpark.community.overallRating" readonly /><strong>{{ Number(carpark.community.overallRating).toFixed(1) }} / 5</strong></div>
    <p v-else class="no-reviews">No reviews yet — be the first.</p>
    <dl v-if="carpark.community" class="mini-breakdown">
      <div><dt>Entrance / exit</dt><dd>{{ carpark.community.entranceExitAccessibility?.toFixed(1) || '—' }}</dd></div>
      <div><dt>Lot space</dt><dd>{{ carpark.community.lotSpaciousness?.toFixed(1) || '—' }}</dd></div>
    </dl>
    <blockquote v-if="carpark.community?.latestComment">“{{ carpark.community.latestComment }}”</blockquote>
    <RouterLink :to="to">{{ carpark.community ? 'Read reviews' : 'Write first review' }} →</RouterLink>
  </article>
</template>
