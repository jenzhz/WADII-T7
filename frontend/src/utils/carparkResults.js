// Walking distances are in metres; times are in minutes. Unknown values stay null.
export function nonNegativeNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function normaliseCarparks(rows) {
  if (!Array.isArray(rows)) throw new Error('Expected a carparks array from the server.')
  const ids = new Set()
  return rows.map(row => {
    if (!row || row.id == null || !row.name || ids.has(String(row.id))) {
      throw new Error('Each carpark must have a unique id and a name.')
    }
    ids.add(String(row.id))
    return {
      ...row,
      id: String(row.id),
      availableLots: nonNegativeNumber(row.availableLots),
      distance: nonNegativeNumber(row.distance),
      walkingTime: nonNegativeNumber(row.walkingTime),
      walkingDistance: nonNegativeNumber(row.walkingDistance),
    }
  })
}

export function filterAndSortCarparks(carparks, { vehicleType, maxDistance, availableOnly, sortBy }) {
  const filtered = carparks.filter(carpark =>
    carpark.lotType === vehicleType &&
    (!maxDistance || (carpark.distance !== null && carpark.distance <= Number(maxDistance))) &&
    (!availableOnly || (carpark.availableLots !== null && carpark.availableLots > 0)),
  )
  // Unknown values appear last. Stable name ordering breaks ties.
  return filtered.sort((a, b) => {
    const field = sortBy === 'lots' ? 'availableLots' : 'distance'
    if (a[field] === null && b[field] !== null) return 1
    if (b[field] === null && a[field] !== null) return -1
    const difference = sortBy === 'lots' ? b[field] - a[field] : a[field] - b[field]
    return difference || a.name.localeCompare(b.name)
  })
}

export function formatDistance(value) {
  if (value === null) return 'Unavailable'
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`
}
