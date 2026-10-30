<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/services/api'
import { getMyReviews, getUserReviews } from '@/services/reviews'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import StarRating from '@/components/StarRating.vue'
import ProfileReviewMap from '@/components/ProfileReviewMap.vue'

const route = useRoute()
const isOwnProfile = computed(() => !route.params.userId)
const user = ref(null)
const reviews = ref([])
const carparks = ref([])
const loading = ref(true)
const error = ref('')
const loadingLocations = ref(false)
const locationsError = ref('')
let profileRequest = 0

const ratingCategories = [
  { key: 'lotSpaciousness', label: 'Lot space' },
  { key: 'entranceExitAccessibility', label: 'Access' },
  { key: 'signage', label: 'Signage' },
  { key: 'pricing', label: 'Pricing' },
]

const reviewedLocations = computed(() => {
  const locations = new Map()
  for (const review of reviews.value) {
    const carpark = carparkForReview(review)
    if (!carpark || !Number.isFinite(carpark.latitude) || !Number.isFinite(carpark.longitude) ||
      Math.abs(carpark.latitude) > 90 || Math.abs(carpark.longitude) > 180) continue

    // Different vehicle types at the same coordinates share a single pin.
    const key = `${carpark.latitude}:${carpark.longitude}`
    if (!locations.has(key)) {
      locations.set(key, { name: carpark.name || review.carparkId, latitude: carpark.latitude, longitude: carpark.longitude, reviews: [] })
    }
    locations.get(key).reviews.push({ overallRating: review.overallRating, detailsLink: detailsLink(review) })
  }
  return [...locations.values()]
})

const unmappedReviewCount = computed(() => reviews.value.length - reviewedLocations.value.reduce((total, location) => total + location.reviews.length, 0))

async function loadProfile() {
  const requestId = ++profileRequest
  const userId = route.params.userId
  loading.value = true
  error.value = ''
  locationsError.value = ''
  loadingLocations.value = false
  try {
    let profile
    if (userId) {
      profile = await getUserReviews(userId)
    } else {
      const response = await api.get('/users/profile')
      profile = { user: response.data.user, reviews: await getMyReviews() }
    }
    // Ignore an old response if another profile has been opened in the meantime.
    if (requestId !== profileRequest) return
    user.value = profile.user
    reviews.value = profile.reviews
  } catch (requestError) {
    if (requestId === profileRequest) error.value = requestError.response?.data?.message || 'Unable to load this profile. Please try again.'
  } finally {
    if (requestId === profileRequest) loading.value = false
  }

  if (requestId === profileRequest && !error.value && reviews.value.length && !carparks.value.length) {
    await loadCarparkLocations(requestId)
  }
}

async function loadCarparkLocations(requestId = profileRequest) {
  loadingLocations.value = true
  locationsError.value = ''
  try {
    const response = await api.get('/carparks')
    if (requestId === profileRequest) carparks.value = response.data.carparks || []
  } catch {
    if (requestId === profileRequest) locationsError.value = 'Reviewed locations could not be loaded.'
  } finally {
    if (requestId === profileRequest) loadingLocations.value = false
  }
}

function carparkForReview(review) {
  return carparks.value.find(carpark => carpark.id === review.carparkId || carpark.carparkId === review.carparkId)
}

function detailsLink(review) {
  const carpark = carparkForReview(review)
  return {
    name: 'carpark-details',
    params: { id: review.carparkId },
    query: {
      name: carpark?.name || review.carparkId,
      lotType: carpark?.lotType || (['C', 'Y', 'H'].includes(review.carparkId.split(':').at(-1)) ? review.carparkId.split(':').at(-1) : 'C'),
      from: 'profile',
      ...(route.params.userId ? { profileUserId: route.params.userId } : {}),
    },
    hash: '#community-reviews',
  }
}

function formattedDate(value) {
  return new Date(value).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

watch(() => route.params.userId, loadProfile, { immediate: true })
</script>

<template>
  <section class="profile-page">
    <div class="profile-inner">
      <h1 class="mb-4">Driver profile</h1>

      <div v-if="loading" class="state-panel" role="status">
        <LoadingSpinner />
        <p class="mt-3 mb-0">Loading profile…</p>
      </div>
      <div v-else-if="error" class="alert alert-danger" role="alert">
        <p>{{ error }}</p>
        <button class="btn btn-outline-danger" type="button" @click="loadProfile">Try again</button>
      </div>
      <template v-else>
        <section class="account-card" aria-label="Profile details">
          <div class="profile-avatar" aria-hidden="true">{{ user.name.charAt(0).toUpperCase() }}</div>
          <div class="account-details">
            <h2>{{ user.name }}</h2>
            <p v-if="isOwnProfile">{{ user.email }}</p>
            <small v-if="user.createdAt">Member since {{ formattedDate(user.createdAt) }}</small>
          </div>
          <div class="review-count"><strong>{{ reviews.length }}</strong><span>{{ reviews.length === 1 ? 'Review shared' : 'Reviews shared' }}</span></div>
        </section>

        <section class="review-locations mt-4" aria-labelledby="review-locations-heading">
          <header class="locations-heading">
            <h2 id="review-locations-heading">Reviewed locations</h2>
            <span v-if="reviewedLocations.length" class="locations-count">{{ reviewedLocations.length }} {{ reviewedLocations.length === 1 ? 'location' : 'locations' }}</span>
          </header>
          <div v-if="loadingLocations" class="locations-state" role="status"><LoadingSpinner /><p>Loading reviewed locations…</p></div>
          <div v-else-if="locationsError" class="locations-state" role="status">
            <p>{{ locationsError }}</p>
            <button class="btn btn-outline-success btn-sm" type="button" @click="loadCarparkLocations()">Try again</button>
          </div>
          <template v-else-if="reviewedLocations.length">
            <ProfileReviewMap :locations="reviewedLocations" />
            <p v-if="unmappedReviewCount" class="locations-note">{{ unmappedReviewCount }} {{ unmappedReviewCount === 1 ? 'review has' : 'reviews have' }} no matching carpark location. All reviews are listed below.</p>
          </template>
          <p v-else class="locations-empty">{{ reviews.length ? 'Location data is unavailable for these carparks. You can still read all reviews below.' : 'Reviewed carparks will appear here once a review is shared.' }}</p>
        </section>

        <section class="mt-4" aria-labelledby="my-reviews-heading">
          <h2 id="my-reviews-heading" class="h4 mb-3">{{ isOwnProfile ? 'Your reviews' : `${user.name}’s reviews` }}</h2>
          <div v-if="!reviews.length" class="state-panel">
            <h3 class="h5">No reviews yet</h3>
            <p class="text-secondary">{{ isOwnProfile ? 'Share your experience on a carpark’s page to help other drivers.' : 'This member has not shared any carpark reviews yet.' }}</p>
            <RouterLink class="btn btn-success" to="/community">Explore community carparks</RouterLink>
          </div>
          <div v-else class="review-list">
            <article v-for="review in reviews" :key="review._id" class="review-card">
              <header>
                <h3>{{ carparkForReview(review)?.name || review.carparkId }}</h3>
                <div class="review-score"><StarRating :model-value="review.overallRating" readonly /><strong>{{ review.overallRating }}/5</strong></div>
              </header>
              <p class="review-date">{{ review.updatedAt !== review.createdAt ? 'Updated' : 'Posted' }} {{ formattedDate(review.updatedAt) }}</p>
              <p class="review-comment">{{ review.comment }}</p>
              <dl class="review-ratings">
                <template v-for="category in ratingCategories" :key="category.key">
                  <div v-if="review[category.key] != null"><dt>{{ category.label }}</dt><dd>{{ review[category.key] }}/5</dd></div>
                </template>
              </dl>
              <RouterLink class="review-link" :to="detailsLink(review)">View review and discussion →</RouterLink>
            </article>
          </div>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.profile-page { min-height: 100%; padding: 2.5rem 1.5rem 5rem; background-color: #f0fbf6; background-image: radial-gradient(#bfe9d7 1.1px, transparent 1.1px); background-size: 19px 19px; }
.profile-inner { width: min(100%, 64rem); margin: auto; }
.profile-page h1 { font-size: clamp(2.5rem, 5vw, 4rem); }
.account-card, .review-card, .review-locations { padding: 1.5rem; border: 2px solid #174f40; border-radius: 1.25rem; background: white; }
.locations-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .75rem; margin-bottom: 1rem; }
.locations-heading h2 { margin: 0; font-size: 1.25rem; font-weight: 750; }
.locations-count { padding: .3rem .65rem; border-radius: 2rem; color: #087a58; background: #e7f8ef; font-size: .8rem; font-weight: 700; }
.locations-state, .locations-empty { margin: 0; padding: 2rem 1rem; border: 1px dashed #b8cec5; border-radius: 1rem; color: #63716a; background: #f7fcf9; text-align: center; }
.locations-state :deep(.spinner-border) { color: #087a58 !important; }
.locations-state p { margin: .75rem 0; }
.locations-note { margin: .75rem 0 0; color: #63716a; font-size: .8rem; }
.account-card { display: flex; align-items: center; gap: 1.25rem; }
.profile-avatar { display: grid; width: 4rem; height: 4rem; flex-shrink: 0; place-items: center; border-radius: 1rem; color: #073f32; background: #2cd790; font-size: 2rem; font-weight: 750; }
.account-details { min-width: 0; overflow-wrap: anywhere; }
.account-details h2 { margin: 0; font-size: 1.5rem; }
.account-details p { margin: .35rem 0; color: #52665d; }
.account-details small, .review-date { color: #63716a; }
.review-count { display: grid; gap: .25rem; margin-left: auto; text-align: center; white-space: nowrap; color: #087a58; }
.review-count strong { font-size: 2rem; line-height: 1; }
.review-count span { font-size: .85rem; }
.state-panel { padding: 3rem 1rem; border: 2px dashed #9ebfb3; border-radius: 1.25rem; background: #ffffffbb; text-align: center; }
.review-list { display: grid; gap: 1rem; }
.review-card header, .review-score { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
.review-card h3 { margin: 0; font-size: 1.1rem; font-weight: 750; overflow-wrap: anywhere; }
.review-score { flex-shrink: 0; }
.review-date { margin: .5rem 0 1rem; font-size: .85rem; }
.review-comment { white-space: pre-wrap; overflow-wrap: anywhere; }
.review-ratings { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0; }
.review-ratings div { display: flex; gap: .4rem; padding: .3rem .6rem; border-radius: 2rem; background: #edf3f1; font-size: .8rem; }
.review-ratings dt { font-weight: 400; }
.review-ratings dd { margin: 0; font-weight: 750; }
.review-link { display: inline-block; margin-top: 1.25rem; color: #087a58; font-weight: 750; text-decoration: none; }
.review-link:hover { text-decoration: underline; }
@media (max-width: 575px) {
  .account-card { flex-wrap: wrap; }
  .review-count { width: 100%; margin: 0; padding-top: 1rem; border-top: 1px solid #d6e5df; }
  .review-card header { align-items: flex-start; flex-direction: column; }
}
</style>
