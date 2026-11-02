// SAMPLE (MOCK) URA carpark rates — NOT official URA data.
// Simple rates for every URA carpark, deliberately different from HDB
// ($0.60 / $1.20), so URA and HDB carparks rank differently on the Compare page.
// Replace with the real URA Data Service API (Car Park List and Rates) later.
// Turned on with USE_MOCK_URA_RATES=true in backend/.env.

export const MOCK_URA_SOURCE = 'Sample data – not official URA rates'
const MOCK_URA_WEEKDAY_RATE = 0.8 // dollars per 30 minutes, Monday to Saturday
const MOCK_URA_SUNDAY_RATE = 0.5 // dollars per 30 minutes, Sunday

export function isMockUraEnabled() {
  return process.env.USE_MOCK_URA_RATES === 'true'
}

// Singapore is always UTC+8, so this works on any server timezone
function isSunday(date) {
  return new Date(date.getTime() + 8 * 60 * 60_000).getUTCDay() === 0
}

function rateAt(date) {
  return isSunday(date) ? MOCK_URA_SUNDAY_RATE : MOCK_URA_WEEKDAY_RATE
}

const half = value => `$${value.toFixed(2)} / 30 min`

export function getMockUraRateInfo(carpark, date = new Date()) {
  const rate = rateAt(date)
  return {
    per30Min: rate,
    perEntry: null,
    rateType: 'URA (sample data)',
    label: half(rate),
    detail: `${half(rate)} (sample)`,
    costLabel: null,
    isCentralArea: false,
    schedule: {
      sections: [
        { label: 'Monday to Saturday', lines: [half(MOCK_URA_WEEKDAY_RATE)] },
        { label: 'Sunday', lines: [half(MOCK_URA_SUNDAY_RATE)] },
      ],
    },
    source: MOCK_URA_SOURCE,
    isSample: true,
  }
}

// Adds each 30-minute block, so a stay that crosses midnight into Sunday is correct
export function estimateMockUraCost(carpark, minutes, start = new Date()) {
  let total = 0
  for (let i = 0; i < Math.ceil(minutes / 30); i += 1) {
    total += rateAt(new Date(start.getTime() + i * 30 * 60_000))
  }
  return Math.round(total * 100) / 100
}
