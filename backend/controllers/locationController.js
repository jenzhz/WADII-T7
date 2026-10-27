// Placeholder location actions. OneMap calls are intentionally deferred.
import { searchLocation } from '../services/oneMapService.js'




export async function searchLocations(request, response) {
  const data = await searchLocation(request.query.q)
  response.json(data)
}

export function getWalkingRoute(_request, response) {
  response.status(501).json({
    success: false,
    message: 'Walking routes are not implemented yet.',
  })
}
