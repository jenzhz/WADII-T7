// Shows which LTA-agency carparks (malls, commercial buildings) have (or do not have) rates in the CSV.
// HDB uses rules and URA shows a dash, so they are not checked.
// Run from the backend folder (needs LTA_API_KEY in .env):  npm run rates:check
import 'dotenv/config'
import { getCarparkAvailability } from '../services/ltaService.js'
import { findRateSchedule } from '../services/rateService.js'

const { carparks } = await getCarparkAvailability()
const seen = new Map()
for (const carpark of carparks) {
  if (carpark.agency !== 'LTA' || seen.has(carpark.name)) continue
  seen.set(carpark.name, { agency: carpark.agency, matched: Boolean(findRateSchedule(carpark.name)) })
}

const matched = [...seen].filter(([, info]) => info.matched)
const unmatched = [...seen].filter(([, info]) => !info.matched)
console.log(`LTA carparks: ${seen.size}, with rates: ${matched.length}, without rates: ${unmatched.length}\n`)
console.log('Without rates (add to RATE_ALIASES in services/rateService.js if the CSV has them under another name):')
for (const [name, info] of unmatched.sort()) console.log(`  [${info.agency}] ${name}`)
