import mongoose from 'mongoose'
import Favourite from '../models/Favourite.js'

function publicFavourite(favourite) {
  return {
    id: favourite._id.toString(),
    type: favourite.type,
    label: favourite.label,
    carparkId: favourite.carparkId || null,
    latitude: favourite.latitude,
    longitude: favourite.longitude,
    createdAt: favourite.createdAt,
  }
}

export async function listFavourites(request, response, next) {
  try {
    const favourites = await Favourite.find({ user: request.user.id }).sort({ createdAt: -1 })
    return response.json({ success: true, favourites: favourites.map(publicFavourite) })
  } catch (error) {
    return next(error)
  }
}

export async function createFavourite(request, response, next) {
  try {
    const type = request.body.type || 'destination'
    const label = String(request.body.label || '').trim()
    const latitude = Number(request.body.latitude)
    const longitude = Number(request.body.longitude)
    const carparkId = request.body.carparkId ? String(request.body.carparkId).trim() : undefined

    if (!['destination', 'carpark'].includes(type) || !label ||
        !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      return response.status(400).json({
        success: false,
        message: 'A valid type, label, latitude, and longitude are required.',
      })
    }

    const favourite = await Favourite.findOneAndUpdate(
      { user: request.user.id, type, latitude, longitude },
      { $set: { label, carparkId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    )

    return response.status(201).json({ success: true, favourite: publicFavourite(favourite) })
  } catch (error) {
    return next(error)
  }
}

export async function deleteFavourite(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ success: false, message: 'Invalid favourite ID.' })
    }

    const favourite = await Favourite.findOneAndDelete({
      _id: request.params.id,
      user: request.user.id,
    })
    if (!favourite) {
      return response.status(404).json({ success: false, message: 'Favourite not found.' })
    }
    return response.json({ success: true, message: 'Favourite removed.' })
  } catch (error) {
    return next(error)
  }
}

