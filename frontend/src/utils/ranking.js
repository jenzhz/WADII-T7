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
  const  scored = carparks.map(carpark => ({
    ...carpark,
    score: calculateScore(carpark, weight)
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.map((carpark, index) => ({ ...carpark, rank: index + 1 }))
}