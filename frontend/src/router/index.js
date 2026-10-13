import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: () => import('@/views/AuthView.vue') },
    { path: '/mock-accounts', name: 'mock-accounts', component: () => import('@/views/MockAccountsView.vue') },
    { path: '/results', name: 'results', component: () => import('@/views/ResultsView.vue') },
    { path: '/map', name: 'map', component: () => import('@/views/MapView.vue') },
    { path: '/carparks/:id', name: 'carpark-details', component: () => import('@/views/CarparkDetailsView.vue'), props: true },
    { path: '/compare', name: 'compare', component: () => import('@/views/CompareView.vue') },
    { path: '/favourites', name: 'favourites', component: () => import('@/views/FavouritesView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router

