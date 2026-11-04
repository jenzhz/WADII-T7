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

// "7am – 6pm: $2.14 first hour" -> { time: '7am – 6pm', price: '$2.14 first hour' }
// so the time and the price can be shown in two columns. Lines without a short
// "time:" prefix (e.g. long mall text from the CSV) are shown as they are.
function splitLine(line) {
  const match = /^([^$:]{2,40}):\s*(.+)$/.exec(String(line))
  return match ? { time: match[1].trim(), price: match[2].trim() } : { time: null, price: line }
}

const sections = computed(() => {
  const schedule = props.rate?.schedule
  if (!schedule) return []
  // URA, or a mall without data: one box with a message
  if (schedule.message) return [{ label: null, lines: [schedule.message], isMessage: true }]
  // HDB: Monday to Saturday / Sunday
  const list = schedule.sections || [
    { label: 'Weekdays', lines: schedule.weekday },
    { label: 'Saturday', lines: schedule.saturday },
    { label: 'Sunday & PH', lines: schedule.sundayPublicHoliday },
  ]
  return list.map(section => ({ ...section, rows: (section.lines || []).map(splitLine) }))
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
      <template v-if="section.isMessage">
        <p v-for="(line, lineIndex) in section.lines" :key="lineIndex" class="rate-text text-secondary">{{ line }}</p>
      </template>
      <dl v-else-if="section.rows?.length" class="rate-rows">
        <div v-for="(row, rowIndex) in section.rows" :key="rowIndex" class="rate-row" :class="{ 'no-time': !row.time }">
          <dt v-if="row.time">{{ row.time }}</dt>
          <dd>{{ row.price }}</dd>
        </div>
      </dl>
      <p v-else class="rate-text text-secondary">Not listed</p>
    </div>
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
.rate-rows { display: grid; gap: .3rem; margin: 0; }
.rate-row { display: grid; grid-template-columns: minmax(5.5rem, max-content) 1fr; gap: .15rem .75rem; align-items: baseline; }
.rate-row.no-time { grid-template-columns: 1fr; }
.rate-row dt { color: #52665d; font-size: .8rem; font-weight: 650; white-space: nowrap; }
.rate-row dd { margin: 0; color: #10243a; font-size: .9rem; font-weight: 650; line-height: 1.4; }
.compact .rate-row { grid-template-columns: 1fr; gap: 0; }
.compact .rate-row dd { font-size: .82rem; }
.rate-now { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin: 0; font-size: .9rem; }
.rate-type { padding: .15rem .55rem; border-radius: 2rem; background: #e6f4f0; color: #0f5c4d; font-size: .75rem; font-weight: 700; }
.compact .rate-section { padding: .45rem .6rem; }
.compact .rate-text { font-size: .82rem; }
</style>
