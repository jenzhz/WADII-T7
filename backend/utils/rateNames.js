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

const GENERIC_SUFFIX = / (shopping (centre|center|mall)|mall|building|complex)$/
export function looseNames(name) {
  const short = normaliseName(name, { dropBrackets: true })
  const withoutSuffix = short.replace(GENERIC_SUFFIX, '').trim()
  return [...new Set([short, withoutSuffix])].filter(Boolean)
}
