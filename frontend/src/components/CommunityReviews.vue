<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { getCurrentUser } from '@/services/auth'
import {
  createReply,
  createReview,
  deleteReply,
  deleteReview,
  getCarparkReviews,
  toggleReviewHelpful,
  updateReply,
  updateReview,
} from '@/services/reviews'
import StarRating from './StarRating.vue'
import ContributorLevelsDialog from './ContributorLevelsDialog.vue'
import { PARKING_DIFFICULTIES, parkingDifficultyDetails } from '@/utils/parkingDifficulty'

const props = defineProps({ carparkId: { type: String, required: true }, hasEvCharger: { type: Boolean, default: false } })
const user = ref(getCurrentUser())
const levelsDialog = ref(null)
const reviews = ref([])
const summary = ref({ reviewCount: 0, overallRating: null })
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const message = ref('')
const showForm = ref(false)
const editingReviewId = ref(null)
const formEl = ref(null)
const replyDrafts = reactive({})
const editingReply = ref(null)
const editReplyText = ref('')

const blankForm = () => ({
  overallRating: '', lotSpaciousness: '', entranceExitAccessibility: '',
  signage: '', pricing: '', parkingDifficulty: '', comment: '',
})
const form = reactive(blankForm())

const breakdown = computed(() => [
  ['Lot Spaciousness', summary.value.lotSpaciousness],
  ['Entrance / Exit Access', summary.value.entranceExitAccessibility],
  ['Signage', summary.value.signage],
  ...(summary.value.pricing != null ? [['Pricing', summary.value.pricing]] : []),
])
const difficultyConsensus = computed(() => parkingDifficultyDetails(summary.value.parkingDifficulty))

function apiMessage(err, fallback) {
  return err.response?.data?.message || fallback
}

// Re-read who is logged in. The page may have been opened while another
// account was logged in (e.g. switching test accounts in another tab).
function refreshUser() { user.value = getCurrentUser() }

// Lists what is still missing, so a greyed-out button is never a mystery.
const missingFields = computed(() => [
  !form.overallRating && 'overall rating',
  !form.parkingDifficulty && 'how easy it is to park',
  !form.comment.trim() && 'a written review',
].filter(Boolean))

// First load shows "Loading reviews…". After that (posting, editing or deleting
// a review/reply) the list stays on screen and is updated quietly in the
// background, so the page does not flash or jump.
let loadedCarparkId = null
async function loadReviews() {
  refreshUser()
  const quiet = loadedCarparkId === props.carparkId
  loading.value = !quiet
  error.value = ''
  try {
    const data = await getCarparkReviews(props.carparkId)
    reviews.value = data.reviews
    summary.value = data.summary
    loadedCarparkId = props.carparkId
  } catch (err) {
    error.value = apiMessage(err, 'Unable to load community reviews.')
  } finally {
    loading.value = false
  }
}

function startReview(review = null) {
  Object.assign(form, blankForm())
  editingReviewId.value = review?._id || null
  if (review) {
    for (const key of Object.keys(form)) form[key] = review[key] ?? ''
  }
  showForm.value = true
  message.value = ''
  // The form sits above the review list, so bring it into view
  // (otherwise clicking Edit on a review further down looks like nothing happened).
  nextTick(() => {
    formEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    formEl.value?.querySelector('textarea')?.focus({ preventScroll: true })
  })
}

function cancelReview() {
  showForm.value = false
  editingReviewId.value = null
  Object.assign(form, blankForm())
}

async function saveReview() {
  saving.value = true
  error.value = ''
  try {
    const payload = { carparkId: props.carparkId, ...form }
    if (editingReviewId.value) await updateReview(editingReviewId.value, payload)
    else await createReview(payload)
    message.value = editingReviewId.value ? 'Your review was updated.' : 'Thanks for sharing your experience.'
    cancelReview()
    await loadReviews()
  } catch (err) {
    error.value = apiMessage(err, 'Unable to save your review.')
  } finally {
    saving.value = false
  }
}

async function removeReview(review) {
  if (!window.confirm('Delete your review and all replies underneath it?')) return
  try {
    await deleteReview(review._id)
    message.value = 'Your review was deleted.'
    await loadReviews()
  } catch (err) { error.value = apiMessage(err, 'Unable to delete the review.') }
}

async function markHelpful(review) {
  if (!user.value || isMine(review)) return
  try {
    const result = await toggleReviewHelpful(review._id)
    review.helpfulByCurrentUser = result.helpful
    review.helpfulCount = result.helpfulCount
  } catch (err) { error.value = apiMessage(err, 'Unable to update the helpful vote.') }
}

async function sendReply(review) {
  const comment = String(replyDrafts[review._id] || '').trim()
  if (!comment) return
  try {
    await createReply(review._id, comment)
    replyDrafts[review._id] = ''
    await loadReviews()
  } catch (err) { error.value = apiMessage(err, 'Unable to post the reply.') }
}

function startReplyEdit(reviewId, reply) {
  editingReply.value = { reviewId, replyId: reply._id }
  editReplyText.value = reply.comment
}

async function saveReplyEdit() {
  if (!editReplyText.value.trim()) return
  try {
    await updateReply(editingReply.value.reviewId, editingReply.value.replyId, editReplyText.value)
    editingReply.value = null
    editReplyText.value = ''
    await loadReviews()
  } catch (err) { error.value = apiMessage(err, 'Unable to update the reply.') }
}

async function removeReply(reviewId, replyId) {
  if (!window.confirm('Delete this reply?')) return
  try {
    await deleteReply(reviewId, replyId)
    await loadReviews()
  } catch (err) { error.value = apiMessage(err, 'Unable to delete the reply.') }
}

function isMine(item) { return item.user?._id === user.value?.id }
function formattedDate(value) { return new Date(value).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) }
function contributorClass(level) { return `contributor-${String(level || 'new-contributor').toLowerCase().replaceAll(' ', '-')}` }
function contributorIcon(level) {
  return {
    'New Contributor': '🌱',
    'Helpful Contributor': '👍',
    'Trusted Contributor': '◆',
    'Community Champion': '🏆',
  }[level] || '🌱'
}

onMounted(async () => {
  window.addEventListener('auth-changed', refreshUser)
  window.addEventListener('storage', refreshUser)
  await loadReviews()
  if (window.location.hash === '#community-reviews') {
    await nextTick()
    document.getElementById('community-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', refreshUser)
  window.removeEventListener('storage', refreshUser)
})
watch(() => props.carparkId, loadReviews)
</script>

<template>
  <section id="community-reviews" class="community-reviews">
    <div class="community-heading">
      <div><h2>What drivers think</h2></div>
      <button v-if="user" class="write-button" type="button" @click="startReview()">Write a review</button>
      <RouterLink v-else class="write-button" to="/login">Log in to review</RouterLink>
    </div>

    <div v-if="loading" class="review-state">Loading reviews…</div>
    <div v-else-if="error && !reviews.length" class="review-state error" role="alert">{{ error }}</div>
    <template v-else>
      <div class="rating-summary">
        <div class="overall-score"><strong>{{ summary.overallRating == null ? '—' : Number(summary.overallRating).toFixed(1) }}</strong><StarRating :model-value="summary.overallRating || 0" readonly /><span>Based on {{ summary.reviewCount || 0 }} review{{ summary.reviewCount === 1 ? '' : 's' }}</span></div>
        <div class="summary-details">
          <div v-if="difficultyConsensus" class="difficulty-consensus">
            <span>Community parking difficulty</span>
            <strong class="difficulty-badge" :class="`difficulty-${summary.parkingDifficulty}`" :title="difficultyConsensus.description">{{ difficultyConsensus.label }}</strong>
          </div>
          <dl class="breakdown"><div v-for="([label, value]) in breakdown" :key="label"><dt>{{ label }}</dt><dd>{{ value == null ? '—' : Number(value).toFixed(1) }}</dd></div></dl>
        </div>
      </div>

      <div v-if="message" class="notice success" role="status">{{ message }}</div>
      <div v-if="error" class="notice error" role="alert">{{ error }}</div>

      <form v-if="showForm" ref="formEl" class="review-form" @submit.prevent="saveReview">
        <div class="form-heading"><div><h3>{{ editingReviewId ? 'Edit your review' : 'Write a review' }}</h3><p>Your overall rating and parking difficulty are required. Category ratings help other drivers but are optional.</p></div><button type="button" class="text-button" @click="cancelReview">Cancel</button></div>
        <div class="rating-fields">
          <div class="required-rating">
            <div><strong>Overall Rating <span aria-hidden="true">*</span></strong><small>Required · Your main score for this carpark</small></div>
            <StarRating v-model="form.overallRating" label="Overall rating" />
          </div>
          <label><span>Lot Spaciousness</span><StarRating v-model="form.lotSpaciousness" label="Lot spaciousness" /></label>
          <label><span>Entrance / Exit Accessibility</span><StarRating v-model="form.entranceExitAccessibility" label="Entrance and exit accessibility" /></label>
          <label><span>Signage</span><StarRating v-model="form.signage" label="Signage" /></label>
          <label><span>Pricing</span><StarRating v-model="form.pricing" label="Pricing" /></label>
        </div>
        <fieldset class="difficulty-field">
          <legend>How easy is it to park here? <span aria-hidden="true">*</span></legend>
          <p>Consider the lot size, ramps, turns, signage, and entrance or exit.</p>
          <div class="difficulty-options">
            <label v-for="option in PARKING_DIFFICULTIES" :key="option.value" :class="{ selected: form.parkingDifficulty === option.value }">
              <input v-model="form.parkingDifficulty" type="radio" name="parking-difficulty" :value="option.value" required />
              <span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span>
            </label>
          </div>
        </fieldset>
        <label class="comment-field"><span>Review *</span><textarea v-model="form.comment" required maxlength="2000" rows="4" placeholder="Share useful details about navigation, lots, access or condition."></textarea><small>{{ form.comment.length }}/2000</small></label>
        <button class="submit-button" type="submit" :disabled="saving || missingFields.length > 0">{{ saving ? 'Saving…' : editingReviewId ? 'Update review' : 'Submit review' }}</button>
        <p v-if="missingFields.length" class="missing-hint">Please add {{ missingFields.join(', ') }} to {{ editingReviewId ? 'update' : 'submit' }} your review.</p>
      </form>

      <div v-if="!reviews.length" class="review-state"><h3>No community reviews yet.</h3><p>Be the first to review this carpark.</p></div>
      <div v-else class="review-list">
        <article v-for="review in reviews" :key="review._id" class="review-card">
          <header>
            <div>
              <div class="review-author-line">
                <h3><span v-if="isMine(review)" class="own-name">{{ review.user.name }} <small>(you)</small></span><RouterLink v-else class="profile-link" :to="{ name: 'user-profile', params: { userId: review.user._id } }">{{ review.user.name }}</RouterLink></h3>
                <button
                  type="button"
                  class="contributor-badge"
                  :class="contributorClass(review.user.contributor?.level)"
                  aria-haspopup="dialog"
                  :aria-label="`View contributor levels for ${review.user.name}. ${review.user.contributor?.level || 'New Contributor'}`"
                  :title="`${review.user.contributor?.points || 0} points · View contributor levels`"
                  @click="levelsDialog.open(review.user.contributor, review.user.name, isMine(review))"
                ><span aria-hidden="true">{{ contributorIcon(review.user.contributor?.level) }}</span> {{ review.user.contributor?.level || 'New Contributor' }}</button>
                <StarRating :model-value="review.overallRating" readonly />
              </div>
            </div>
            <div class="review-side">
              <small class="review-time">{{ formattedDate(review.updatedAt) }}<span v-if="review.updatedAt !== review.createdAt"> · edited</span></small>
              <div v-if="isMine(review)" class="owner-actions"><button @click="startReview(review)">Edit</button><button class="danger" @click="removeReview(review)">Delete</button></div>
            </div>
          </header>
          <span v-if="parkingDifficultyDetails(review.parkingDifficulty)" class="difficulty-badge" :class="`difficulty-${review.parkingDifficulty}`" :title="parkingDifficultyDetails(review.parkingDifficulty).description">Parking: {{ parkingDifficultyDetails(review.parkingDifficulty).label }}</span>
          <p class="review-comment">{{ review.comment }}</p>
          <dl class="review-ratings"><template v-for="([key, label]) in [['lotSpaciousness','Lot space'],['entranceExitAccessibility','Access'],['signage','Signage'],['pricing','Pricing']]" :key="key"><div v-if="review[key]"><dt>{{ label }}</dt><dd>{{ review[key] }}/5</dd></div></template></dl>
          <button class="helpful-button" :class="{ active: review.helpfulByCurrentUser }" type="button" :disabled="!user || isMine(review)" :title="isMine(review) ? 'You cannot vote for your own review' : !user ? 'Log in to mark this review as helpful' : ''" @click="markHelpful(review)">
            <span aria-hidden="true">👍</span> {{ review.helpfulByCurrentUser ? 'Helpful' : 'Mark helpful' }} <strong>{{ review.helpfulCount || 0 }}</strong>
          </button>

          <div class="replies">
            <h4>Replies <span>{{ review.replies.length }}</span></h4>
            <div v-for="reply in review.replies" :key="reply._id" class="reply">
              <template v-if="editingReply?.replyId === reply._id"><textarea v-model="editReplyText" maxlength="1000" rows="2"></textarea><div class="reply-actions"><button @click="saveReplyEdit">Save</button><button @click="editingReply = null">Cancel</button></div></template>
              <template v-else>
                <div>
                  <strong><span v-if="isMine(reply)" class="own-name">{{ reply.user.name }} <small>(you)</small></span><RouterLink v-else class="profile-link" :to="{ name: 'user-profile', params: { userId: reply.user._id } }">{{ reply.user.name }}</RouterLink></strong>
                  <small>{{ formattedDate(reply.updatedAt) }}</small>
                </div>
                <p>{{ reply.comment }}</p>
                <div v-if="isMine(reply)" class="reply-actions"><button @click="startReplyEdit(review._id, reply)">Edit</button><button class="danger" @click="removeReply(review._id, reply._id)">Delete</button></div>
              </template>
            </div>
            <form v-if="user" class="reply-form" @submit.prevent="sendReply(review)"><input v-model="replyDrafts[review._id]" maxlength="1000" :aria-label="`Reply to ${review.user?.name || 'review'}`" placeholder="Add a helpful reply…" /><button type="submit" :disabled="!replyDrafts[review._id]?.trim()">Reply</button></form>
          </div>
        </article>
      </div>
    </template>
  </section>
  <ContributorLevelsDialog ref="levelsDialog" />
</template>

<style scoped>
.profile-link { color: #087a58; text-decoration: underline; text-underline-offset: .15em; }
.profile-link:hover { color: #055c42; }
.community-reviews { margin-top: 2rem; padding: 2rem; border: 2px solid #174f40; border-radius: 1.35rem; background: white; scroll-margin-top: 6rem; }.community-heading, .form-heading, .review-card header { display: flex; align-items: start; justify-content: space-between; gap: 1rem; }.community-heading h2 { margin: 0; font-size: 1.8rem; }.write-button, .submit-button { display: inline-flex; min-height: 2.9rem; align-items: center; padding: .65rem 1.1rem; border: 1px solid #07875f; border-radius: .7rem; color: #06271f; background: #2cd790; font-weight: 750; text-decoration: none; }
.rating-summary { display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; margin: 1.5rem 0; padding: 1.4rem; border-radius: 1rem; background: #edf8f3; }.overall-score { display: flex; align-items: center; flex-direction: column; justify-content: center; border-right: 1px solid #c8ded5; }.overall-score > strong { color: #087a58; font-size: 3.5rem; line-height: 1; }.overall-score > span { margin-top: .35rem; color: #60736b; font-size: .8rem; }.summary-details { min-width: 0; }.difficulty-consensus { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: .55rem; padding-bottom: .7rem; border-bottom: 1px solid #c8ded5; font-weight: 600; }.difficulty-consensus small { display: block; margin-top: .15rem; color: #60736b; font-size: .72rem; font-weight: 500; }.breakdown { margin: 0; }.breakdown div { display: flex; justify-content: space-between; padding: .3rem 0; }.breakdown dt { font-weight: 500; }.breakdown dd { margin: 0; font-weight: 750; }
.review-form { margin: 1.5rem 0; padding: 1.5rem; border: 1.5px solid #174f40; border-radius: 1rem; }.form-heading h3 { margin: 0; }.form-heading p { color: #60736b; }.text-button, .owner-actions button, .reply-actions button { border: 0; color: #087a58; background: transparent; font-weight: 700; }.rating-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: .9rem 1.5rem; margin: 1rem 0; }.rating-fields label { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }.required-rating { display: flex; min-height: 6.5rem; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.2rem 1.35rem; border: 2px solid #087a58; border-radius: .9rem; grid-column: 1 / -1; background: #e7f9f0; box-shadow: 0 5px 18px #087a5814; }.required-rating strong { display: block; color: #073f32; font-size: 1.3rem; }.required-rating strong span, .difficulty-field legend span { color: #c73737; }.required-rating small { display: block; margin-top: .25rem; color: #48675c; }.required-rating :deep(.star-input button) { font-size: 2.35rem; }.difficulty-field { margin: 1.25rem 0; padding: 0; border: 0; }.difficulty-field legend { margin: 0; color: #073f32; font-size: 1.1rem; font-weight: 750; }.difficulty-field > p { margin: .2rem 0 .8rem; color: #60736b; font-size: .85rem; }.difficulty-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; }.difficulty-options label { display: flex; align-items: flex-start; gap: .65rem; padding: .9rem; border: 1.5px solid #9cb5ab; border-radius: .8rem; cursor: pointer; transition: border-color .15s, background .15s, box-shadow .15s; }.difficulty-options label:hover, .difficulty-options label.selected { border-color: #087a58; background: #edf8f3; }.difficulty-options label.selected { box-shadow: 0 0 0 1px #087a58; }.difficulty-options input { margin-top: .2rem; accent-color: #087a58; }.difficulty-options strong, .difficulty-options small { display: block; }.difficulty-options small { margin-top: .2rem; color: #60736b; line-height: 1.35; }.comment-field { display: grid; gap: .4rem; }.comment-field textarea, .reply textarea, .reply-form input { width: 100%; padding: .75rem; border: 1.5px solid #9cb5ab; border-radius: .6rem; }.comment-field small { color: #6b7d75; text-align: right; }.submit-button { margin-top: 1rem; }.submit-button:disabled { opacity: .55; }
.review-list { display: grid; gap: 1rem; margin-top: 1.5rem; }.review-card { padding: 1.4rem; border: 1.5px solid #b8cec5; border-radius: 1rem; }.review-author-line { display: flex; align-items: center; gap: .65rem; margin-bottom: .15rem; }.review-card header h3 { margin: 0; font-size: 1rem; }.review-card header small { color: #6c7d76; }.difficulty-badge { display: inline-flex; align-items: center; width: fit-content; padding: .3rem .65rem; border-radius: 2rem; font-size: .75rem; font-weight: 800; white-space: nowrap; }.difficulty-beginner-friendly { color: #087a58; background: #dff7ec; }.difficulty-moderate { color: #805b00; background: #fff0bf; }.difficulty-challenging { color: #a02f2f; background: #fde2e2; }.review-card > .difficulty-badge { margin-top: 1rem; }.review-comment { margin: 1rem 0; font-size: 1.05rem; }.review-ratings { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0; }.review-ratings div { display: flex; gap: .35rem; padding: .3rem .55rem; border-radius: 2rem; background: #edf3f1; font-size: .75rem; }.review-ratings dt { font-weight: 500; }.review-ratings dd { margin: 0; font-weight: 750; }.danger { color: #b33131 !important; }
.contributor-badge { display: inline-flex; align-items: center; gap: .3rem; padding: .25rem .55rem; border: 1px solid transparent; border-radius: 2rem; font-size: .68rem; font-weight: 800; line-height: 1.15; white-space: nowrap; }.contributor-new-contributor { color: #52665d; border-color: #c8d8d1; background: #f1f5f3; }.contributor-helpful-contributor { color: #087a58; border-color: #a8dfc8; background: #e7f8f0; }.contributor-trusted-contributor { color: #655000; border-color: #e5cf79; background: #fff5c9; }.contributor-community-champion { color: #7c3f00; border-color: #efb56e; background: #fff0d8; }
.helpful-button { display: inline-flex; align-items: center; gap: .35rem; margin-top: .9rem; padding: .45rem .7rem; border: 1px solid #b8cec5; border-radius: 2rem; color: #52606d; background: white; font-size: .78rem; font-weight: 750; }.helpful-button:hover:not(:disabled), .helpful-button.active { border-color: #087a58; color: #087a58; background: #e7f8f0; }.helpful-button:disabled { cursor: not-allowed; opacity: .55; }.helpful-button strong { display: grid; min-width: 1.3rem; height: 1.3rem; padding: 0 .25rem; place-items: center; border-radius: 1rem; color: white; background: #087a58; font-size: .68rem; }
.contributor-badge { cursor: pointer; }
.contributor-badge:hover { box-shadow: 0 0 0 2px #087a5825; }
.review-author-line { flex-wrap: wrap; }
.review-form { scroll-margin-top: 6rem; }
/* Keep the line breaks people type in reviews and replies. */
.review-comment, .reply p { white-space: pre-wrap; overflow-wrap: anywhere; }
/* Your own name is plain text: your profile is already in the navbar. */
.own-name { color: #173e30; }
.own-name small { color: #6c7d76; font-weight: 500; }
.missing-hint { margin: .5rem 0 0; color: #a02f2f; font-size: .85rem; }
/* Date and Edit/Delete share one line, so your own reviews are no taller than others'. */
.review-side { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: .25rem .5rem; flex-shrink: 0; text-align: right; }
.review-side .owner-actions { display: flex; align-items: center; }
.review-time { color: #6c7d76; font-size: .8rem; white-space: nowrap; }
.review-side .owner-actions button { padding: 0 0 0 .6rem; }
.replies { margin-top: 1.25rem; padding: 1rem 0 0 1.25rem; border-left: 3px solid #d8eee5; }.replies h4 { font-size: .9rem; }.replies h4 span { color: #71817b; }.reply { position: relative; margin: .75rem 0; padding: .8rem; border-radius: .65rem; background: #f6faf8; }.reply > div:first-child { display: flex; justify-content: space-between; }.reply small { color: #71817b; }.reply p { margin: .4rem 0 0; }.reply-actions { display: flex; justify-content: end; gap: .5rem; }.reply-form { display: flex; gap: .5rem; margin-top: .75rem; }.reply-form button { padding: .5rem .9rem; border: 0; border-radius: .6rem; color: white; background: #087a58; font-weight: 700; }
.review-state, .notice { margin-top: 1.25rem; padding: 1.25rem; border-radius: .8rem; background: #f2f7f5; text-align: center; }.notice { text-align: left; }.success { color: #075d45; background: #e5f8ef; }.error { color: #9d2929; background: #fdeaea; }
@media (max-width: 700px) { .community-reviews { padding: 1.2rem; }.community-heading { flex-direction: column; }.rating-summary { grid-template-columns: 1fr; }.overall-score { padding-bottom: 1rem; border-right: 0; border-bottom: 1px solid #c8ded5; }.rating-fields, .difficulty-options { grid-template-columns: 1fr; }.required-rating { align-items: flex-start; flex-direction: column; grid-column: auto; }.rating-fields label { align-items: start; flex-direction: column; }.reply-form { flex-direction: column; } }
</style>
