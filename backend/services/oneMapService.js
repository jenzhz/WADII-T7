/**
 * Service adapter for OneMap search, coordinates, and routing requests.
 * Docs: https://www.onemap.gov.sg/apidocs/
 */

import axios from 'axios'

const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search'
const ONEMAP_ROUTING_URL = 'https://www.onemap.gov.sg/api/public/routingsvc/route'
const ONEMAP_TOKEN_URL = 'https://www.onemap.gov.sg/api/auth/post/getToken'

function serviceError(message, status = 502) {
  return Object.assign(new Error(message), { status })
}

// ---------------------------------------------------------------------------
// OneMap tokens expire after 3 days. If ONEMAP_EMAIL and ONEMAP_PASSWORD are set
// in backend/.env, the backend gets a new token by itself before the old one
// expires. Otherwise it falls back to the fixed ONEMAP_TOKEN.
// ---------------------------------------------------------------------------
let cachedToken = null // { value, expiresAt }

function tokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    return payload.exp ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

async function requestNewToken() {
  let response
  try {
    response = await fetch(ONEMAP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: process.env.ONEMAP_EMAIL.trim(),
        password: process.env.ONEMAP_PASSWORD,
      }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw serviceError('OneMap could not be reached to renew the token. Please retry shortly.', 502)
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.access_token) {
    throw serviceError('OneMap rejected ONEMAP_EMAIL / ONEMAP_PASSWORD in backend/.env.', 503)
  }
  const expiresAt = Number(data.expiry_timestamp) * 1000 || tokenExpiry(data.access_token) || Date.now() + 3 * 24 * 3600_000
  cachedToken = { value: data.access_token, expiresAt }
  console.log(`OneMap token renewed (valid until ${new Date(expiresAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })})`)
  return cachedToken.value
}

// Returns a valid token, renewing it 10 minutes before it expires.
async function getOneMapToken({ forceRefresh = false } = {}) {
  const canRenew = process.env.ONEMAP_EMAIL?.trim() && process.env.ONEMAP_PASSWORD
  if (canRenew) {
    if (!forceRefresh && cachedToken && cachedToken.expiresAt - Date.now() > 10 * 60_000) {
      return cachedToken.value
    }
    return requestNewToken()
  }

  const token = process.env.ONEMAP_TOKEN?.trim()
  if (!token) {
    throw serviceError('Set ONEMAP_EMAIL and ONEMAP_PASSWORD (or ONEMAP_TOKEN) in backend/.env, then restart the backend.', 503)
  }
  const expiresAt = tokenExpiry(token)
  if (expiresAt && expiresAt < Date.now()) {
    throw serviceError('ONEMAP_TOKEN in backend/.env has expired. Add ONEMAP_EMAIL and ONEMAP_PASSWORD so the backend can renew it automatically.', 503)
  }
  return token
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
  const token = await getOneMapToken()
  const response = await axios.get(ONEMAP_SEARCH_URL, {
    params: {
      searchVal: destination,
      returnGeom: 'Y',
      getAddrDetails: 'Y',
      pageNum: 1,
    },
    headers: {
      Authorization: token,
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

  const params = new URLSearchParams({
    start: `${start.lat},${start.lng}`,
    end: `${end.lat},${end.lng}`,
    routeType: 'walk',
  })

  const callRouting = async (token) => {
    try {
      return await fetch(`${ONEMAP_ROUTING_URL}?${params.toString()}`, {
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
  }

  let response = await callRouting(await getOneMapToken())
  // Token rejected: renew once and retry (only possible with ONEMAP_EMAIL / ONEMAP_PASSWORD)
  if ([401, 403].includes(response.status) && process.env.ONEMAP_EMAIL?.trim() && process.env.ONEMAP_PASSWORD) {
    response = await callRouting(await getOneMapToken({ forceRefresh: true }))
  }

  if (!response.ok) {
    if ([401, 403].includes(response.status)) {
      throw serviceError(
        'OneMap rejected the authorization token. Check ONEMAP_EMAIL / ONEMAP_PASSWORD (or ONEMAP_TOKEN) in backend/.env.',
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
