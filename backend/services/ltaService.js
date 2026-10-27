const ENDPOINT = 'https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2'
const EV_BATCH_ENDPOINT = 'https://datamall2.mytransport.sg/ltaodataservice/EVCBatch'

let cached = null
let pending = null
let evCached = null
let evPending = null

function serviceError(message, status = 502) {
  return Object.assign(new Error(message), { status })
}

export function distanceInMetres(lat1, lng1, lat2, lng2) {
  const radians = degrees => degrees * Math.PI / 180
  const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lng2 - lng1) / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
}

/**
 * Parses a single EV location entry from LTA DataMall's EVCBatch dataset.
 * Note: LTA DataMall's schema spells longitude as "longtitude".
 */
function mapEvLocation(loc) {
  const latitude = Number(loc?.latitude ?? loc?.Latitude ?? loc?.lat)
  const longitude = Number(loc?.longtitude ?? loc?.longitude ?? loc?.Longitude ?? loc?.lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null
  }

  let totalPoints = 0
  let availablePoints = 0
  const chargingPoints = Array.isArray(loc?.chargingPoints) ? loc.chargingPoints : []

  for (const cp of chargingPoints) {
    const plugTypes = Array.isArray(cp?.plugTypes) ? cp.plugTypes : []
    for (const plug of plugTypes) {
      const evIds = Array.isArray(plug?.evIds) ? plug.evIds : []
      for (const ev of evIds) {
        totalPoints += 1
        if (ev?.status === 1 || ev?.status === '1' || String(ev?.status).toLowerCase() === 'available') {
          availablePoints += 1
        }
      }
    }
  }

  if (totalPoints === 0 && chargingPoints.length > 0) {
    totalPoints = chargingPoints.length
    availablePoints = chargingPoints.length
  }

  return {
    name: String(loc?.name || '').trim(),
    address: String(loc?.address || '').trim(),
    latitude,
    longitude,
    totalPoints,
    availablePoints,
  }
}

/**
 * Fetches EV charging point availability from LTA DataMall (EVCBatch).
 * Cached for 5 minutes to match LTA's 5-minute batch update interval.
 */
export async function getEvChargingLocations() {
  if (!process.env.LTA_API_KEY?.trim()) return []
  if (evCached && Date.now() - evCached.time < 5 * 60_000) return evCached.data
  if (evPending) return evPending

  evPending = (async () => {
    try {
      const signal = AbortSignal.timeout(15_000)
      const metaResponse = await fetch(EV_BATCH_ENDPOINT, {
        headers: {
          AccountKey: process.env.LTA_API_KEY.trim(),
          Accept: 'application/json',
        },
        signal,
      })

      if (!metaResponse.ok) return []
      const metaData = await metaResponse.json()
      const downloadLink = metaData?.value?.[0]?.Link || metaData?.Link
      if (!downloadLink) return []

      const batchResponse = await fetch(downloadLink, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      })
      if (!batchResponse.ok) return []

      const batchPayload = await batchResponse.json()
      const rawLocations = Array.isArray(batchPayload?.evLocationsData)
        ? batchPayload.evLocationsData
        : Array.isArray(batchPayload?.value)
          ? batchPayload.value
          : Array.isArray(batchPayload)
            ? batchPayload
            : []

      const locations = rawLocations
        .map(mapEvLocation)
        .filter(loc => loc !== null && loc.availablePoints > 0)

      evCached = { data: locations, time: Date.now() }
      return locations
    } catch {
      return []
    }
  })()

  try {
    return await evPending
  } finally {
    evPending = null
  }
}

/**
 * Checks whether a carpark has available EV charging points nearby (within 150m).
 */
function attachEvAvailability(carpark, evLocations) {
  if (carpark.latitude === null || carpark.longitude === null || !Array.isArray(evLocations) || evLocations.length === 0) {
    return { ...carpark, hasEvCharger: false, evAvailableLots: 0 }
  }

  let evAvailableLots = 0
  for (const evLoc of evLocations) {
    const dist = distanceInMetres(carpark.latitude, carpark.longitude, evLoc.latitude, evLoc.longitude)
    if (dist <= 150) {
      evAvailableLots += evLoc.availablePoints
    }
  }

  return {
    ...carpark,
    hasEvCharger: evAvailableLots > 0,
    evAvailableLots,
  }
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
    hasEvCharger: false,
    evAvailableLots: 0,
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
        const evPromise = getEvChargingLocations()
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
            const evLocations = await evPromise
            const unique = new Map(
              rows
                .filter(row => row?.CarParkID != null && ['C', 'Y', 'H'].includes(row.LotType))
                .map(mapCarpark)
                .map(carpark => attachEvAvailability(carpark, evLocations))
                .map(row => [row.id, row])
            )
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
    return { ...exactCompositeMatch, fetchedAt: data.fetchedAt, source: data.source }
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

  return { ...preferredMatch, fetchedAt: data.fetchedAt, source: data.source }
}

export async function getNearbyCarparks({ latitude, longitude, radius, vehicleType }) {
  const data = await getCarparkAvailability()
  const carparks = data.carparks
    .filter(row => row.lotType === vehicleType && row.latitude !== null && row.longitude !== null)
    .map(row => ({ ...row, distance: distanceInMetres(latitude, longitude, row.latitude, row.longitude) }))
    .filter(row => row.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .map(row => ({ ...row, distance: Math.round(row.distance) }))
  return { ...data, carparks, radius, distanceType: 'straight-line' }
}
