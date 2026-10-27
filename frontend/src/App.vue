<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Navbar from '@/components/Navbar.vue'

const route = useRoute()
const showAppChrome = computed(() => route.name !== 'login')
</script>

<template>
  <div class="app-shell">
    <Navbar v-if="showAppChrome" />
    <main id="main-content" class="container py-5">
      <RouterView />
    </main>
    <footer v-if="showAppChrome" class="text-center text-secondary py-4">CarparkCompare SG</footer>
  </div>
</template>

