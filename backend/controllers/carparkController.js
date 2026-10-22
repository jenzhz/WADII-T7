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
  if (query[combinedKey]) {
    const [lat, lng] = String(query[combinedKey])
      .split(',')
      .map((val) => Number(val.trim()))
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng }
    }
  }

  for (let i = 0; i < latKeys.length; i += 1) {
    const rawLat = query[latKeys[i]]
    const rawLng = query[lngKeys[i]]
    if (rawLat !== undefined && rawLng !== undefined && rawLat !== '' && rawLng !== '') {
      const lat = Number(rawLat)
      const lng = Number(rawLng)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng }
      }
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
    const vehicleType = request.query.vehicleType || 'C'
    if (!['C', 'Y', 'H'].includes(vehicleType)) {
      throw Object.assign(new Error('vehicleType must be C, Y or H.'), { status: 400 })
    }
    response.json({ success: true, ...await findNearby({ latitude, longitude, radius, vehicleType }) })
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

    if (!queryDestination) {
      return response.status(400).json({
        success: false,
        message:
          'Destination coordinates are required (provide destLat & destLng, or latitude & longitude).',
      })
    }

    let carpark
    let routeMetrics

    if (queryOrigin) {
      ;[carpark, routeMetrics] = await Promise.all([
        getCarparkAvailabilityById(carparkId, lotType),
        getWalkingRoute(queryOrigin, queryDestination),
      ])
    } else {
      carpark = await getCarparkAvailabilityById(carparkId, lotType)

      if (!Number.isFinite(carpark.latitude) || !Number.isFinite(carpark.longitude)) {
        return response.status(400).json({
          success: false,
          message:
            'Origin coordinates were not provided and could not be determined from the carpark location.',
        })
      }

      routeMetrics = await getWalkingRoute(
        { lat: carpark.latitude, lng: carpark.longitude },
        queryDestination
      )
    }

    const resolvedOriginLat = carpark.latitude ?? queryOrigin?.lat ?? null
    const resolvedOriginLng = carpark.longitude ?? queryOrigin?.lng ?? null
    const straightLineDistance =
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
        fetchedAt: carpark.fetchedAt,
        source: carpark.source,
        coordinates: {
          latitude: resolvedOriginLat,
          longitude: resolvedOriginLng,
        },
        destination: {
          name: request.query.destinationName || request.query.destination || 'Selected Destination',
          latitude: queryDestination.lat,
          longitude: queryDestination.lng,
        },
        straightLineDistance,
        walkingDistance: routeMetrics.walkingDistance,
        walkingDistanceKm: routeMetrics.walkingDistanceKm,
        walkingTime: routeMetrics.walkingTime,
        totalTimeSeconds: routeMetrics.totalTimeSeconds,
        routeGeometry: routeMetrics.routeGeometry,
        routeInstructions: routeMetrics.routeInstructions,
      },
    })
  } catch (error) {
    return next(error)
  }
}

export const getCarparkById = getCarparkDetails
