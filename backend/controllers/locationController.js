// Location actions: OneMap destination search and walking routes.
import { getWalkingRoute as fetchWalkingRoute, searchLocation } from '../services/oneMapService.js'




export async function searchLocations(request, response) {
  const data = await searchLocation(request.query.q)
  response.json(data)
}

// Walking routes rarely change, so results are kept in memory for a day.
// This keeps the Results page fast and avoids repeated OneMap calls.
const walkingCache = new Map() // key -> { value, expiresAt }
const WALKING_CACHE_MS = 24 * 60 * 60 * 1000
const WALKING_CACHE_MAX = 2000

function coordinate(value, max) {
  const number = Number(value)
  return Number.isFinite(number) && Math.abs(number) <= max ? number : null
}

// GET /api/locations/walking-route?originLat=&originLng=&destLat=&destLng=
// Returns only the summary the Results page needs: walking distance (m) and time (min).
export async function getWalkingRoute(request, response, next) {
  try {
    const originLat = coordinate(request.query.originLat, 90)
    const originLng = coordinate(request.query.originLng, 180)
    const destLat = coordinate(request.query.destLat, 90)
    const destLng = coordinate(request.query.destLng, 180)
    if ([originLat, originLng, destLat, destLng].includes(null)) {
      return response.status(400).json({ success: false, message: 'originLat, originLng, destLat and destLng are required.' })
    }

    const key = [originLat, originLng, destLat, destLng].map(value => value.toFixed(5)).join(',')
    const cached = walkingCache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return response.json({ success: true, ...cached.value, cached: true })
    }

    const route = await fetchWalkingRoute({ lat: originLat, lng: originLng }, { lat: destLat, lng: destLng })
    const value = { walkingDistance: route.walkingDistance, walkingTime: route.walkingTime }

    if (walkingCache.size >= WALKING_CACHE_MAX) walkingCache.delete(walkingCache.keys().next().value)
    walkingCache.set(key, { value, expiresAt: Date.now() + WALKING_CACHE_MS })
    return response.json({ success: true, ...value, cached: false })
  } catch (error) {
    return next(error)
  }
}
