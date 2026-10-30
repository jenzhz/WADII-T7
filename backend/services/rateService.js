import { readFileSync } from 'node:fs'
import { looseNames, normaliseName } from '../utils/rateNames.js'
import { estimateMockUraCost, getMockUraRateInfo, isMockUraEnabled } from './mockUraRates.js'

// HDB short-term parking rules used to estimate charges.
// Source: https://www.hdb.gov.sg/parking/other-parking-matters/shortterm-parking/shortterm-parking-charges
// Car rates checked against the HDB page (Oct 2026):
//   Outside Central Area: $0.60 per half-hour
//   Within Central Area:  $1.20 per half-hour (7am-5pm, Mon-Sat), $0.60 other hours
// Still to verify: the Central Area carpark list below, motorcycle and heavy vehicle rates.
const CENTRAL_AREA = new Set([
  'ACB', 'BBB', 'BRB1', 'CY', 'DUXM', 'HLM', 'KAB', 'KAM',
  'KAS', 'PRM', 'SLS', 'SR1', 'SR2', 'TPM', 'UCS', 'WCB',
])

// Rates for non-HDB carparks (malls, commercial buildings), built from
// data/CarparkRates.csv by `npm run rates:build`.
const ratesFile = JSON.parse(readFileSync(new URL('../data/carparkRates.json', import.meta.url), 'utf8'))

// LTA name -> name used in the rates CSV, for carparks whose names differ.
// Run `npm run rates:check` to list carparks that still have no rates.
// Keys are written exactly as LTA DataMall spells them (they are normalised below).
const RATE_ALIASES = Object.fromEntries(Object.entries({
  // LTA carparks with short names or newer names
  'Bt Panjang Plaza': 'Bukit Panjang Plaza',
  'CQ @ Clarke Quay': 'Clarke Quay',
  'Centrepoint': 'The Centrepoint',
  'Cineleisure': 'Cathay Cineleisure Orchard',
  'Esplanade': 'The Esplanade',
  'Funan Mall': 'Funan DigitaLife Mall', // old name; Funan was rebuilt, rates may be outdated
  'Bugis+': 'Iluma', // Iluma was renamed Bugis+; rates may be outdated
  'Lot One': 'Lot 1 Shopping Centre',
  'Orchard Gateway': 'orchardgateway',
  'Orchard Point': 'OG Orchard Point',
  'Resorts World': 'Resorts World Sentosa',
  'Tang Plaza': 'Tangs',
  'The Atrium@Orchard': 'Atrium @ Orchard',
  'VivoCity P2': 'Vivocity',
  'VivoCity P3': 'Vivocity',
}).map(([ltaName, csvName]) => [normaliseName(ltaName), csvName]))

export function findRateSchedule(name) {
  const key = normaliseName(name)
  const aliasKey = RATE_ALIASES[key] ? normaliseName(RATE_ALIASES[key]) : null
  if (ratesFile.carparks[aliasKey]) return ratesFile.carparks[aliasKey]
  if (ratesFile.carparks[key]) return ratesFile.carparks[key]
  for (const looseKey of [key, ...looseNames(name)]) {
    const match = ratesFile.carparks[looseKey] || ratesFile.carparks[ratesFile.shortNames[looseKey]]
    if (match) return match
  }
  return null
}

const CAR_RATE = 0.6
const CENTRAL_PEAK_RATE = 1.2
const HEAVY_VEHICLE_RATE = 1.2
const MOTORCYCLE_PER_ENTRY = 0.65

export function isCentralArea(carparkId) {
  return CENTRAL_AREA.has(String(carparkId || '').toUpperCase())
}

// Car rate for one 30-minute block starting at `date`.
// Central Area: $1.20 Mon-Sat 7am-5pm, otherwise $0.60.
// Singapore is always UTC+8 (no daylight saving), so this works on any server timezone.
function singaporeTime(date) {
  const sg = new Date(date.getTime() + 8 * 60 * 60_000)
  return { day: sg.getUTCDay(), hour: sg.getUTCHours() } // day 0 = Sunday
}

function hdbCarRate(carparkId, date) {
  const { day, hour } = singaporeTime(date)
  const centralPeak = isCentralArea(carparkId) && day !== 0 && hour >= 7 && hour < 17
  return centralPeak ? CENTRAL_PEAK_RATE : CAR_RATE
}

// Current rate for display:
//   HDB -> HDB rules above
//   LTA -> CarparkRates.csv ("See rates"), or "Varies" when the CSV has no entry
//   URA -> dash, with "Rate information is currently not available." in the rates box
// rateType: "HDB (Within Central Area)", "HDB (Outside Central Area)", "LTA" or "URA";
// label: short text for cards; detail: longer text for compare/details pages;
// costLabel: what to show instead of an estimated cost when it cannot be calculated.
export function getRateInfo(carpark, date = new Date()) {
  if (carpark.agency === 'URA') {
    // Sample rates until the real URA API is connected (see mockUraRates.js)
    if (isMockUraEnabled()) return getMockUraRateInfo(carpark, date)
    return {
      per30Min: null,
      perEntry: null,
      rateType: 'URA',
      label: '—',
      detail: '—',
      costLabel: '—',
      isCentralArea: false,
      schedule: { message: 'Rate information is currently not available.' },
      source: null,
    }
  }
  if (carpark.agency !== 'HDB') {
    const schedule = findRateSchedule(carpark.name)
    return {
      per30Min: null,
      perEntry: null,
      rateType: 'LTA',
      label: schedule ? 'See rates' : 'Varies',
      detail: schedule ? 'See rates below' : 'Varies – check at carpark',
      costLabel: 'Varies',
      isCentralArea: false,
      schedule: schedule
        ? { weekday: schedule.weekday, saturday: schedule.saturday, sundayPublicHoliday: schedule.sundayPublicHoliday }
        : { message: 'Rates vary – please check the signs at the carpark.' },
      source: schedule ? ratesFile.source : null,
    }
  }
  return getHdbRateInfo(carpark, date)

}

// Estimated cost for parking `minutes` from `start`. Adds each 30-minute block
// separately so a stay that crosses 5pm uses the correct rate for each block.
// Returns null when the carpark is not HDB (rate unknown).
export function estimateCost(carpark, minutes, start = new Date()) {
  if (carpark.agency === 'URA' && isMockUraEnabled()) return estimateMockUraCost(carpark, minutes, start)
  if (carpark.agency !== 'HDB') return null
  if (carpark.lotType === 'Y') return MOTORCYCLE_PER_ENTRY
  const blocks = Math.ceil(minutes / 30)
  let total = 0
  for (let i = 0; i < blocks; i += 1) {
    const blockStart = new Date(start.getTime() + i * 30 * 60_000)
    total += carpark.lotType === 'H' ? HEAVY_VEHICLE_RATE : hdbCarRate(carpark.carparkId, blockStart)
  }
  return Math.round(total * 100) / 100
}

// HDB rate for "now" plus the full rate schedule shown on compare/details pages.
const HDB_SOURCE = 'HDB short-term parking charges'

// HDB schedule is shown as "Monday to Saturday" and "Sunday".
// Sunday is not in "7:00am to 5:00pm, Monday to Saturday", so it falls under
// "Other hours" in the HDB table. Public holidays are not mentioned, so not shown.
function hdbSchedule(carpark) {
  const half = value => `$${value.toFixed(2)} / 30 min`
  const sameEveryDay = lines => ({ sections: [
    { label: 'Monday to Saturday', lines },
    { label: 'Sunday', lines },
  ] })
  if (carpark.lotType === 'Y') {
    return sameEveryDay([`$${MOTORCYCLE_PER_ENTRY.toFixed(2)} / entry (whole day 7am-10.30pm, or whole night 10.30pm-7am)`])
  }
  if (carpark.lotType === 'H') return sameEveryDay([half(HEAVY_VEHICLE_RATE)])
  if (isCentralArea(carpark.carparkId)) {
    return { sections: [
      { label: 'Monday to Saturday', lines: [`7:00am to 5:00pm: ${half(CENTRAL_PEAK_RATE)}`, `Other hours: ${half(CAR_RATE)}`] },
      { label: 'Sunday', lines: [`All day: ${half(CAR_RATE)}`] },
    ] }
  }
  return sameEveryDay([half(CAR_RATE)])
}

function getHdbRateInfo(carpark, date) {
  const central = isCentralArea(carpark.carparkId)
  const base = {
    isCentralArea: central,
    rateType: central ? 'HDB (Within Central Area)' : 'HDB (Outside Central Area)',
    schedule: hdbSchedule(carpark),
    source: HDB_SOURCE,
  }
  if (carpark.lotType === 'Y') {
    const label = `$${MOTORCYCLE_PER_ENTRY.toFixed(2)} / entry`
    return { ...base, per30Min: null, perEntry: MOTORCYCLE_PER_ENTRY, label, detail: label }
  }
  const rate = carpark.lotType === 'H' ? HEAVY_VEHICLE_RATE : hdbCarRate(carpark.carparkId, date)
  const label = `$${rate.toFixed(2)} / 30 min`
  return { ...base, per30Min: rate, perEntry: null, label, detail: label }
}
