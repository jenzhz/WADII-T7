import {
  distanceInMetres,
  getCarparkAvailability,
  getCarparkAvailabilityById,
  getNearbyCarparks as findNearby,
} from '../services/ltaService.js'
import { getWalkingRoute } from '../services/oneMapService.js'

function numericQuery(value, name, minimum, maximum, fallback) {
  if (value === undefined && fallback !== undefined) return fallback
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Number(value)) ||
      Number(value) < minimum || Number(value) > maximum) {
    throw Object.assign(new Error(`${name} must be a number from ${minimum} to ${maximum}.`), { status: 400 })
  }
  return Number(value)
}

/**
 * Extracts a coordinate pair from request query parameters.
 */
function extractCoordsFromQuery(query, combinedKey, latKeys, lngKeys) {
  if (query[combinedKey] !== undefined) {
    const parts = typeof query[combinedKey] === 'string' ? query[combinedKey].split(',') : []
    if (parts.length !== 2) throw Object.assign(new Error(`${combinedKey} must contain latitude,longitude.`), { status: 400 })
    return { lat: numericQuery(parts[0], combinedKey, -90, 90), lng: numericQuery(parts[1], combinedKey, -180, 180) }
  }

  for (let i = 0; i < latKeys.length; i += 1) {
    const rawLat = query[latKeys[i]]
    const rawLng = query[lngKeys[i]]
    if (rawLat !== undefined || rawLng !== undefined) {
      return { lat: numericQuery(rawLat, latKeys[i], -90, 90), lng: numericQuery(rawLng, lngKeys[i], -180, 180) }
    }
  }

  return null
}

export async function getCarparks(_request, response, next) {
  try { response.json({ success: true, ...await getCarparkAvailability() }) } catch (error) { next(error) }
}

export async function getNearbyCarparks(request, response, next) {
  try {
    const latitude = numericQuery(request.query.latitude, 'latitude', -90, 90)
    const longitude = numericQuery(request.query.longitude, 'longitude', -180, 180)
    const radius = numericQuery(request.query.radius, 'radius (metres)', 100, 5000, 1000)
    const duration = numericQuery(request.query.duration, 'duration (minutes)', 30, 1440, 120)
    const vehicleType = request.query.vehicleType || 'C'
    if (!['C', 'Y', 'H'].includes(vehicleType)) {
      throw Object.assign(new Error('vehicleType must be C, Y or H.'), { status: 400 })
    }
    response.json({ success: true, ...await findNearby({ latitude, longitude, radius, vehicleType, duration }) })
  } catch (error) { next(error) }
}

/**
 * Controller that combines LTA DataMall real-time available lots and OneMap walking route metrics
 * for a single carpark.
 *
 * Mapped to:
 *   GET /api/carpark-details
 *   GET /api/carpark-details/:id
 *   GET /api/carparks/:id
 */
export async function getCarparkDetails(request, response, next) {
  try {
    const carparkId = request.params.id || request.query.carparkId || request.query.id
    const lotType = request.query.lotType || request.query.vehicleType || 'C'
    if (!['C', 'Y', 'H'].includes(lotType)) {
      throw Object.assign(new Error('lotType must be C, Y or H.'), { status: 400 })
    }

    if (!carparkId) {
      return response.status(400).json({
        success: false,
        message: 'carparkId is required (via route param /:id or query param ?carparkId=).',
      })
    }

    const queryOrigin = extractCoordsFromQuery(
      request.query,
      'origin',
      ['originLat', 'startLat', 'carparkLat'],
      ['originLng', 'startLng', 'carparkLng']
    )

    const queryDestination = extractCoordsFromQuery(
      request.query,
      'destinationCoords',
      ['destLat', 'endLat', 'destinationLat', 'latitude'],
      ['destLng', 'endLng', 'destinationLng', 'longitude']
    )

    const carpark = await getCarparkAvailabilityById(carparkId, lotType)
    let routeMetrics = null
    let routeError = null

    if (queryDestination) {
      const origin = queryOrigin || { lat: carpark.latitude, lng: carpark.longitude }
      if (Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
        try {
          routeMetrics = await getWalkingRoute(origin, queryDestination)
        } catch {
          // A routing outage must not hide valid availability and parking rates.
          routeError = 'Walking route is currently unavailable. Refresh live data to try again.'
        }
      } else {
        routeError = 'Walking route is unavailable because this carpark has no location coordinates.'
      }
    }

    const resolvedOriginLat = carpark.latitude ?? queryOrigin?.lat ?? null
    const resolvedOriginLng = carpark.longitude ?? queryOrigin?.lng ?? null
    const straightLineDistance = queryDestination &&
      Number.isFinite(resolvedOriginLat) && Number.isFinite(resolvedOriginLng)
        ? Math.round(
            distanceInMetres(
              resolvedOriginLat,
              resolvedOriginLng,
              queryDestination.lat,
              queryDestination.lng
            )
          )
        : null

    return response.status(200).json({
      success: true,
      data: {
        id: carpark.id,
        carparkId: carpark.carparkId,
        carparkName: carpark.name,
        name: carpark.name,
        development: carpark.development,
        area: carpark.area,
        availableLots: carpark.availableLots,
        lotType: carpark.lotType,
        agency: carpark.agency,
        hasEvCharger: Boolean(carpark.hasEvCharger),
        evAvailableLots: carpark.evAvailableLots ?? 0,
        rate: carpark.rate,
        fetchedAt: carpark.fetchedAt,
        source: carpark.source,
        coordinates: {
          latitude: resolvedOriginLat,
          longitude: resolvedOriginLng,
        },
        destination: queryDestination ? {
          name: request.query.destinationName || request.query.destination || 'Selected Destination',
          latitude: queryDestination.lat,
          longitude: queryDestination.lng,
        } : null,
        straightLineDistance,
        routeError,
        walkingDistance: routeMetrics?.walkingDistance ?? null,
        walkingDistanceKm: routeMetrics?.walkingDistanceKm ?? null,
        walkingTime: routeMetrics?.walkingTime ?? null,
        totalTimeSeconds: routeMetrics?.totalTimeSeconds ?? null,
        routeGeometry: routeMetrics?.routeGeometry ?? null,
        routeInstructions: routeMetrics?.routeInstructions ?? [],
      },
    })
  } catch (error) {
    return next(error)
  }
}

export const getCarparkById = getCarparkDetails
