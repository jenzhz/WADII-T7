/**
 * Service adapter for OneMap search, coordinates, and routing requests.
 * Docs: https://www.onemap.gov.sg/apidocs/
 */

import axios from 'axios'

const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search'
const ONEMAP_ROUTING_URL = 'https://www.onemap.gov.sg/api/public/routingsvc/route'

function serviceError(message, status = 502) {
  return Object.assign(new Error(message), { status })
}

/**
 * Helper to normalize coordinate input into { lat, lng } numbers.
 * Accepts { lat, lng }, { latitude, longitude }, or a "lat,lng" string.
 */
function parseCoordinates(coord, label) {
  if (!coord) {
    throw serviceError(`${label} coordinates are required.`, 400)
  }

  let lat
  let lng

  if (typeof coord === 'string') {
    const parts = coord.split(',').map((part) => Number(part.trim()))
    ;[lat, lng] = parts
  } else if (typeof coord === 'object') {
    lat = Number(coord.lat ?? coord.latitude)
    lng = Number(coord.lng ?? coord.longitude)
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw serviceError(`Invalid ${label} coordinates. Expected valid latitude and longitude.`, 400)
  }

  return { lat, lng }
}

export async function searchLocation(destination) {
  const response = await axios.get(ONEMAP_SEARCH_URL, {
    params: {
      searchVal: destination,
      returnGeom: 'Y',
      getAddrDetails: 'Y',
      pageNum: 1,
    },
    headers: {
      Authorization: process.env.ONEMAP_TOKEN,
    },
  })
  return response.data
}

/**
 * Calls the OneMap Routing API to calculate walking distance (metres) and
 * estimated walk time (minutes) between origin and destination coordinates.
 *
 * @param {Object|string} origin - Origin coordinates ({ lat, lng } or "lat,lng")
 * @param {Object|string} destination - Destination coordinates ({ lat, lng } or "lat,lng")
 */
export async function getWalkingRoute(origin, destination) {
  const start = parseCoordinates(origin, 'Origin')
  const end = parseCoordinates(destination, 'Destination')

  const token = process.env.ONEMAP_TOKEN?.trim()
  if (!token) {
    throw serviceError('Set ONEMAP_TOKEN in backend/.env, then restart the backend.', 503)
  }

  const params = new URLSearchParams({
    start: `${start.lat},${start.lng}`,
    end: `${end.lat},${end.lng}`,
    routeType: 'walk',
  })

  let response
  try {
    response = await fetch(`${ONEMAP_ROUTING_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: token,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw serviceError('OneMap Routing service could not be reached. Please retry shortly.', 502)
  }

  if (!response.ok) {
    if ([401, 403].includes(response.status)) {
      throw serviceError(
        'OneMap rejected the authorization token. Check ONEMAP_TOKEN in backend/.env.',
        503
      )
    }
    throw serviceError(
      `OneMap Routing API error (${response.status}): ${response.statusText}`,
      response.status
    )
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw serviceError('OneMap returned an invalid JSON response.', 502)
  }

  if (!data || !data.route_summary) {
    throw serviceError(
      data?.status_message || 'Unable to calculate walking route from OneMap response.',
      502
    )
  }

  const totalDistanceMeters = Number(data.route_summary.total_distance) || 0
  const totalTimeSeconds = Number(data.route_summary.total_time) || 0
  const walkingTimeMinutes = totalTimeSeconds > 0 ? Math.ceil(totalTimeSeconds / 60) : 0

  return {
    walkingDistance: Math.round(totalDistanceMeters),
    walkingDistanceKm: Number((totalDistanceMeters / 1000).toFixed(2)),
    walkingTime: walkingTimeMinutes,
    totalTimeSeconds,
    routeGeometry: data.route_geometry || null,
    routeInstructions: Array.isArray(data.route_instructions) ? data.route_instructions : [],
  }
}
