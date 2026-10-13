<script setup>
defineProps({ id: { type: String, required: true } })
</script>

<template>
  <section class="row">
    <div class="col-lg-8">
      <h1>Carpark Details</h1>
      <p class="lead">Details and a walking route for carpark {{ id }} will appear here.</p>
    </div>
  </section>
</template>

