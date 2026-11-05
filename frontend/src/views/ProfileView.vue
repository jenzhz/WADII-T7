<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import { getMyReviews, getUserReviews } from '@/services/reviews'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import StarRating from '@/components/StarRating.vue'
import ProfileReviewMap from '@/components/ProfileReviewMap.vue'
import ContributorLevelsDialog from '@/components/ContributorLevelsDialog.vue'

const route = useRoute()
const router = useRouter()
const isOwnProfile = computed(() => !route.params.userId)
const user = ref(null)
const reviews = ref([])
const contributor = ref({ helpedDrivers: 0, points: 0, level: 'New Contributor' })
const levelsDialog = ref(null)
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
      const [response, reviewProfile] = await Promise.all([api.get('/users/profile'), getMyReviews()])
      profile = { user: response.data.user, reviews: reviewProfile.reviews, contributor: reviewProfile.contributor }
    }
    // Ignore an old response if another profile has been opened in the meantime.
    if (requestId !== profileRequest) return
    user.value = profile.user
    reviews.value = profile.reviews
    contributor.value = profile.contributor || { helpedDrivers: 0, points: 0, level: 'New Contributor' }
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

// Go back to wherever the user came from (carpark details, Community…).
// If the page was opened directly (no history), fall back to Community.
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push({ name: 'community' })
}

watch(() => route.params.userId, loadProfile, { immediate: true })
</script>

<template>
  <section class="profile-page">
    <div class="profile-inner">
      <button v-if="!isOwnProfile" class="back-link" type="button" @click="goBack">&larr; Back</button>
      <h1 class="mb-4">{{ isOwnProfile ? 'My profile' : 'Community member' }}</h1>

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
          <div class="profile-stats">
            <button class="contributor-score" type="button" aria-haspopup="dialog" :aria-label="`View contributor levels. ${contributor.level}, ${contributor.points} points`" @click="levelsDialog.open(contributor, user.name, isOwnProfile)"><span>{{ contributor.level }}</span><strong>{{ contributor.points }} pts</strong><small>Helped {{ contributor.helpedDrivers }} {{ contributor.helpedDrivers === 1 ? 'driver' : 'drivers' }}</small><span class="levels-hint">View levels →</span></button>
            <div class="review-count"><strong>{{ reviews.length }}</strong><span>{{ reviews.length === 1 ? 'Review shared' : 'Reviews shared' }}</span></div>
          </div>
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
                <small class="review-date">{{ review.updatedAt !== review.createdAt ? 'Updated' : 'Posted' }} {{ formattedDate(review.updatedAt) }}</small>
              </header>
              <div class="review-score"><StarRating :model-value="review.overallRating" readonly /><strong>{{ review.overallRating }}/5</strong></div>
              <p class="review-comment">{{ review.comment }}</p>
              <p class="review-helpful"><span aria-hidden="true">👍</span> Helped {{ review.helpfulCount || 0 }} {{ review.helpfulCount === 1 ? 'driver' : 'drivers' }}</p>
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
    <ContributorLevelsDialog ref="levelsDialog" />
  </section>
</template>

<style scoped>
.back-link { display: inline-flex; align-items: center; gap: .35rem; margin-bottom: .75rem; padding: .5rem .2rem; border: 0; color: #087a58; background: transparent; font-weight: 750; }
.back-link:hover { color: #055c42; text-decoration: underline; }
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
.profile-stats { display: flex; align-items: stretch; gap: .75rem; margin-left: auto; }.profile-stats .review-count { min-width: 7rem; margin: 0; padding: .75rem; justify-content: center; border-left: 1px solid #d6e5df; }.contributor-score { display: grid; min-width: 11rem; align-content: center; padding: .65rem .85rem; border-radius: .85rem; color: #073f32; background: #e7f8f0; text-align: center; }.contributor-score span { color: #087a58; font-size: .72rem; font-weight: 850; text-transform: uppercase; }.contributor-score strong { margin: .1rem 0; font-size: 1.35rem; }.contributor-score small { color: #52665d; }
.contributor-score { border: 1px solid #b8decc; cursor: pointer; }
.contributor-score:hover { border-color: #087a58; background: #dff7ec; }
.contributor-score .levels-hint { margin-top: .4rem; font-size: .7rem; font-weight: 750; text-transform: none; }
.state-panel { padding: 3rem 1rem; border: 2px dashed #9ebfb3; border-radius: 1.25rem; background: #ffffffbb; text-align: center; }
.review-list { display: grid; gap: 1rem; }
.review-card header { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; }
.review-score { display: flex; align-items: center; gap: .5rem; margin: .5rem 0 1rem; }
.review-card h3 { margin: 0; font-size: 1.1rem; font-weight: 750; overflow-wrap: anywhere; }
.review-score { flex-shrink: 0; }
.review-date { flex-shrink: 0; margin-top: .2rem; font-size: .8rem; white-space: nowrap; text-align: right; }
.review-comment { white-space: pre-wrap; overflow-wrap: anywhere; }
.review-helpful { display: inline-flex; align-items: center; gap: .35rem; margin: 0 0 .8rem; padding: .35rem .6rem; border-radius: 2rem; color: #087a58; background: #e7f8f0; font-size: .78rem; font-weight: 750; }
.review-ratings { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0; }
.review-ratings div { display: flex; gap: .4rem; padding: .3rem .6rem; border-radius: 2rem; background: #edf3f1; font-size: .8rem; }
.review-ratings dt { font-weight: 400; }
.review-ratings dd { margin: 0; font-weight: 750; }
.review-link { display: inline-block; margin-top: 1.25rem; color: #087a58; font-weight: 750; text-decoration: none; }
.review-link:hover { text-decoration: underline; }
@media (max-width: 575px) {
  .account-card { flex-wrap: wrap; }
  .profile-stats { width: 100%; margin: 0; flex-direction: column; }.profile-stats .review-count { width: 100%; border-top: 1px solid #d6e5df; border-left: 0; }.contributor-score { width: 100%; }
}
</style>
