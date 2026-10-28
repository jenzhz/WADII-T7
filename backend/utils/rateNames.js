// Normalises carpark names so the rates CSV can be matched to LTA "Development" names.
// e.g. "Copthorne King's Hotel" -> "copthorne kings hotel"
// With { dropBrackets: true }: "PoMo (Fomerly Paradiz Centre)" -> "pomo"
export function normaliseName(name, { dropBrackets = false } = {}) {
  let text = String(name || '').toLowerCase()
  if (dropBrackets) text = text.replace(/\(.*?(\)|$)/g, ' ') // also handles an unclosed "("
  return text
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Looser versions of a name used as a fallback, e.g.
// "Junction 8 Shopping Centre" -> ["junction 8 shopping centre", "junction 8"]
const GENERIC_SUFFIX = / (shopping (centre|center|mall)|mall|building|complex)$/
export function looseNames(name) {
  const short = normaliseName(name, { dropBrackets: true })
  const withoutSuffix = short.replace(GENERIC_SUFFIX, '').trim()
  return [...new Set([short, withoutSuffix])].filter(Boolean)
}
