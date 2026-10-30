<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '@/services/api'
import { getCommunitySummaries } from '@/services/reviews'
import StarRating from '@/components/StarRating.vue'
import CommunityCarparkCard from '@/components/CommunityCarparkCard.vue'

const carparks = ref([])
const allCarparks = ref([])
const summaryMap = ref(new Map())
const recentActivity = ref([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const destinationMatches = ref([])
const selectedDestination = ref(null)
const modeLabel = ref('All Singapore carparks')
const showSearchResults = ref(false)
const resultSort = ref('nearest')

function uniqueCarparks(rows) {
  const byOfficialId = new Map()
  for (const row of rows || []) {
    const key = row.carparkId || row.id
    const existing = byOfficialId.get(key)
    if (!existing || (row.lotType === 'C' && existing.lotType !== 'C')) byOfficialId.set(key, row)
  }
  return [...byOfficialId.values()]
}

const enriched = computed(() => carparks.value.map(carpark => ({
  ...carpark,
  community: summaryMap.value.get(carpark.id) || summaryMap.value.get(carpark.carparkId) || null,
})))

const featuredCarparks = computed(() => allCarparks.value.map(carpark => ({
  ...carpark,
  community: summaryMap.value.get(carpark.id) || summaryMap.value.get(carpark.carparkId) || null,
})))
const reviewed = computed(() => featuredCarparks.value.filter(row => row.community?.reviewCount > 0))
const topRated = computed(() => [...reviewed.value].sort((a, b) =>
  (b.community.overallRating - a.community.overallRating) || (b.community.reviewCount - a.community.reviewCount)).slice(0, 3))
const recentlyReviewed = computed(() => [...reviewed.value].sort((a, b) =>
  new Date(b.community.lastReviewedAt) - new Date(a.community.lastReviewedAt)).slice(0, 3))
const searchResults = computed(() => {
  const needle = query.value.trim().toLowerCase()
  let rows = needle && !selectedDestination.value
    ? enriched.value.filter(row => `${row.name} ${row.carparkId} ${row.area || ''}`.toLowerCase().includes(needle))
    : [...enriched.value]
  if (resultSort.value === 'nearest') {
    rows.sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY))
  } else if (resultSort.value === 'top-rated') {
    rows.sort((a, b) =>
      (b.community?.overallRating || 0) - (a.community?.overallRating || 0) ||
      (b.community?.reviewCount || 0) - (a.community?.reviewCount || 0))
  } else if (resultSort.value === 'most-reviewed') {
    rows.sort((a, b) =>
      (b.community?.reviewCount || 0) - (a.community?.reviewCount || 0) ||
      (b.community?.overallRating || 0) - (a.community?.overallRating || 0))
  }
  return rows
})

function detailsLink(carpark) {
  return {
    name: 'carpark-details',
    params: { id: carpark.id },
    hash: '#community-reviews',
    query: {
      name: carpark.name,
      lotType: carpark.lotType || 'C',
      from: 'community',
      ...(carpark.hasEvCharger ? { hasEv: '1' } : {}),
      ...(selectedDestination.value ? {
        destination: selectedDestination.value.SEARCHVAL,
        latitude: selectedDestination.value.LATITUDE,
        longitude: selectedDestination.value.LONGITUDE,
      } : {}),
    },
  }
}

function carparkForId(id) {
  return allCarparks.value.find(row => row.id === id || row.carparkId === id) || null
}

function carparkName(id) {
  return carparkForId(id)?.name || id
}

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const [{ data }, community] = await Promise.all([
      api.get('/carparks'),
      getCommunitySummaries(),
    ])
    allCarparks.value = uniqueCarparks(data.carparks)
    carparks.value = allCarparks.value
    summaryMap.value = new Map(community.summaries.map(item => [item.carparkId, item]))
    recentActivity.value = community.recentActivity
    modeLabel.value = 'All Singapore carparks'
    showSearchResults.value = false
  } catch (err) {
    error.value = err.response?.data?.message || 'Unable to load Community right now.'
  } finally {
    loading.value = false
  }
}

async function findDestinations() {
  selectedDestination.value = null
  if (!query.value.trim()) {
    clearSearch()
    return
  }
  if (query.value.trim().length < 2) {
    destinationMatches.value = []
    return
  }
  try {
    const { data } = await api.get('/locations/search', { params: { q: query.value } })
    destinationMatches.value = (data.results || []).slice(0, 6)
  } catch {
    destinationMatches.value = []
  }
}

function selectDestination(item) {
  selectedDestination.value = item
  query.value = item.SEARCHVAL
  destinationMatches.value = []
}

async function search() {
  if (!query.value.trim()) return loadAll()
  if (!selectedDestination.value) {
    destinationMatches.value = []
    modeLabel.value = `Carparks matching “${query.value.trim()}”`
    resultSort.value = 'top-rated'
    showSearchResults.value = true
    return
  }
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/carparks/nearby', { params: {
      latitude: selectedDestination.value.LATITUDE,
      longitude: selectedDestination.value.LONGITUDE,
      radius: 1000,
      vehicleType: 'C',
    } })
    carparks.value = uniqueCarparks(data.carparks)
    resultSort.value = 'nearest'
    modeLabel.value = `Within 1 km of ${selectedDestination.value.SEARCHVAL}`
    showSearchResults.value = true
  } catch (err) {
    error.value = err.response?.data?.message || 'Unable to find carparks around that destination.'
  } finally {
    loading.value = false
  }
}

function clearSearch() {
  query.value = ''
  selectedDestination.value = null
  destinationMatches.value = []
  resultSort.value = 'nearest'
  modeLabel.value = 'All Singapore carparks'
  showSearchResults.value = false
  error.value = ''
  if (allCarparks.value.length) carparks.value = allCarparks.value
  else loadAll()
}

onMounted(loadAll)
</script>

<template>
  <section class="community-page">
    <div class="community-inner">
      <p class="eyebrow">Community</p>
      <div class="intro-row">
        <div><h1>Park With Local Knowledge</h1><p>Ratings, honest driver experiences and useful discussions about Singapore carparks.</p></div>
      </div>

      <form class="community-search" @submit.prevent="search">
        <div class="search-field">
          <label for="community-search">Search carpark or destination</label>
          <input id="community-search" v-model="query" type="search" autocomplete="off" placeholder="e.g. Marina Square or Suntec City" @input="findDestinations" />
          <ul v-if="destinationMatches.length" class="suggestions">
            <li v-for="item in destinationMatches" :key="`${item.LATITUDE}-${item.LONGITUDE}`">
              <button type="button" @click="selectDestination(item)">{{ item.SEARCHVAL }}</button>
            </li>
          </ul>
        </div>
        <button class="primary-button" type="submit">Search</button>
        <button v-if="query" class="secondary-button" type="button" @click="clearSearch">Clear</button>
      </form>

      <div v-if="loading" class="state-panel" aria-live="polite">Loading community carparks…</div>
      <div v-else-if="error" class="state-panel error" role="alert"><p>{{ error }}</p><button class="primary-button" @click="loadAll">Try again</button></div>
      <template v-else>
        <section v-if="!showSearchResults" class="community-highlights">
          <div class="highlight-group activity-group">
            <div class="highlight-heading"><p class="section-kicker">What drivers are saying</p><h2>Recent Community Activity</h2></div>
            <div v-if="recentActivity.length" class="highlight-list">
              <article v-for="activity in recentActivity.slice(0, 2)" :key="activity._id" class="activity-card">
                <h3>{{ carparkName(activity.carparkId) }}</h3>
                <div class="activity-rating">
                  <StarRating :model-value="activity.overallRating" readonly />
                  <strong>{{ Number(activity.overallRating).toFixed(1) }}</strong>
                </div>
                <p>“{{ activity.comment }}”</p>
                <footer>
                  <div class="activity-author">
                    <strong>By <RouterLink v-if="activity.user?._id" class="profile-link" :to="{ name: 'user-profile', params: { userId: activity.user._id } }">{{ activity.user.name }}</RouterLink><span v-else>Community member</span></strong>
                    <time :datetime="activity.updatedAt">{{ new Date(activity.updatedAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) }}</time>
                  </div>
                  <RouterLink v-if="carparkForId(activity.carparkId)" class="activity-link" :to="detailsLink(carparkForId(activity.carparkId))">Read review →</RouterLink>
                </footer>
              </article>
            </div>
            <p v-else class="empty-note">No community activity yet.</p>
          </div>
          <div class="highlight-group">
            <div class="highlight-heading"><p class="section-kicker">Community favourites</p><h2>Top Rated Carparks</h2></div>
            <div v-if="topRated.length" class="highlight-list"><CommunityCarparkCard v-for="carpark in topRated.slice(0, 2)" :key="carpark.id" :carpark="carpark" :to="detailsLink(carpark)" /></div>
            <p v-else class="empty-note">No rated carparks yet.</p>
          </div>
          <div class="highlight-group">
            <div class="highlight-heading"><p class="section-kicker">Latest reviews</p><h2>Recently Reviewed</h2></div>
            <div v-if="recentlyReviewed.length" class="highlight-list"><CommunityCarparkCard v-for="carpark in recentlyReviewed.slice(0, 2)" :key="carpark.id" :carpark="carpark" :to="detailsLink(carpark)" /></div>
            <p v-else class="empty-note">No reviewed carparks yet.</p>
          </div>
        </section>

        <section v-if="showSearchResults" class="browse-section">
          <button class="back-community" type="button" @click="clearSearch">← Back to Community</button>
          <div class="section-heading">
            <div><p class="section-kicker">Search results</p><h2>Matching Carparks</h2><p>{{ modeLabel }}</p></div>
            <label class="result-sort">Sort by
              <select v-model="resultSort">
                <option v-if="selectedDestination" value="nearest">Nearest to destination</option>
                <option value="top-rated">Top rated</option>
                <option value="most-reviewed">Most reviewed</option>
              </select>
            </label>
          </div>
          <p v-if="!searchResults.length" class="empty-note">No carparks matched that search.</p>
          <div v-else class="browse-grid">
            <CommunityCarparkCard v-for="carpark in searchResults" :key="carpark.id" :carpark="carpark" :to="detailsLink(carpark)" />
          </div>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.profile-link { color: inherit; text-decoration: underline; text-underline-offset: .15em; }
.community-page { min-height: 100%; padding: 3.5rem 1.5rem 6rem; background: #f0fbf6; background-image: radial-gradient(#bfe9d7 1.1px, transparent 1.1px); background-size: 19px 19px; }
.community-inner { width: min(100%, 76rem); margin: auto; }
.intro-row h1 { max-width: none; font-size: clamp(2.5rem, 5vw, 4.3rem); white-space: nowrap; }
.intro-row p { max-width: 42rem; margin-top: 1rem; color: #52606d; font-size: 1.05rem; }
.community-search { position: relative; display: flex; align-items: end; gap: .75rem; margin: 2rem 0 3.5rem; padding: 1.25rem; border: 2px solid #174f40; border-radius: 1.25rem; background: white; }
.search-field { position: relative; flex: 1; }.search-field label, .section-heading label { display: grid; gap: .35rem; font-size: .8rem; font-weight: 750; }
.search-field input, .section-heading select { width: 100%; min-height: 3.1rem; padding: .7rem 1rem; border: 1.5px solid #174f40; border-radius: .75rem; background: white; }
.result-sort { width: min(100%, 16rem); color: #10243a; font-size: 1rem !important; font-weight: 800 !important; }
.result-sort select { margin-top: .25rem; font-size: 1rem; font-weight: 750; }
.result-sort option { font-size: 1rem; font-weight: 700; }
.suggestions { position: absolute; z-index: 5; top: 100%; right: 0; left: 0; margin: .25rem 0 0; padding: .4rem; list-style: none; border: 1px solid #b8cec5; border-radius: .7rem; background: white; box-shadow: 0 12px 30px #073f3220; }
.suggestions button { width: 100%; padding: .65rem; border: 0; border-radius: .4rem; text-align: left; background: white; }.suggestions button:hover { background: #eafbf4; }
.primary-button, .secondary-button { min-height: 3.1rem; padding: .7rem 1.3rem; border-radius: .75rem; font-weight: 750; }.primary-button { border: 1px solid #07875f; background: #2cd790; color: #06271f; }.secondary-button { border: 1px solid #82958e; background: white; }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }.section-heading h2 { margin: 0; font-size: 1.6rem; }.section-heading p { margin: .35rem 0 0; color: #60736b; }.section-kicker { color: #087a58 !important; font-size: .75rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.community-highlights { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: 3.5rem; align-items: stretch; }.highlight-group { display: flex; min-width: 0; flex-direction: column; padding: 1.1rem; border: 2px solid #174f40; border-radius: 1.25rem; background: #e8f8f1; }.activity-group { grid-column: 1 / -1; color: #10243a; background: white; }.activity-group .section-kicker { color: #087a58 !important; }.activity-group .highlight-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }.highlight-heading { min-height: 4.75rem; margin-bottom: .8rem; }.highlight-heading h2 { margin: 0; font-size: 1.3rem; }.highlight-list { display: grid; flex: 1; grid-auto-rows: 1fr; gap: .75rem; }.activity-card { display: flex; min-height: 13rem; flex-direction: column; padding: 1.25rem; border: 1.5px solid #4c8b76; border-radius: 1rem; background: #0b4b3d; color: white; }.activity-card:only-child { grid-column: 1 / -1; }.activity-card h3 { margin: 0 0 .65rem; font-size: 1.25rem; font-weight: 800; }.activity-rating { display: flex; align-items: center; gap: .55rem; }.activity-rating :deep(.stars) { font-size: 1.35rem; }.activity-rating > strong { color: #ffd35a; font-size: 1rem; }.activity-card p { margin: 1rem 0; font-size: 1.08rem; line-height: 1.5; }.activity-card footer { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-top: auto; color: #bce5d5; font-size: .95rem; }.activity-author { display: flex; flex-direction: column; gap: .15rem; }.activity-card footer strong { color: white; }.activity-link { color: #54e6aa; font-weight: 800; text-decoration: none; white-space: nowrap; }.activity-link:hover { color: white; text-decoration: underline; }.highlight-group :deep(.community-card) { min-height: 13rem; height: 100%; padding: 1rem; }.highlight-group :deep(.community-card h3) { margin: .6rem 0 .35rem; }.highlight-group :deep(.mini-breakdown) { margin: .55rem 0; padding: .45rem 0; }.highlight-group :deep(.community-card blockquote) { margin-bottom: .5rem; }.browse-section { margin-top: 3.5rem; }.browse-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; margin-top: 1rem; }
.community-highlights.search-active { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.community-highlights.search-active .activity-group { grid-column: auto; }
.community-highlights.search-active .activity-group .highlight-list { grid-template-columns: 1fr; }
.community-highlights.search-active .highlight-group { background: white; }
.community-highlights.search-active .activity-group { color: #10243a; }
.community-highlights.search-active .activity-group .section-kicker { color: #087a58 !important; }
.community-highlights.search-active .activity-card { color: #10243a; background: white; }
.community-highlights.search-active .activity-card small { color: #52606d; }
.community-highlights.search-active .activity-card footer,
.community-highlights.search-active .activity-card footer strong { color: #52606d; }
.community-highlights.search-active .activity-link { color: #087a58; }
.back-community { display: inline-flex; align-items: center; margin-bottom: 1.25rem; padding: .55rem .2rem; border: 0; color: #087a58; background: transparent; font-size: 1rem; font-weight: 800; }
.back-community:hover { color: #055c42; text-decoration: underline; }
:deep(.community-card) { display: flex; min-height: 18rem; flex-direction: column; padding: 1.35rem; border: 2px solid #174f40; border-radius: 1.25rem; background: white; }:deep(.community-card h3) { margin: 1rem 0 .65rem; font-size: 1.05rem; }:deep(.card-top), :deep(.rating-row), :deep(.mini-breakdown div) { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }:deep(.community-mark) { display: grid; width: 2.2rem; height: 2.2rem; place-items: center; border-radius: .6rem; color: #073f32; background: #2cd790; font-weight: 800; }:deep(.review-count) { color: #52606d; font-size: .75rem; }:deep(.mini-breakdown) { margin: 1rem 0; padding: .75rem 0; border-block: 1px solid #d6e5df; }:deep(.mini-breakdown div + div) { margin-top: .35rem; }:deep(.mini-breakdown dt) { color: #61736c; font-weight: 400; }:deep(.mini-breakdown dd) { margin: 0; font-weight: 750; }:deep(.community-card blockquote) { display: -webkit-box; overflow: hidden; margin: 0 0 1rem; color: #4d625a; font-size: .85rem; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }:deep(.community-card a) { margin-top: auto; color: #087a58; font-weight: 750; text-decoration: none; }:deep(.no-reviews) { color: #65776f; }
:deep(.distance-label) { margin: -.25rem 0 .6rem; color: #087a58; font-size: .78rem; font-weight: 700; }
.empty-note, .state-panel { padding: 2rem; border: 1.5px dashed #9db9ae; border-radius: 1rem; background: #ffffffaa; text-align: center; }.state-panel.error { color: #8f2929; }
@media (max-width: 1050px) { .community-highlights { grid-template-columns: 1fr; }.highlight-heading { min-height: 0; }.highlight-list { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 950px) { .browse-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .community-search { align-items: stretch; flex-direction: column; }.highlight-list, .activity-group .highlight-list, .browse-grid { grid-template-columns: 1fr; }.section-heading { align-items: stretch; flex-direction: column; } }
@media (max-width: 700px) { .intro-row h1 { white-space: normal; } }
</style>
