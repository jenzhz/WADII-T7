import { getWalkingRoute as fetchWalkingRoute, searchLocation } from '../services/oneMapService.js'




export async function searchLocations(request, response) {
  if (typeof request.query.q !== 'string' || !request.query.q.trim()) {
    return response.status(400).json({ success: false, message: 'Enter a destination name or postal code.' })
  }
  const data = await searchLocation(request.query.q.trim())
  response.json(data)
}

const walkingCache = new Map()
const WALKING_CACHE_MS = 24 * 60 * 60 * 1000
const WALKING_CACHE_MAX = 2000

function coordinate(value, max) {
  if (typeof value !== 'string' || !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) && Math.abs(number) <= max ? number : null
}

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
