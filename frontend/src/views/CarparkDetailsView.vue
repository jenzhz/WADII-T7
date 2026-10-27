<script setup>
import { useRoute } from 'vue-router'
import CarparkDetails from '@/components/CarparkDetails.vue'

defineProps({
  id: {
    type: String,
    required: true,
  },
})

const route = useRoute()
</script>

<template>
  <section class="details-page">
    <div class="details-inner">
    <div class="mb-3">
      <RouterLink
        :to="{ name: 'results', query: route.query }"
        class="details-back-link"
      >
        &larr; Back to nearby carparks
      </RouterLink>
    </div>

    <CarparkDetails
      :carpark-id="id"
      :carpark-name="route.query.name || 'Marina Bay Carpark'"
      :origin-lat="route.query.originLat ?? null"
      :origin-lng="route.query.originLng ?? null"
      :dest-lat="route.query.destLat || route.query.latitude || 1.293"
      :dest-lng="route.query.destLng || route.query.longitude || 103.857"
      :destination-name="route.query.destinationName || route.query.destination || 'Suntec City / Marina Bay'"
      :lot-type="route.query.lotType || route.query.vehicleType || 'C'"
    />
    </div>
  </section>
</template>

<style scoped>
.details-page { min-height: 100%; padding: 2.5rem 1.5rem 5rem; background-color: #f0fbf6; background-image: radial-gradient(#bfe9d7 1.1px, transparent 1.1px); background-size: 19px 19px; }
.details-inner { width: min(100%, 76rem); margin: auto; }
.details-back-link { display: inline-flex; align-items: center; gap: .35rem; padding: .5rem .2rem; color: #087a58; font-weight: 750; text-decoration: none; }
.details-back-link:hover { color: #055c42; text-decoration: underline; }
</style>
