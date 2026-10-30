<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Navbar from '@/components/Navbar.vue'

const route = useRoute()
const showAppChrome = computed(() => route.name !== 'login')
const fullWidthContent = computed(() => ['login', 'home', 'results', 'map', 'carpark-details', 'favourites', 'compare', 'community', 'profile', 'user-profile'].includes(route.name))
</script>

<template>
  <div class="app-shell">
    <Navbar v-if="showAppChrome" />
    <main id="main-content" :class="fullWidthContent ? 'container-fluid p-0' : 'container py-5'">
      <RouterView v-slot="{ Component, route: currentRoute }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="currentRoute.path" />
        </Transition>
      </RouterView>
    </main>
    <footer v-if="showAppChrome" class="text-center text-secondary py-4">CarparkCompare SG</footer>
  </div>
</template>

