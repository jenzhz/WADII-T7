import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { clearSession, getCurrentUser, verifySession } from '@/services/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/AuthView.vue'), meta: { guestOnly: true } },
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
    { path: '/results', name: 'results', component: () => import('@/views/ResultsView.vue'), meta: { requiresAuth: true } },
    { path: '/map', name: 'map', component: () => import('@/views/MapView.vue'), meta: { requiresAuth: true } },
    { path: '/carparks/:id', name: 'carpark-details', component: () => import('@/views/CarparkDetailsView.vue'), props: true },
    { path: '/compare', name: 'compare', component: () => import('@/views/CompareView.vue'), meta: { requiresAuth: true } },
    { path: '/favourites', name: 'favourites', component: () => import('@/views/FavouritesView.vue'), meta: { requiresAuth: true } },
    { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { requiresAuth: true } },
    { path: '/profile/:userId', name: 'user-profile', component: () => import('@/views/ProfileView.vue'), meta: { requiresAuth: true } },
    { path: '/community', name: 'community', component: () => import('@/views/CommunityView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
  scrollBehavior: (to) => to.hash ? { el: to.hash, behavior: 'smooth' } : { top: 0 },
})

router.beforeEach(async (to) => {
  let signedIn = Boolean(getCurrentUser())

  if (to.meta.requiresAuth || to.meta.guestOnly) {
    try {
      signedIn = Boolean(await verifySession())
    } catch {
      clearSession()
      signedIn = false
    }
  }

  if (to.meta.requiresAuth && !signedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && signedIn) return { name: 'home' }
  return true
})

export default router

