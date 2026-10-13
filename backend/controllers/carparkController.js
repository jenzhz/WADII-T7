// Placeholder carpark actions. No ranking or external API calls are implemented.
export function getCarparks(_request, response) {
  response.status(501).json({
    success: false,
    message: 'Carpark availability is not implemented yet.',
  })
}

export function getNearbyCarparks(_request, response) {
  response.status(501).json({
    success: false,
    message: 'Nearby carpark search is not implemented yet.',
  })
}

export function getCarparkById(request, response) {
  response.status(501).json({
    success: false,
    message: 'Carpark details are not implemented yet.',
    carparkId: request.params.id,
  })
}

