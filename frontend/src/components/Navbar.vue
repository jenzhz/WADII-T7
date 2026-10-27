<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logoutAccount } from '@/services/auth'

const router = useRouter()
const route = useRoute()
const searchTarget = ref('/')
const mapTarget = ref('/map')
const hasSavedSearch = ref(false)

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
})
onBeforeUnmount(() => {
  window.removeEventListener('search-changed', refreshSearchTarget)
  window.removeEventListener('storage', refreshSearchTarget)
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
          <RouterLink class="nav-link" :class="{ active: ['home', 'results'].includes(route.name) }" :to="searchTarget">
            {{ hasSavedSearch ? 'Results' : 'Search' }}
          </RouterLink>
          <RouterLink class="nav-link" :class="{ active: route.name === 'map' }" :to="mapTarget">Map</RouterLink>
          <RouterLink class="nav-link" :class="{ active: route.name === 'compare' }" to="/compare">Compare</RouterLink>
          <RouterLink class="nav-link" :class="{ active: route.name === 'favourites' }" to="/favourites">Favourites</RouterLink>
          <button class="btn btn-outline-success logout-button" type="button" @click="logout">Log out</button>
        </div>
      </div>
    </nav>
  </header>
</template>

<style scoped>
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
</style>

