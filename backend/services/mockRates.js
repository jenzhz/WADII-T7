// SAMPLE (MOCK) parking rates for ALL carpark types — NOT official data.
// Turn on with USE_MOCK_RATES=true in backend/.env (real HDB rules and mall CSV are used otherwise).

export const MOCK_SOURCE = 'Sample data – not official rates'

const MOCK_PLANS = {
  HDB: { label: 'HDB carpark', weekday: 0.6, weekend: 0.4 },
  URA: { label: 'Public carpark', weekday: 0.8, weekend: 0.5 },
}

const MALL_TIERS = [
  { firstHour: 1.07, extra30: 0.55, evening: 2.14 },
  { firstHour: 1.2, extra30: 0.6, evening: 2.5 },
  { firstHour: 1.5, extra30: 0.75, evening: 3.0 },
  { firstHour: 2.14, extra30: 1.07, evening: 3.5 },
  { firstHour: 2.5, extra30: 1.2, evening: 4.0 },
  { firstHour: 3.0, extra30: 1.5, evening: 5.0 },
]
const MALL_DAY_START = 7
const MALL_DAY_END = 18
const WEEKEND_EXTRA = 0.2

function mallPlan(carpark) {
  let hash = 0
  for (const char of String(carpark.name || carpark.carparkId || '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return MALL_TIERS[hash % MALL_TIERS.length]
}

function mallPrices(plan, weekend) {
  const extra = weekend ? WEEKEND_EXTRA : 0
  return {
    firstHour: Math.round((plan.firstHour + extra) * 100) / 100,
    extra30: Math.round((plan.extra30 + extra / 2) * 100) / 100,
    evening: Math.round((plan.evening + (weekend ? 0.5 : 0)) * 100) / 100,
  }
}

const money = value => `$${value.toFixed(2)}`
const formatHour = hour => `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`

export function isMockRatesEnabled() {
  return process.env.USE_MOCK_RATES === 'true'
}

function singaporeTime(date) {
  const sg = new Date(date.getTime() + 8 * 60 * 60_000)
  return { day: sg.getUTCDay(), hour: sg.getUTCHours() }
}
function isWeekend(date) {
  const { day } = singaporeTime(date)
  return day === 0 || day === 6
}
function isMallDaytime(date) {
  const { hour } = singaporeTime(date)
  return hour >= MALL_DAY_START && hour < MALL_DAY_END
}

function planFor(carpark) {
  return MOCK_PLANS[carpark.agency] || MOCK_PLANS.HDB
}

function mallScheduleLines(prices) {
  return [
    `${formatHour(MALL_DAY_START)} – ${formatHour(MALL_DAY_END)}: ${money(prices.firstHour)} first hour, then ${money(prices.extra30)} / 30 min`,
    `After ${formatHour(MALL_DAY_END)}: ${money(prices.evening)} per entry`,
  ]
}

function getMockMallRateInfo(carpark, date) {
  const plan = mallPlan(carpark)
  const now = mallPrices(plan, isWeekend(date))
  const label = isMallDaytime(date) ? `${money(now.firstHour)} 1st hr` : `${money(now.evening)} / entry`
  return {
    per30Min: null,
    perEntry: null,
    rateType: 'Mall (sample data)',
    label,
    detail: label,
    costLabel: null,
    isCentralArea: false,
    schedule: {
      sections: [
        { label: 'Monday to Friday', lines: mallScheduleLines(mallPrices(plan, false)) },
        { label: 'Saturday & Sunday', lines: mallScheduleLines(mallPrices(plan, true)) },
      ],
    },
    source: MOCK_SOURCE,
    isSample: true,
  }
}

function estimateMockMallCost(carpark, minutes, start) {
  const plan = mallPlan(carpark)
  let total = 0
  let daytimeBlocks = 0
  for (let i = 0; i < Math.ceil(minutes / 30); i += 1) {
    const blockStart = new Date(start.getTime() + i * 30 * 60_000)
    const prices = mallPrices(plan, isWeekend(blockStart))
    if (!isMallDaytime(blockStart)) {
      total += prices.evening
      break
    }
    if (daytimeBlocks === 0) total += prices.firstHour
    else if (daytimeBlocks >= 2) total += prices.extra30
    daytimeBlocks += 1
  }
  return Math.round(total * 100) / 100
}

const half = value => `$${value.toFixed(2)} / 30 min`

export function getMockRateInfo(carpark, date = new Date()) {
  if (carpark.agency === 'LTA') return getMockMallRateInfo(carpark, date)
  const plan = planFor(carpark)
  const rate = isWeekend(date) ? plan.weekend : plan.weekday
  return {
    per30Min: rate,
    perEntry: null,
    rateType: `${plan.label} (sample data)`,
    label: half(rate),
    detail: half(rate),
    costLabel: null,
    isCentralArea: false,
    schedule: {
      sections: [
        { label: 'Monday to Friday', lines: [half(plan.weekday)] },
        { label: 'Saturday & Sunday', lines: [half(plan.weekend)] },
      ],
    },
    source: MOCK_SOURCE,
    isSample: true,
  }
}

export function estimateMockCost(carpark, minutes, start = new Date()) {
  if (carpark.agency === 'LTA') return estimateMockMallCost(carpark, minutes, start)
  const plan = planFor(carpark)
  let total = 0
  for (let i = 0; i < Math.ceil(minutes / 30); i += 1) {
    total += isWeekend(new Date(start.getTime() + i * 30 * 60_000)) ? plan.weekend : plan.weekday
  }
  return Math.round(total * 100) / 100
}
