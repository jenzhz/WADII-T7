<script setup>
import { computed, onBeforeUnmount, ref, useId } from 'vue'

const dialog = ref(null)
const titleId = useId()
const memberName = ref('')
const isOwn = ref(false)
const helpfulVotes = ref(0)
let previousOverflow = ''

const levels = [
  { name: 'New Contributor', icon: '🌱', minimum: 0, votes: '0 helpful votes', points: '0 pts', colour: 'new' },
  { name: 'Helpful Contributor', icon: '👍', minimum: 1, votes: '1–4 helpful votes', points: '10–40 pts', colour: 'helpful' },
  { name: 'Trusted Contributor', icon: '◆', minimum: 5, votes: '5–9 helpful votes', points: '50–90 pts', colour: 'trusted' },
  { name: 'Community Champion', icon: '🏆', minimum: 10, votes: '10+ helpful votes', points: '100+ pts', colour: 'champion' },
]
const currentIndex = computed(() => levels.findLastIndex(level => helpfulVotes.value >= level.minimum))
const nextLevel = computed(() => levels[currentIndex.value + 1])
const progress = computed(() => {
  if (!nextLevel.value) return 100
  const minimum = levels[currentIndex.value].minimum
  return (helpfulVotes.value - minimum) / (nextLevel.value.minimum - minimum) * 100
})

function open(contributor, name, ownProfile = false) {
  if (!dialog.value || dialog.value.open) return
  memberName.value = name || 'This member'
  isOwn.value = ownProfile
  helpfulVotes.value = Math.max(0, Number(contributor?.helpedDrivers) || 0)
  previousOverflow = document.body.style.overflow
  dialog.value.showModal()
  document.body.style.overflow = 'hidden'
}

function restoreScroll() {
  document.body.style.overflow = previousOverflow
}

function closeOnBackdrop(event) {
  if (event.target !== dialog.value) return
  const bounds = dialog.value.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
    dialog.value.close()
  }
}

onBeforeUnmount(() => {
  if (dialog.value?.open) {
    dialog.value.close()
    restoreScroll()
  }
})

defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="levels-dialog" :aria-labelledby="titleId" @click="closeOnBackdrop" @keydown.esc.stop.prevent="dialog.close()" @close="restoreScroll">
      <header class="levels-header">
        <h2 :id="titleId">Contributor levels</h2>
        <button class="levels-close" type="button" aria-label="Close contributor levels" autofocus @click="dialog.close()">×</button>
      </header>
      <p class="levels-intro">Earn <strong>10 points</strong> each time another driver marks one of your reviews as helpful.</p>

      <section class="contribution-summary" aria-label="Current contribution">
        <div class="contribution-heading">
          <span>{{ isOwn ? 'Your contribution' : `${memberName}’s contribution` }}</span>
          <strong>{{ helpfulVotes * 10 }} pts</strong>
        </div>
        <p>{{ helpfulVotes }} {{ helpfulVotes === 1 ? 'helpful vote' : 'helpful votes' }} received</p>
        <template v-if="nextLevel">
          <progress :value="progress" max="100" :aria-label="`Progress towards ${nextLevel.name}`"></progress>
          <small>{{ nextLevel.minimum - helpfulVotes }} more {{ nextLevel.minimum - helpfulVotes === 1 ? 'helpful vote' : 'helpful votes' }} to reach {{ nextLevel.name }}.</small>
        </template>
        <small v-else>Highest contributor level reached.</small>
      </section>

      <ol class="levels-list" aria-label="Contributor level requirements">
        <li v-for="(level, index) in levels" :key="level.name" :class="{ 'current-level': index === currentIndex }">
          <span class="level-icon" :class="`level-${level.colour}`" aria-hidden="true">{{ level.icon }}</span>
          <div class="level-description">
            <strong>{{ level.name }}</strong>
            <span>{{ level.votes }} · {{ level.points }}</span>
          </div>
          <span v-if="index === currentIndex" class="current-label">Current level</span>
        </li>
      </ol>
      <p class="levels-note">Helpful votes across all reviews count towards the total. You cannot vote for your own review. Removing a helpful vote also removes its points.</p>
    </dialog>
  </Teleport>
</template>

<style scoped>
.levels-dialog { width: min(36rem, calc(100% - 2rem)); max-height: calc(100dvh - 2rem); margin: auto; padding: 1.5rem; overflow-y: auto; border: 2px solid #174f40; border-radius: 1.3rem; color: #17202a; background: white; box-shadow: 0 20px 60px #073f3230; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.levels-dialog[open] { animation: levels-appear 180ms ease; }
.levels-dialog::backdrop { background: #06271f88; backdrop-filter: blur(3px); }
.levels-header, .contribution-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.levels-header h2 { margin: 0; color: #073f32; font-size: 1.5rem; font-weight: 750; letter-spacing: -.03em; }
.levels-close { display: grid; width: 2rem; height: 2rem; flex-shrink: 0; padding: 0; place-items: center; border: 1px solid #c8d8d1; border-radius: 50%; color: #174f40; background: #f1f7f4; font-size: 1.5rem; line-height: 1; cursor: pointer; transition: background-color 150ms ease; }
.levels-close:hover { background: #dff7ec; }
.levels-close:focus-visible { outline: 2px solid #087a58; outline-offset: 3px; }
.levels-intro { margin: .8rem 0 1.1rem; color: #52665d; font-size: .9rem; line-height: 1.6; }
.levels-intro strong { color: #087a58; }
.contribution-summary { padding: 1rem; border: 1px solid #b8decc; border-radius: .9rem; background: #edf9f2; }
.contribution-heading { color: #174f40; font-size: .9rem; font-weight: 700; }
.contribution-heading strong { white-space: nowrap; font-size: 1.2rem; }
.contribution-summary p { margin: .3rem 0 .7rem; color: #52665d; font-size: .8rem; }
.contribution-summary progress { display: block; width: 100%; height: .45rem; margin-bottom: .55rem; overflow: hidden; border: 0; border-radius: 1rem; background: #d6e9de; accent-color: #087a58; }
.contribution-summary progress::-webkit-progress-bar { border-radius: 1rem; background: #d6e9de; }
.contribution-summary progress::-webkit-progress-value { border-radius: 1rem; background: #087a58; }
.contribution-summary progress::-moz-progress-bar { border-radius: 1rem; background: #087a58; }
.contribution-summary small { display: block; color: #087a58; font-size: .78rem; line-height: 1.5; }
.levels-list { display: grid; gap: .6rem; margin: 1.15rem 0; padding: 0; list-style: none; }
.levels-list li { display: flex; align-items: center; gap: .75rem; padding: .85rem; border: 1px solid #d6e5df; border-radius: .85rem; }
.levels-list .current-level { border-color: #087a58; background: #f4fcf7; }
.level-icon { display: grid; width: 2.4rem; height: 2.4rem; flex-shrink: 0; place-items: center; border-radius: .7rem; font-size: 1.15rem; }
.level-new { color: #52665d; background: #f1f5f3; }
.level-helpful { color: #087a58; background: #e7f8f0; }
.level-trusted { color: #655000; background: #fff5c9; }
.level-champion { color: #7c3f00; background: #fff0d8; }
.level-description { display: grid; gap: .2rem; min-width: 0; }
.level-description strong { font-size: .85rem; line-height: 1.35; }
.level-description > span { color: #63716a; font-size: .75rem; line-height: 1.5; }
.current-label { margin-left: auto; color: #087a58; font-size: .7rem; font-weight: 750; text-align: right; }
.levels-note { margin: 0; color: #63716a; font-size: .75rem; line-height: 1.6; }
@keyframes levels-appear { from { opacity: 0; translate: 0 4px; } to { opacity: 1; translate: 0 0; } }
@media (max-width: 420px) { .levels-dialog { padding: 1rem; }.levels-list li { flex-wrap: wrap; }.current-label { margin-left: 3.15rem; } }
@media (prefers-reduced-motion: reduce) { .levels-dialog[open] { animation: none; }.levels-close { transition: none; } }
</style>
