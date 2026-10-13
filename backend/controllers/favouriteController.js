// Placeholder favourite actions. Database operations will be implemented later.
export function listFavourites(_request, response) {
  response.status(501).json({ success: false, message: 'Favourite listing is not implemented yet.' })
}

export function createFavourite(_request, response) {
  response.status(501).json({ success: false, message: 'Creating favourites is not implemented yet.' })
}

export function deleteFavourite(_request, response) {
  response.status(501).json({ success: false, message: 'Deleting favourites is not implemented yet.' })
}

