import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { clearSession, verifySession } from '@/services/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/AuthView.vue'), meta: { guestOnly: true } },
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
    { path: '/results', name: 'results', component: () => import('@/views/ResultsView.vue'), meta: { requiresAuth: true } },
    { path: '/map', name: 'map', component: () => import('@/views/MapView.vue'), meta: { requiresAuth: true } },
    { path: '/carparks/:id', name: 'carpark-details', component: () => import('@/views/CarparkDetailsView.vue'), props: true, meta: { requiresAuth: true } },
    { path: '/compare', name: 'compare', component: () => import('@/views/CompareView.vue'), meta: { requiresAuth: true } },
    { path: '/favourites', name: 'favourites', component: () => import('@/views/FavouritesView.vue'), meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  let signedIn = false

  try {
    signedIn = Boolean(await verifySession())
  } catch {
    clearSession()
  }

  if (to.meta.requiresAuth && !signedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && signedIn) return { name: 'home' }
  return true
})

export default router

