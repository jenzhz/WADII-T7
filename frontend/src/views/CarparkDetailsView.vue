<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import CarparkDetails from '@/components/CarparkDetails.vue'
import CommunityReviews from '@/components/CommunityReviews.vue'

defineProps({
  id: {
    type: String,
    required: true,
  },
})

const route = useRoute()
const backLink = computed(() => {
  if (route.query.from === 'profile') {
    return route.query.profileUserId
      ? { name: 'user-profile', params: { userId: route.query.profileUserId } }
      : { name: 'profile' }
  }
  if (route.query.from === 'community') return { name: 'community' }
  if (route.query.from === 'search') return { name: 'home' }
  return { name: 'results', query: route.query }
})
</script>

<template>
  <section class="details-page">
    <div class="details-inner">
    <div class="mb-3">
      <RouterLink
        :to="backLink"
        class="details-back-link"
      >
        &larr; {{ route.query.from === 'profile' ? 'Back to profile' : route.query.from === 'community' ? 'Back to Community' : route.query.from === 'search' ? 'Back to search' : 'Back to nearby carparks' }}
      </RouterLink>
    </div>

    <CarparkDetails
      :carpark-id="id"
      :carpark-name="route.query.name || 'Marina Bay Carpark'"
      :origin-lat="route.query.originLat ?? null"
      :origin-lng="route.query.originLng ?? null"
      :dest-lat="route.query.destLat || route.query.latitude || null"
      :dest-lng="route.query.destLng || route.query.longitude || null"
      :destination-name="route.query.destinationName || route.query.destination || ''"
      :lot-type="route.query.lotType || route.query.vehicleType || 'C'"
      :has-ev-charger="route.query.hasEv === '1'"
    />
    <CommunityReviews :carpark-id="id" :has-ev-charger="route.query.hasEv === '1'" />
    </div>
  </section>
</template>

<style scoped>
.details-page { min-height: 100%; padding: 2.5rem 1.5rem 5rem; background-color: #f0fbf6; background-image: radial-gradient(#bfe9d7 1.1px, transparent 1.1px); background-size: 19px 19px; }
.details-inner { width: min(100%, 76rem); margin: auto; }
.details-back-link { display: inline-flex; align-items: center; gap: .35rem; padding: .5rem .2rem; color: #087a58; font-weight: 750; text-decoration: none; }
.details-back-link:hover { color: #055c42; text-decoration: underline; }
</style>
