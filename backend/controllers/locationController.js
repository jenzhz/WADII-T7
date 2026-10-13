// Placeholder location actions. OneMap calls are intentionally deferred.
export function searchLocations(request, response) {
  response.status(501).json({
    success: false,
    message: 'Location search is not implemented yet.',
    query: request.query.q || '',
  })
}

export function getWalkingRoute(_request, response) {
  response.status(501).json({
    success: false,
    message: 'Walking routes are not implemented yet.',
  })
}
