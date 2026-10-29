<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logoutAccount } from '@/services/auth'
import { getCurrentUser } from '@/services/auth'

const router = useRouter()
const route = useRoute()
const searchTarget = ref('/')
const mapTarget = ref('/map')
const hasSavedSearch = ref(false)
const currentUser = ref(getCurrentUser())
const signedIn = ref(Boolean(currentUser.value))

function refreshAuth() {
  currentUser.value = getCurrentUser()
  signedIn.value = Boolean(currentUser.value)
}

function refreshSearchTarget() {
  const routeLatitude = Number(route.query.latitude)
  const routeLongitude = Number(route.query.longitude)
  const hasRouteDestination = Boolean(route.query.destination) &&
    Number.isFinite(routeLatitude) && Number.isFinite(routeLongitude)

  mapTarget.value = hasRouteDestination ? {
    name: 'map',
    query: {
      destination: route.query.destination,
      latitude: route.query.latitude,
      longitude: route.query.longitude,
      vehicleType: route.query.vehicleType || 'C',
    },
  } : '/map'

  try {
    const saved = JSON.parse(localStorage.getItem('carparkcompare.search'))
    const selected = saved?.selectedDestination
    if (selected?.SEARCHVAL && selected?.LATITUDE && selected?.LONGITUDE) {
      hasSavedSearch.value = true
      searchTarget.value = {
        name: 'results',
        query: {
          destination: selected.SEARCHVAL,
          latitude: selected.LATITUDE,
          longitude: selected.LONGITUDE,
          vehicleType: saved.vehicleType || 'C',
        },
      }
      if (!hasRouteDestination) mapTarget.value = {
        name: 'map',
        query: {
          destination: selected.SEARCHVAL,
          latitude: selected.LATITUDE,
          longitude: selected.LONGITUDE,
          vehicleType: saved.vehicleType || 'C',
        },
      }
      return
    }
  } catch {
    localStorage.removeItem('carparkcompare.search')
  }
  hasSavedSearch.value = false
  searchTarget.value = '/'
}

async function logout() {
  await logoutAccount()
  router.replace('/login')
}

onMounted(() => {
  refreshSearchTarget()
  window.addEventListener('search-changed', refreshSearchTarget)
  window.addEventListener('storage', refreshSearchTarget)
  window.addEventListener('auth-changed', refreshAuth)
})
onBeforeUnmount(() => {
  window.removeEventListener('search-changed', refreshSearchTarget)
  window.removeEventListener('storage', refreshSearchTarget)
  window.removeEventListener('auth-changed', refreshAuth)
})

watch(() => route.fullPath, refreshSearchTarget)
</script>

<template>
  <header>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <nav class="navbar navbar-expand-md bg-body-tertiary border-bottom" aria-label="Primary navigation">
      <div class="container">
        <RouterLink class="navbar-brand brand-logo" to="/" aria-label="CarparkCompare SG home">
          <span class="brand-mark" aria-hidden="true">P</span>
          <span class="brand-name">Carpark<span>Compare</span>SG</span>
        </RouterLink>
        <div class="navbar-nav flex-row flex-wrap gap-3">
          <RouterLink v-if="signedIn" class="nav-link" :class="{ active: ['home', 'results'].includes(route.name) }" :to="searchTarget">
            {{ hasSavedSearch ? 'Results' : 'Search' }}
          </RouterLink>
          <RouterLink v-if="signedIn" class="nav-link" :class="{ active: route.name === 'map' }" :to="mapTarget">Map</RouterLink>
          <RouterLink v-if="signedIn" class="nav-link" :class="{ active: route.name === 'compare' }" to="/compare">Compare</RouterLink>
          <RouterLink v-if="signedIn" class="nav-link" :class="{ active: route.name === 'favourites' }" to="/favourites">Favourites</RouterLink>
          <RouterLink class="nav-link" :class="{ active: route.name === 'community' }" to="/community">Community</RouterLink>
          <RouterLink v-if="signedIn" class="nav-link navbar-user" :class="{ active: route.name === 'profile' }" to="/profile" :title="currentUser?.name || ''">Profile</RouterLink>
          <button v-if="signedIn" class="btn btn-outline-success logout-button" type="button" @click="logout">Log out</button>
          <RouterLink v-else class="btn btn-outline-success logout-button" to="/login">Log in</RouterLink>
        </div>
      </div>
    </nav>
  </header>
</template>

<style scoped>
/* Keep the navbar at the top of the screen while scrolling.
   z-index is above Leaflet map controls (1000) so the map never covers it. */
header {
  position: sticky;
  top: 0;
  z-index: 1100;
}

.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  color: #173e30;
  letter-spacing: -.035em;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: .65rem .65rem .65rem .2rem;
  color: white;
  background: #2cd790;
  box-shadow: 0 4px 12px #07875f22;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0;
}

.brand-name { font-size: 1.25rem; font-weight: 500; }
.brand-name span { color: #073f32; font-weight: 600; }

.nav-link {
  border-radius: .55rem;
  padding-inline: .75rem;
}

.nav-link.active {
  color: #06271f;
  background: #2cd790;
  font-weight: 700;
  box-shadow: none;
}

.logout-button { border-color: #087a58; border-radius: 2rem; color: #075d45; font-weight: 700; }
.navbar-user { display: inline-flex; align-items: center; padding-inline: .25rem; color: #10243a; font-weight: 750; }
</style>

