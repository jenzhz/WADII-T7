// Converts available-lot data to a comparable value in a future scoring formula.
export function normaliseAvailability(lots) {
  const cap = 50
  if (lots == null){
    return 0
  }
  const ratio = lots / cap
  return Math.min(ratio , 1)
}

// Converts walking time to a comparable value in a future scoring formula.
export function normaliseWalkingTime(minutes) {
  const cap =12
  if (minutes == null ){
    return 0
  }
  const ratio =  1 - (minutes / cap )
  return Math.max(ratio,0)
}
export function getWalkingMinutes(carpark) {
  if (carpark.walkingTime != null) {
    return carpark.walkingTime
  }
  if (carpark.distance != null) {
    return carpark.distance / 80
  }
  return null
}

// Will combine agreed weightages after the team defines the scoring formula.
export function calculateScore(carpark, weight) {
  const lotsScore = normaliseAvailability(carpark.availableLots)
  const walkScore = normaliseWalkingTime(getWalkingMinutes(carpark))
  return lotsScore * weight.lots + walkScore * weight.walk
}

// Will score and order carparks without mutating the original array.
export function rankCarparks(carparks, weight) {
  const availableLots = carparks
    .map(carpark => carpark.availableLots)
    .filter(value => value != null && Number.isFinite(Number(value)))
    .map(Number)
  const walkingMinutes = carparks
    .map(getWalkingMinutes)
    .filter(value => value != null && Number.isFinite(Number(value)))
    .map(Number)
  const maxLots = Math.max(0, ...availableLots)
  const minWalk = walkingMinutes.length ? Math.min(...walkingMinutes) : 0
  const maxWalk = walkingMinutes.length ? Math.max(...walkingMinutes) : 0

  const scored = carparks.map(carpark => {
    const lots = carpark.availableLots == null ? null : Number(carpark.availableLots)
    const walk = getWalkingMinutes(carpark)
    const lotsScore = lots == null || maxLots === 0 ? 0 : Math.max(0, lots) / maxLots
    const walkScore = walk == null
      ? 0
      : maxWalk === minWalk ? 1 : 1 - ((walk - minWalk) / (maxWalk - minWalk))
    return { ...carpark, score: lotsScore * weight.lots + walkScore * weight.walk }
  })

  const lotsValue = carpark => carpark.availableLots == null ? -1 : Number(carpark.availableLots)
  const walkValue = carpark => getWalkingMinutes(carpark) ?? Number.POSITIVE_INFINITY
  scored.sort((a, b) => {
    if (weight.mode === 'lots') {
      return lotsValue(b) - lotsValue(a) || walkValue(a) - walkValue(b) || a.name.localeCompare(b.name)
    }
    if (weight.mode === 'walk') {
      return walkValue(a) - walkValue(b) || lotsValue(b) - lotsValue(a) || a.name.localeCompare(b.name)
    }
    return b.score - a.score || walkValue(a) - walkValue(b) || lotsValue(b) - lotsValue(a) || a.name.localeCompare(b.name)
  })
  return scored.map((carpark, index) => ({ ...carpark, rank: index + 1 }))
}
