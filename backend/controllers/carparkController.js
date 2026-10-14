import { getCarparkAvailability, getNearbyCarparks as findNearby } from '../services/ltaService.js'

function numericQuery(value, name, minimum, maximum, fallback) {
  if (value === undefined && fallback !== undefined) return fallback
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Number(value)) ||
      Number(value) < minimum || Number(value) > maximum) {
    throw Object.assign(new Error(`${name} must be a number from ${minimum} to ${maximum}.`), { status: 400 })
  }
  return Number(value)
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

// This route remains with the details-page owner.
export function getCarparkById(request, response) {
  response.status(501).json({ success: false, message: 'Carpark details are not implemented yet.', carparkId: request.params.id })
}
