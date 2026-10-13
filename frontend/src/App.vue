<script setup>
import Navbar from '@/components/Navbar.vue'
</script>

<template>
  <div class="app-shell">
    <Navbar />
    <main id="main-content" class="container py-5">
      <RouterView />
    </main>
    <footer class="text-center text-secondary py-4">CarparkCompare SG</footer>
  </div>
</template>

