<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentUser, logoutAccount } from '@/services/auth'

const router = useRouter()
const user = ref(getCurrentUser())

function refreshUser() {
  user.value = getCurrentUser()
}

async function logout() {
  await logoutAccount()
  router.replace('/login')
}

onMounted(() => window.addEventListener('auth-changed', refreshUser))
onBeforeUnmount(() => window.removeEventListener('auth-changed', refreshUser))
</script>

<template>
  <header>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <nav class="navbar navbar-expand-md bg-body-tertiary border-bottom" aria-label="Primary navigation">
      <div class="container">
        <RouterLink class="navbar-brand" to="/">CarparkCompare SG</RouterLink>
        <div class="navbar-nav flex-row flex-wrap gap-3">
          <RouterLink class="nav-link" to="/">Search</RouterLink>
          <RouterLink class="nav-link" to="/map">Map</RouterLink>
          <RouterLink class="nav-link" to="/compare">Compare</RouterLink>
          <RouterLink class="nav-link" to="/favourites">Favourites</RouterLink>
          <span v-if="user" class="navbar-text">{{ user.name }}</span>
          <button class="btn btn-outline-primary" type="button" @click="logout">Log out</button>
        </div>
      </div>
    </nav>
  </header>
</template>

