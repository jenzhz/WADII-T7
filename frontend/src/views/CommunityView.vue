<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '@/services/api'
import { getCommunitySummaries } from '@/services/reviews'
import { PARKING_DIFFICULTIES, parkingDifficultyDetails } from '@/utils/parkingDifficulty'

const allCarparks = ref([])
const nearbyCarparks = ref([])
const summaryMap = ref(new Map())
const loading = ref(true)
const error = ref('')
const destinationQuery = ref('')
const destinationMatches = ref([])
const selectedDestination = ref(null)
const activeDestination = ref(null)
const searchLoading = ref(false)
const searchError = ref('')
const selectedDifficulties = ref(PARKING_DIFFICULTIES.map(option => option.value))
let destinationRequest = 0

const difficultyMeta = [
  { ...PARKING_DIFFICULTIES[0], countKey: 'beginnerFriendlyCount', symbol: '✓' },
  { ...PARKING_DIFFICULTIES[1], countKey: 'moderateCount', symbol: '≈' },
  { ...PARKING_DIFFICULTIES[2], countKey: 'challengingCount', symbol: '!' },
]

function uniqueCarparks(rows) {
  const byOfficialId = new Map()
  for (const row of rows || []) {
    const key = row.carparkId || row.id
    const existing = byOfficialId.get(key)
    if (!existing || (row.lotType === 'C' && existing.lotType !== 'C')) byOfficialId.set(key, row)
  }
  return [...byOfficialId.values()]
}

function withCommunity(rows) {
  return rows.map(carpark => ({
    ...carpark,
    community: summaryMap.value.get(carpark.id) || summaryMap.value.get(carpark.carparkId) || null,
  })).filter(carpark => carpark.community?.reviewCount > 0)
}

const reviewed = computed(() => withCommunity(allCarparks.value))
const nearbyReviewed = computed(() => withCommunity(nearbyCarparks.value))
const locationReviewed = computed(() => activeDestination.value ? nearbyReviewed.value : reviewed.value)

const totalReviews = computed(() => reviewed.value.reduce((total, carpark) => total + carpark.community.reviewCount, 0))
const totalReplies = computed(() => reviewed.value.reduce((total, carpark) => total + (carpark.community.replyCount || 0), 0))

const difficultyGroups = difficultyMeta

const beginnerPicks = computed(() => locationReviewed.value
  .filter(carpark => carpark.community.parkingDifficulty === 'beginner-friendly')
  .sort((a, b) => beginnerScore(b.community) - beginnerScore(a.community))
  .slice(0, 3))

const guideCarparks = computed(() => {
  const showingAllDifficulties = selectedDifficulties.value.length === PARKING_DIFFICULTIES.length
  return locationReviewed.value
    .filter(carpark => showingAllDifficulties || selectedDifficulties.value.includes(carpark.community.parkingDifficulty))
    .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY) ||
      b.community.parkingDifficultyReviewCount - a.community.parkingDifficultyReviewCount ||
      b.community.reviewCount - a.community.reviewCount)
})

function beginnerScore(summary) {
  const categories = [summary.lotSpaciousness, summary.entranceExitAccessibility, summary.signage]
    .filter(value => Number.isFinite(value))
  const categoryScore = categories.length ? categories.reduce((sum, value) => sum + value, 0) / categories.length : 0
  const beginnerShare = summary.parkingDifficultyReviewCount
    ? (summary.beginnerFriendlyCount || 0) / summary.parkingDifficultyReviewCount
    : 0
  return categoryScore + beginnerShare
}

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
      ...(activeDestination.value ? {
        destination: activeDestination.value.SEARCHVAL,
        latitude: activeDestination.value.LATITUDE,
        longitude: activeDestination.value.LONGITUDE,
      } : {}),
    },
  }
}

function votePercent(summary, key) {
  if (!summary.parkingDifficultyReviewCount) return 0
  return Math.round(((summary[key] || 0) / summary.parkingDifficultyReviewCount) * 100)
}

async function findDestinations() {
  const requestId = ++destinationRequest
  selectedDestination.value = null
  searchError.value = ''
  const query = destinationQuery.value.trim()
  if (query.length < 2) {
    destinationMatches.value = []
    return
  }
  try {
    const { data } = await api.get('/locations/search', { params: { q: query } })
    if (requestId === destinationRequest) destinationMatches.value = (data.results || []).slice(0, 6)
  } catch (err) {
    if (requestId === destinationRequest) {
      destinationMatches.value = []
      searchError.value = err.response?.data?.message || 'Destination suggestions are unavailable.'
    }
  }
}

function selectDestination(destination) {
  selectedDestination.value = destination
  destinationQuery.value = destination.SEARCHVAL
  destinationMatches.value = []
  searchError.value = ''
}

async function searchNearbyReviews() {
  if (!selectedDestination.value) return
  searchLoading.value = true
  searchError.value = ''
  try {
    const { data } = await api.get('/carparks/nearby', { params: {
      latitude: selectedDestination.value.LATITUDE,
      longitude: selectedDestination.value.LONGITUDE,
      radius: 2000,
      vehicleType: 'C',
    } })
    nearbyCarparks.value = uniqueCarparks(data.carparks)
    activeDestination.value = selectedDestination.value
  } catch (err) {
    searchError.value = err.response?.data?.message || 'Unable to find reviewed carparks near that destination.'
  } finally {
    searchLoading.value = false
  }
}

function clearGuideSearch() {
  destinationRequest += 1
  destinationQuery.value = ''
  destinationMatches.value = []
  selectedDestination.value = null
  activeDestination.value = null
  nearbyCarparks.value = []
  searchError.value = ''
}

function resetDifficultyFilters() {
  selectedDifficulties.value = PARKING_DIFFICULTIES.map(option => option.value)
}

async function loadCommunity() {
  loading.value = true
  error.value = ''
  try {
    const [{ data }, community] = await Promise.all([
      api.get('/carparks'),
      getCommunitySummaries(),
    ])
    allCarparks.value = uniqueCarparks(data.carparks)
    summaryMap.value = new Map(community.summaries.map(item => [item.carparkId, item]))
  } catch (err) {
    error.value = err.response?.data?.message || 'Unable to load the community right now.'
  } finally {
    loading.value = false
  }
}

onMounted(loadCommunity)
</script>

<template>
  <section class="community-page">
    <div class="community-inner">
      <header class="community-hero">
        <div>
          <h1>Parking Community</h1>
          <p class="hero-copy">Know what parking feels like before you arrive.</p>
        </div>
        <div class="community-stats" aria-label="Community totals">
          <div><strong>{{ totalReviews }}</strong><span>Experiences</span></div>
          <div><strong>{{ totalReplies }}</strong><span>Replies</span></div>
          <div><strong>{{ reviewed.length }}</strong><span>Carparks discussed</span></div>
        </div>
      </header>

      <div v-if="loading" class="state-panel" aria-live="polite">Loading community discussions…</div>
      <div v-else-if="error" class="state-panel error" role="alert"><p>{{ error }}</p><button class="primary-button" @click="loadCommunity">Try again</button></div>

      <template v-else>
        <section class="difficulty-section difficulty-legend" aria-labelledby="difficulty-heading">
          <div class="section-heading">
            <div><h2 id="difficulty-heading">How easy is it to park?</h2><p>Labels are calculated from driver votes and update as the community contributes.</p></div>
          </div>
          <div class="difficulty-columns">
            <article v-for="group in difficultyGroups" :key="group.value" class="difficulty-column" :class="`difficulty-panel-${group.value}`">
              <header><div><span class="difficulty-symbol" aria-hidden="true">{{ group.symbol }}</span><h3>{{ group.label }}</h3></div></header>
              <p>{{ group.description }}</p>
            </article>
          </div>
        </section>

        <section class="guide-section guide-section-top" aria-labelledby="guide-heading">
          <div class="section-heading">
            <div><h2 id="guide-heading">Community Parking Guide</h2><p>See the vote distribution behind every verdict—not just the final label.</p></div>
          </div>

          <div class="guide-controls">
            <form class="destination-search" @submit.prevent="searchNearbyReviews">
              <div class="destination-input">
                <label for="community-destination">Find reviewed carparks near a destination</label>
                <input id="community-destination" v-model="destinationQuery" type="search" autocomplete="off" placeholder="e.g. SMU Connexion" @input="findDestinations" />
                <ul v-if="destinationMatches.length" class="destination-suggestions">
                  <li v-for="destination in destinationMatches" :key="`${destination.LATITUDE}-${destination.LONGITUDE}`">
                    <button type="button" @click="selectDestination(destination)">{{ destination.SEARCHVAL }}</button>
                  </li>
                </ul>
              </div>
              <button class="search-guide-button" type="submit" :disabled="!selectedDestination || searchLoading">{{ searchLoading ? 'Searching…' : 'Search nearby' }}</button>
              <button v-if="activeDestination || destinationQuery" class="clear-guide-button" type="button" @click="clearGuideSearch">Clear</button>
            </form>

            <fieldset class="difficulty-filters" aria-label="Filter by parking difficulty">
              <label v-for="option in PARKING_DIFFICULTIES" :key="option.value" :class="`filter-${option.value}`">
                <input v-model="selectedDifficulties" type="checkbox" :value="option.value" />
                <span>{{ option.label }}</span>
              </label>
              <button v-if="selectedDifficulties.length !== PARKING_DIFFICULTIES.length" type="button" @click="resetDifficultyFilters">Reset</button>
            </fieldset>
          </div>

          <p v-if="searchError" class="guide-error" role="alert">{{ searchError }}</p>
          <div class="guide-result-heading">
            <strong>{{ guideCarparks.length }} reviewed carpark{{ guideCarparks.length === 1 ? '' : 's' }}</strong>
            <span v-if="activeDestination">within 2 km of {{ activeDestination.SEARCHVAL }}</span>
            <span v-else>across the community</span>
          </div>

          <div v-if="guideCarparks.length" class="guide-scroll" tabindex="0" aria-label="Scrollable list of reviewed carparks">
            <div class="guide-grid">
              <article v-for="carpark in guideCarparks" :key="carpark.id" class="guide-card">
              <header>
                <div><h3>{{ carpark.name }}</h3><span>{{ carpark.community.reviewCount }} experiences · {{ carpark.community.replyCount || 0 }} replies<span v-if="Number.isFinite(carpark.distance)"> · {{ Math.round(carpark.distance) }} m away</span></span></div>
                <span v-if="parkingDifficultyDetails(carpark.community.parkingDifficulty)" class="difficulty-badge" :class="`difficulty-${carpark.community.parkingDifficulty}`" :title="parkingDifficultyDetails(carpark.community.parkingDifficulty).description">Parking: {{ parkingDifficultyDetails(carpark.community.parkingDifficulty).label }}</span>
              </header>
              <div class="vote-bars">
                <div v-for="option in difficultyMeta" :key="option.value">
                  <div class="bar-label"><span>{{ option.label }}</span><strong>{{ carpark.community[option.countKey] || 0 }}</strong></div>
                  <span class="bar-track"><span :class="`bar-${option.value}`" :style="{ width: `${votePercent(carpark.community, option.countKey)}%` }"></span></span>
                </div>
              </div>
              <dl class="category-scores">
                <div><dt>Lot space</dt><dd>{{ carpark.community.lotSpaciousness?.toFixed(1) || '—' }}</dd></div>
                <div><dt>Access</dt><dd>{{ carpark.community.entranceExitAccessibility?.toFixed(1) || '—' }}</dd></div>
                <div><dt>Signage</dt><dd>{{ carpark.community.signage?.toFixed(1) || '—' }}</dd></div>
              </dl>
              <RouterLink class="guide-link" :to="detailsLink(carpark)">Read experiences and join discussion →</RouterLink>
              </article>
            </div>
          </div>
          <div v-else class="empty-guide">
            <strong>No reviewed carparks match these filters.</strong>
            <p>Try another destination or include more difficulty levels.</p>
          </div>
        </section>

        <section class="beginner-card beginner-wide">
          <div><h2>Best for beginners</h2><p>Based on difficulty votes, space, access, and signage.</p></div>
          <ol v-if="beginnerPicks.length" class="ranked-list">
            <li v-for="(carpark, index) in beginnerPicks" :key="carpark.id">
              <span>{{ index + 1 }}</span>
              <RouterLink :to="detailsLink(carpark)"><strong>{{ carpark.name }}</strong><small>{{ carpark.community.beginnerFriendlyCount }} of {{ carpark.community.parkingDifficultyReviewCount }} say beginner friendly</small></RouterLink>
            </li>
          </ol>
          <p v-else class="empty-category">More difficulty votes are needed.</p>
        </section>

      </template>
    </div>
  </section>
</template>

<style scoped>
.community-page { min-height: 100%; padding: 3.5rem 1.5rem 6rem; color: #10243a; background-color: #f0fbf6; background-image: radial-gradient(#bfe9d7 1.1px, transparent 1.1px); background-size: 19px 19px; }
.community-inner { width: min(100%, 76rem); margin: auto; }
.community-hero { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(22rem, .65fr); align-items: end; gap: 2rem; padding: 2.2rem; border: 2px solid #174f40; border-radius: 1.6rem; background: #0b4b3d; color: white; box-shadow: 0 14px 35px #073f3218; }
.community-hero h1 { margin: 0; font-size: clamp(2.6rem, 6vw, 4.7rem); line-height: .98; }
.hero-copy { max-width: 42rem; margin: 1rem 0 0; color: #c9eddf; font-size: 1.08rem; line-height: 1.6; }
.community-stats { display: grid; grid-template-columns: repeat(3, 1fr); overflow: hidden; border: 1px solid #4f8d78; border-radius: 1rem; background: #073f32; }
.community-stats div { display: grid; gap: .25rem; padding: 1rem .75rem; text-align: center; }
.community-stats div + div { border-left: 1px solid #4f8d78; }
.community-stats strong { color: #54e6aa; font-size: 1.65rem; }
.community-stats span { color: #c9eddf; font-size: .7rem; }
.state-panel { margin-top: 2rem; padding: 3rem 1rem; border: 1.5px dashed #9db9ae; border-radius: 1rem; background: #ffffffd9; text-align: center; }
.state-panel.error { color: #8f2929; }.primary-button { min-height: 2.8rem; padding: .6rem 1.1rem; border: 1px solid #07875f; border-radius: .7rem; color: #06271f; background: #2cd790; font-weight: 750; }
.difficulty-section, .forum-layout, .guide-section { margin-top: 3.5rem; }.guide-section-top { margin-top: 2.5rem; }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
.section-heading h2 { margin: 0; font-size: clamp(1.55rem, 3vw, 2rem); }
.section-heading p:last-child { margin: .35rem 0 0; color: #60736b; }
.difficulty-columns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.difficulty-column { min-height: 15rem; padding: 1.25rem; border: 1.5px solid #8bb8a8; border-radius: 1.2rem; background: white; box-shadow: 0 8px 22px #173e300c; }
.difficulty-panel-beginner-friendly { border-color: #65b996; background: #edfbf4; }.difficulty-panel-moderate { border-color: #e0bd58; background: #fff9e8; }.difficulty-panel-challenging { border-color: #df8d8d; background: #fff2f2; }
.difficulty-column > header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.difficulty-column > header div { display: flex; align-items: center; gap: .55rem; }.difficulty-column h3 { margin: 0; font-size: 1.15rem; }
.difficulty-column > header > strong { display: grid; width: 2rem; height: 2rem; place-items: center; border-radius: 50%; background: #edf3f1; }
.difficulty-symbol { display: grid; width: 2.4rem; height: 2.4rem; place-items: center; border-radius: .75rem; color: white; background: #15946b; font-size: 1.25rem; font-weight: 900; }.difficulty-panel-moderate .difficulty-symbol { color: #614400; background: #ffd45e; }.difficulty-panel-challenging .difficulty-symbol { background: #d65353; }
.difficulty-column > p { min-height: 2.6rem; margin: .65rem 0 1rem; color: #60736b; font-size: .82rem; line-height: 1.45; }
.difficulty-legend .difficulty-column { min-height: 0; }.difficulty-legend .difficulty-column > p { min-height: 0; margin-bottom: 0; }
.category-list { display: grid; gap: .5rem; margin: 0; padding: 0; list-style: none; counter-reset: category; }
.category-list li { counter-increment: category; }.category-list a { display: grid; grid-template-columns: auto 1fr; gap: 0 .6rem; padding: .7rem; border-radius: .7rem; color: #10243a; background: #f5f9f7; text-decoration: none; }
.category-list a::before { content: counter(category); grid-row: 1 / span 2; display: grid; width: 1.55rem; height: 1.55rem; place-items: center; border-radius: .45rem; color: white; background: #174f40; font-size: .72rem; font-weight: 800; }
.category-list a:hover { background: #e6f5ee; }.category-list span { font-weight: 750; }.category-list small { color: #6b7d75; }
.empty-category { min-height: 0 !important; margin: 1rem 0 0 !important; padding: 1rem; border-radius: .7rem; background: #f5f9f7; text-align: center; }
.forum-layout { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(17rem, .75fr); align-items: start; gap: 1.25rem; }
.discussion-section { min-width: 0; }.discussion-heading { margin-bottom: .9rem; }
.feed-filters { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1rem; }
.feed-filters button { padding: .5rem .8rem; border: 1px solid #9cb5ab; border-radius: 2rem; color: #40564e; background: white; font-size: .8rem; font-weight: 750; }
.feed-filters button.active { border-color: #087a58; color: white; background: #087a58; }
.discussion-feed { display: grid; gap: .85rem; }.discussion-card { padding: 1.2rem; border: 1.5px solid #b8cec5; border-radius: 1rem; background: white; }
.discussion-card > header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .75rem; }
.member-avatar { display: grid; width: 2.5rem; height: 2.5rem; place-items: center; border-radius: 50%; color: #073f32; background: #2cd790; font-weight: 850; }
.post-byline { display: flex; min-width: 0; flex-direction: column; font-size: .8rem; }.post-byline a { color: #087a58; }.post-byline span { overflow: hidden; color: #60736b; text-overflow: ellipsis; white-space: nowrap; }
.discussion-card time { color: #71817b; font-size: .75rem; }.post-meta { display: flex; align-items: center; flex-wrap: wrap; gap: .65rem; margin-top: .9rem; }
.difficulty-badge { display: inline-flex; width: fit-content; padding: .3rem .65rem; border-radius: 2rem; font-size: .72rem; font-weight: 800; white-space: nowrap; }.difficulty-beginner-friendly { color: #087a58; background: #dff7ec; }.difficulty-moderate { color: #805b00; background: #fff0bf; }.difficulty-challenging { color: #a02f2f; background: #fde2e2; }
.post-rating { display: inline-flex; align-items: center; gap: .35rem; color: #52606d; font-size: .8rem; }.post-rating :deep(.stars) { font-size: 1rem; }
.post-comment { display: -webkit-box; overflow: hidden; margin: .9rem 0; font-size: 1rem; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.discussion-card footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: .8rem; border-top: 1px solid #e0ebe6; color: #6b7d75; font-size: .8rem; }.discussion-card footer a { color: #087a58; font-weight: 800; text-decoration: none; }
.empty-feed { padding: 2rem; border: 1.5px dashed #9db9ae; border-radius: 1rem; background: white; text-align: center; }
.community-sidebar { display: grid; gap: 1rem; }.sidebar-card { padding: 1.2rem; border: 2px solid #174f40; border-radius: 1rem; background: white; }.beginner-card { background: #e7f8f0; }.sidebar-card h2 { margin: 0; font-size: 1.25rem; }.sidebar-card > p:not(.section-kicker, .empty-category) { color: #60736b; font-size: .82rem; line-height: 1.45; }
.ranked-list { display: grid; gap: .7rem; margin: 1rem 0 0; padding: 0; list-style: none; }.ranked-list li { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: .6rem; }.ranked-list li > span { display: grid; width: 1.8rem; height: 1.8rem; place-items: center; border-radius: 50%; color: white; background: #087a58; font-size: .75rem; font-weight: 800; }.ranked-list a { display: grid; color: #10243a; text-decoration: none; }.ranked-list small { margin-top: .1rem; color: #60736b; font-size: .7rem; }
.discussion-list { display: grid; gap: .4rem; margin: 1rem 0 0; padding: 0; list-style: none; }.discussion-list a { display: flex; justify-content: space-between; gap: .75rem; padding: .65rem 0; border-bottom: 1px solid #d6e5df; color: #10243a; font-size: .82rem; text-decoration: none; }.discussion-list strong { color: #087a58; white-space: nowrap; }
.guide-controls { display: grid; grid-template-columns: 1fr; align-items: start; gap: .75rem; margin-bottom: 1rem; }.destination-search { display: flex; width: 100%; align-items: end; gap: .6rem; padding: 1rem; border: 1.5px solid #174f40; border-radius: 1rem; background: white; }.destination-input { position: relative; min-width: 0; flex: 1; }.destination-input label { display: block; margin-bottom: .4rem; color: #174f40; font-size: .78rem; font-weight: 800; }.destination-input input { width: 100%; min-height: 2.8rem; padding: .65rem .8rem; border: 1.5px solid #9cb5ab; border-radius: .7rem; outline: none; }.destination-input input:focus { border-color: #087a58; box-shadow: 0 0 0 3px #2cd79022; }.destination-suggestions { position: absolute; z-index: 8; top: calc(100% + .3rem); right: 0; left: 0; max-height: 15rem; overflow-y: auto; margin: 0; padding: .35rem; list-style: none; border: 1px solid #a9c2b8; border-radius: .7rem; background: white; box-shadow: 0 12px 28px #073f3224; }.destination-suggestions button { width: 100%; padding: .65rem; border: 0; border-radius: .45rem; text-align: left; background: white; }.destination-suggestions button:hover { background: #e8f8f1; }.search-guide-button, .clear-guide-button { min-height: 2.8rem; padding: .6rem .9rem; border-radius: .7rem; font-size: .78rem; font-weight: 800; white-space: nowrap; }.search-guide-button { border: 1px solid #07875f; color: #06271f; background: #2cd790; }.search-guide-button:disabled { opacity: .5; }.clear-guide-button { border: 1px solid #9cb5ab; color: #40564e; background: white; }.difficulty-filters { display: flex; width: fit-content; max-width: 100%; align-items: center; flex-wrap: nowrap; gap: .5rem; margin: 0; padding: .75rem 1rem; border: 1.5px solid #174f40; border-radius: 1rem; background: white; }.difficulty-filters label { display: inline-flex; align-items: center; gap: .35rem; padding: .38rem .65rem; border: 1px solid #b8cec5; border-radius: 2rem; cursor: pointer; font-size: .75rem; font-weight: 750; white-space: nowrap; }.difficulty-filters input { accent-color: #087a58; }.difficulty-filters .filter-beginner-friendly { color: #087a58; background: #edfbf4; }.difficulty-filters .filter-moderate { color: #805b00; background: #fff9e8; }.difficulty-filters .filter-challenging { color: #a02f2f; background: #fff2f2; }.difficulty-filters button { margin-left: auto; padding: .3rem .55rem; border: 0; color: #087a58; background: transparent; font-size: .72rem; font-weight: 800; }.guide-error { margin: 0 0 1rem; padding: .75rem 1rem; border-radius: .7rem; color: #922f2f; background: #fdeaea; }.guide-result-heading { display: flex; align-items: baseline; gap: .4rem; margin: .9rem 0 .65rem; }.guide-result-heading span { color: #60736b; font-size: .82rem; }.guide-scroll { max-height: min(68vh, 43rem); overflow-y: auto; padding: .3rem .65rem .3rem .3rem; border: 1.5px solid #b8cec5; border-radius: 1.25rem; background: #e7f5ee99; scrollbar-color: #4f8d78 #dcebe4; scrollbar-width: thin; }.guide-scroll:focus { outline: 3px solid #2cd79055; outline-offset: 3px; }.guide-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }.guide-card { display: flex; min-height: 21rem; flex-direction: column; padding: 1.25rem; border: 2px solid #174f40; border-radius: 1.2rem; background: white; }.guide-card > header { display: flex; align-items: start; justify-content: space-between; gap: 1rem; }.guide-card h3 { margin: 0; font-size: 1.1rem; }.guide-card header div > span { color: #6b7d75; font-size: .72rem; }
.vote-bars { display: grid; gap: .6rem; margin: 1.1rem 0; }.bar-label { display: flex; justify-content: space-between; margin-bottom: .25rem; color: #52606d; font-size: .75rem; }.bar-track { display: block; overflow: hidden; height: .45rem; border-radius: 2rem; background: #edf2f0; }.bar-track > span { display: block; min-width: 0; height: 100%; border-radius: inherit; }.bar-beginner-friendly { background: #22aa76; }.bar-moderate { background: #e2aa17; }.bar-challenging { background: #d65353; }
.category-scores { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; margin: 0 0 1rem; }.category-scores div { padding: .55rem; border-radius: .65rem; background: #f3f7f5; text-align: center; }.category-scores dt { color: #60736b; font-size: .68rem; }.category-scores dd { margin: .15rem 0 0; font-weight: 800; }.guide-link { margin-top: auto; color: #087a58; font-size: .82rem; font-weight: 800; text-decoration: none; }
.beginner-wide { display: grid; grid-template-columns: minmax(14rem, .65fr) minmax(0, 1.35fr); align-items: center; gap: 1.5rem; margin-top: 1.5rem; padding: 1.25rem; border: 2px solid #174f40; border-radius: 1.2rem; background: #e7f8f0; }.beginner-wide h2 { margin: 0; font-size: 1.25rem; }.beginner-wide > div > p:last-child { margin: .35rem 0 0; color: #60736b; font-size: .82rem; }.beginner-wide .ranked-list { grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
.empty-guide { padding: 2rem; border: 1.5px dashed #9db9ae; border-radius: 1rem; background: white; text-align: center; }.empty-guide p { margin: .35rem 0 0; color: #60736b; }
@media (max-width: 1000px) { .community-hero { grid-template-columns: 1fr; }.guide-controls { grid-template-columns: 1fr; }.difficulty-filters { flex-wrap: wrap; }.forum-layout { grid-template-columns: 1fr; }.community-sidebar { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 800px) { .difficulty-columns, .guide-grid { grid-template-columns: 1fr; }.beginner-wide { grid-template-columns: 1fr; }.beginner-wide .ranked-list { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .community-page { padding: 1.5rem 1rem 4rem; }.community-hero { padding: 1.4rem; }.community-stats { grid-template-columns: 1fr; }.community-stats div + div { border-top: 1px solid #4f8d78; border-left: 0; }.destination-search { align-items: stretch; flex-direction: column; }.search-guide-button, .clear-guide-button { width: 100%; }.community-sidebar { grid-template-columns: 1fr; }.discussion-card > header { grid-template-columns: auto 1fr; }.discussion-card time { grid-column: 2; }.discussion-card footer { align-items: flex-start; flex-direction: column; }.guide-card > header { flex-direction: column; }.guide-result-heading { align-items: flex-start; flex-direction: column; } }
</style>
