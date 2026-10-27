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
  <section class="container py-2">
    <div class="mb-3">
      <RouterLink
        :to="{ name: 'results', query: route.query }"
        class="text-decoration-none text-secondary small"
      >
        &larr; Back to Nearby Carparks
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
  </section>
</template>
