import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { looseNames, normaliseName } from '../utils/rateNames.js'

const csvPath = fileURLToPath(new URL('../data/CarparkRates.csv', import.meta.url))
const jsonPath = fileURLToPath(new URL('../data/carparkRates.json', import.meta.url))

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1 }
      else if (char === '"') inQuotes = false
      else field += char
    } else if (char === '"') inQuotes = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field); rows.push(row); row = []; field = ''
    } else field += char
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(cell => cell.trim()))
}

function clean(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text === '' || text === '-' ? null : text
}

const isSameAsWeekdays = text => /^same as w(ee)?kdays?\.?$/i.test(text || '')
const isSameAsSaturday = text => /^same as sat(urday)?\.?$/i.test(text || '')

function buildSchedule(row) {
  const rate1 = clean(row.weekdays_rate_1)
  const rate2 = clean(row.weekdays_rate_2)

  const weekday = [rate1, rate2].filter(Boolean)
    .filter((text, index, list) => list.indexOf(text) === index && !isSameAsWeekdays(text))

  const saturdayRaw = clean(row.saturday_rate)
  const sundayRaw = clean(row.sunday_publicholiday_rate)
  const isDaily = /^daily/i.test(rate1 || '')

  let saturday
  if (isSameAsWeekdays(saturdayRaw)) saturday = weekday
  else if (saturdayRaw) saturday = [saturdayRaw]
  else saturday = isDaily ? weekday : []

  let sundayPublicHoliday
  if (isSameAsSaturday(sundayRaw)) sundayPublicHoliday = saturday
  else if (isSameAsWeekdays(sundayRaw)) sundayPublicHoliday = weekday
  else if (sundayRaw) sundayPublicHoliday = [sundayRaw]
  else sundayPublicHoliday = isDaily ? weekday : []

  return { weekday, saturday, sundayPublicHoliday }
}

const [header, ...lines] = parseCsv(readFileSync(csvPath, 'utf8').replace(/^﻿/, ''))
const columns = header.map(name => name.trim())
const carparks = {}
let duplicates = 0
const conflicts = []

for (const line of lines) {
  const row = Object.fromEntries(columns.map((name, index) => [name, line[index] ?? '']))
  const name = clean(row.carpark)
  if (!name) continue
  const key = normaliseName(name)
  const entry = { name, category: clean(row.category), ...buildSchedule(row) }

  // Some carparks are listed twice (e.g. under "Hotels" and an area category),
  // sometimes with different rates. Prefer the area category entry.
  if (carparks[key]) {
    duplicates += 1
    const existing = carparks[key]
    if (JSON.stringify({ ...existing, category: null }) !== JSON.stringify({ ...entry, category: null })) {
      conflicts.push(`${name} (${existing.category} vs ${entry.category})`)
    }
    if (existing.category === 'Hotels' && entry.category !== 'Hotels') carparks[key] = entry
    continue
  }
  carparks[key] = entry
}

// Only kept when exactly one carpark has that short name (avoids mixing up
// "Sentosa (Tanjong ...)" and "Sentosa (Siloso ...)").
const shortNames = {}
for (const [key, entry] of Object.entries(carparks)) {
  for (const shortKey of looseNames(entry.name)) {
    if (shortKey === key) continue
    shortNames[shortKey] = shortKey in shortNames && shortNames[shortKey] !== key ? null : key
  }
}
for (const [shortKey, key] of Object.entries(shortNames)) {
  if (key === null || carparks[shortKey]) delete shortNames[shortKey]
}

writeFileSync(jsonPath, JSON.stringify({
  source: 'LTA OneMotoring carpark rates (data.gov.sg)',
  generatedAt: new Date().toISOString(),
  carparks,
  shortNames,
}, null, 2) + '\n')

console.log(`Saved ${Object.keys(carparks).length} carparks to data/carparkRates.json (${duplicates} duplicate rows skipped).`)
if (conflicts.length) {
  console.log(`Different rates for the same carpark (kept the area category, not "Hotels"):`)
  for (const conflict of conflicts) console.log(`  - ${conflict}`)
}
