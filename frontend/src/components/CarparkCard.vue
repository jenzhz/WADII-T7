<script setup>
defineProps({
  carpark: {
    type: Object,
    default: () => ({ name: 'Carpark name', availableLots: '—', walkingTime: '—' }),
  },
})
</script>

<template>
  <article class="card p-3">
    <h2 class="h5">{{ carpark.name }}</h2>
    <p>Available lots: {{ carpark.availableLots }}</p>
    <p class="mb-0">Walking time: {{ carpark.walkingTime }} min</p>
  </article>
</template>

