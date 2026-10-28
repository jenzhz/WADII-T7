import { estimateCost, getRateInfo } from './rateService.js'

const ENDPOINT = 'https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2'
let cached = null
let pending = null

function serviceError(message, status = 502) {
  return Object.assign(new Error(message), { status })
}

export function distanceInMetres(lat1, lng1, lat2, lng2) {
  const radians = degrees => degrees * Math.PI / 180
  const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lng2 - lng1) / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
}

export function mapCarpark(row) {
  const coordinates = String(row.Location || '').trim().split(/\s+/).map(Number)
  const validLocation = coordinates.length === 2 && coordinates.every(Number.isFinite) &&
    Math.abs(coordinates[0]) <= 90 && Math.abs(coordinates[1]) <= 180
  const lots = row.AvailableLots === '' || row.AvailableLots == null ? NaN : Number(row.AvailableLots)
  return {
    // Keep the official ID separately; keys also distinguish agency and lot type.
    id: `${row.Agency}:${row.CarParkID}:${row.LotType}`,
    carparkId: String(row.CarParkID),
    name: row.Development || `Carpark ${row.CarParkID}`,
    development: row.Development || '',
    area: row.Area || '',
    latitude: validLocation ? coordinates[0] : null,
    longitude: validLocation ? coordinates[1] : null,
    availableLots: Number.isInteger(lots) && lots >= 0 ? lots : null,
    lotType: row.LotType,
    agency: row.Agency,
    walkingDistance: null,
    walkingTime: null,
  }
}

// Fetch every page, not only the first 500 records. One shared fetch per minute.
export async function getCarparkAvailability(carparkId, lotType = 'C') {
  if (!process.env.LTA_API_KEY?.trim()) {
    throw serviceError('Set LTA_API_KEY in backend/.env, then restart the backend.', 503)
  }

  let allData
  if (cached && Date.now() - cached.time < 60_000) {
    allData = cached.data
  } else {
    if (!pending) {
      pending = (async () => {
        const rows = []
        const signal = AbortSignal.timeout(25_000)
        for (let skip = 0; skip < 50_000; skip += 500) {
          let response
          try {
            response = await fetch(`${ENDPOINT}?$skip=${skip}`, {
              headers: { AccountKey: process.env.LTA_API_KEY.trim(), Accept: 'application/json' }, signal,
            })
          } catch {
            throw serviceError('LTA DataMall could not be reached. Please retry shortly.')
          }
          if (!response.ok) {
            if ([401, 403].includes(response.status)) throw serviceError('LTA rejected the account key. Check LTA_API_KEY in backend/.env.', 503)
            throw serviceError('LTA DataMall is temporarily unavailable. Please retry shortly.')
          }
          let data
          try { data = await response.json() } catch { throw serviceError('LTA returned an invalid response.') }
          if (!Array.isArray(data.value)) throw serviceError('LTA returned an unexpected response format.')
          rows.push(...data.value)
          if (data.value.length < 500) {
            const unique = new Map(rows.filter(row => row?.CarParkID != null && ['C', 'Y', 'H'].includes(row.LotType))
              .map(mapCarpark).map(row => [row.id, row]))
            const result = { carparks: [...unique.values()], fetchedAt: new Date().toISOString(), source: 'LTA DataMall' }
            cached = { data: result, time: Date.now() }
            return result
          }
        }
        throw serviceError('LTA pagination exceeded the safe limit; no partial results were returned.')
      })()
    }
    try {
      allData = await pending
    } finally {
      pending = null
    }
  }

  // If a specific carparkId is requested, find and return that specific carpark's availability
  if (carparkId !== undefined && carparkId !== null && String(carparkId).trim() !== '') {
    return getCarparkAvailabilityById(carparkId, lotType, allData)
  }

  return allData
}

/**
 * Retrieves real-time available lots and metadata for a specific Carpark ID from LTA DataMall.
 * Supports both raw CarParkID (e.g., "1") and composite IDs (e.g., "LTA:1:C").
 */
export async function getCarparkAvailabilityById(carparkId, lotType = 'C', preloadedData = null) {
  const target = String(carparkId || '').trim()
  if (!target) {
    throw serviceError('Carpark ID is required.', 400)
  }

  const data = preloadedData || await getCarparkAvailability()
  const normalizedTarget = target.toLowerCase()
  const normalizedLotType = String(lotType || 'C').toUpperCase()

  // Match by composite id ("Agency:CarParkID:LotType") or by official CarParkID
  const exactCompositeMatch = data.carparks.find(
    row => String(row.id).toLowerCase() === normalizedTarget
  )
  if (exactCompositeMatch) {
    return { ...exactCompositeMatch, rate: getRateInfo(exactCompositeMatch), fetchedAt: data.fetchedAt, source: data.source }
  }

  const matchingByCarparkId = data.carparks.filter(
    row => String(row.carparkId).toLowerCase() === normalizedTarget
  )

  if (matchingByCarparkId.length === 0) {
    throw serviceError(`Carpark '${target}' was not found in LTA DataMall.`, 404)
  }

  const preferredMatch =
    matchingByCarparkId.find(row => String(row.lotType).toUpperCase() === normalizedLotType) ||
    matchingByCarparkId[0]

  return { ...preferredMatch, rate: getRateInfo(preferredMatch), fetchedAt: data.fetchedAt, source: data.source }
}

export async function getNearbyCarparks({ latitude, longitude, radius, vehicleType, duration = 120 }) {
  const data = await getCarparkAvailability()
  const now = new Date()
  const carparks = data.carparks
    .filter(row => row.lotType === vehicleType && row.latitude !== null && row.longitude !== null)
    .map(row => ({ ...row, distance: distanceInMetres(latitude, longitude, row.latitude, row.longitude) }))
    .filter(row => row.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .map(row => ({
      ...row,
      distance: Math.round(row.distance),
      rate: getRateInfo(row, now),
      estimatedCost: estimateCost(row, duration, now),
    }))
  return { ...data, carparks, radius, duration, distanceType: 'straight-line' }
}
