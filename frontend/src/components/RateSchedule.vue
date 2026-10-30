<script setup>
// Shows parking rates as text for Weekdays, Saturday and Sunday & PH.
// HDB: built from HDB rules. Malls: published rates from data/CarparkRates.csv.
import { computed } from 'vue'

const props = defineProps({
  rate: { type: Object, default: null },
  compact: { type: Boolean, default: false },
  // Compare page already shows "Rate type" and "Rate now", so it hides this line
  showNow: { type: Boolean, default: true },
})

const sections = computed(() => {
  const schedule = props.rate?.schedule
  if (!schedule) return []
  // URA, or a mall without data: one box with a message
  if (schedule.message) return [{ label: null, lines: [schedule.message], isMessage: true }]
  // HDB: Monday to Saturday / Sunday
  if (schedule.sections) return schedule.sections
  return [
    { label: 'Weekdays', lines: schedule.weekday },
    { label: 'Saturday', lines: schedule.saturday },
    { label: 'Sunday & PH', lines: schedule.sundayPublicHoliday },
  ]
})
</script>

<template>
  <div v-if="sections.length" class="rate-schedule" :class="{ compact }">
    <p v-if="showNow" class="rate-now">
      <span class="rate-type">Rate type: {{ rate.rateType }}</span>
      <span v-if="rate.per30Min != null || rate.perEntry != null">Now: <strong>{{ rate.label }}</strong></span>
    </p>
    <div v-for="(section, index) in sections" :key="index" class="rate-section">
      <h3 v-if="section.label" class="rate-day">{{ section.label }}</h3>
      <template v-if="section.lines?.length">
        <p v-for="(line, lineIndex) in section.lines" :key="lineIndex" class="rate-text" :class="{ 'text-secondary': section.isMessage }">{{ line }}</p>
      </template>
      <p v-else class="rate-text text-secondary">Not listed</p>
    </div>
    <p v-if="rate.source" class="rate-source">Source: {{ rate.source }}. Rates may have changed; check signs at the carpark.</p>
  </div>
  <div v-else-if="rate?.label" class="rate-schedule">
    <p v-if="showNow && rate.rateType" class="rate-now">
      <span class="rate-type">Rate type: {{ rate.rateType }}</span>
    </p>
    <p class="rate-text mb-0">{{ rate.detail ?? rate.label }}</p>
  </div>
</template>

<style scoped>
.rate-schedule { display: grid; gap: .75rem; }
.rate-section { padding: .6rem .75rem; border-radius: .6rem; background: #f3f8f6; }
.rate-day { margin: 0 0 .25rem; color: #0f5c4d; font-size: .78rem; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; }
.rate-text { margin: 0; font-size: .9rem; line-height: 1.45; }
.rate-text + .rate-text { margin-top: .2rem; }
.rate-now { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin: 0; font-size: .9rem; }
.rate-type { padding: .15rem .55rem; border-radius: 2rem; background: #e6f4f0; color: #0f5c4d; font-size: .75rem; font-weight: 700; }
.rate-source { margin: 0; color: #63716a; font-size: .75rem; }
.compact .rate-section { padding: .45rem .6rem; }
.compact .rate-text { font-size: .82rem; }
</style>
