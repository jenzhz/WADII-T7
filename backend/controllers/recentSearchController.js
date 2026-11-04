import mongoose from 'mongoose'
import User from '../models/User.js'

const MAX_RECENT_SEARCHES = 5

function publicRecentSearch(item) {
  return {
    id: item._id.toString(),
    label: item.label,
    latitude: item.latitude,
    longitude: item.longitude,
    searchedAt: item.searchedAt,
  }
}

async function sendRecentSearches(userId, response, status = 200) {
  const user = await User.findById(userId).select('recentSearches')
  if (!user) return response.status(404).json({ success: false, message: 'User not found.' })
  return response.status(status).json({ success: true, recentSearches: user.recentSearches.map(publicRecentSearch) })
}

// GET /api/users/recent-searches
export async function listRecentSearches(request, response, next) {
  try {
    return await sendRecentSearches(request.user.id, response)
  } catch (error) {
    return next(error)
  }
}

// POST /api/users/recent-searches  { label, latitude, longitude }
// Moves an existing destination with the same name to the top instead of adding a duplicate.
export async function addRecentSearch(request, response, next) {
  try {
    const label = String(request.body.label || '').trim()
    const latitude = Number(request.body.latitude)
    const longitude = Number(request.body.longitude)

    if (!label || label.length > 200 ||
        !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      return response.status(400).json({ success: false, message: 'A valid label, latitude, and longitude are required.' })
    }

    await User.updateOne({ _id: request.user.id }, { $pull: { recentSearches: { label } } })
    await User.updateOne(
      { _id: request.user.id },
      {
        $push: {
          recentSearches: {
            $each: [{ label, latitude, longitude, searchedAt: new Date() }],
            $position: 0,
            $slice: MAX_RECENT_SEARCHES,
          },
        },
      },
    )
    return await sendRecentSearches(request.user.id, response, 201)
  } catch (error) {
    return next(error)
  }
}

// DELETE /api/users/recent-searches/:id
export async function deleteRecentSearch(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ success: false, message: 'Invalid recent search id.' })
    }
    await User.updateOne({ _id: request.user.id }, { $pull: { recentSearches: { _id: request.params.id } } })
    return await sendRecentSearches(request.user.id, response)
  } catch (error) {
    return next(error)
  }
}

// DELETE /api/users/recent-searches
export async function clearRecentSearches(request, response, next) {
  try {
    await User.updateOne({ _id: request.user.id }, { $set: { recentSearches: [] } })
    return response.json({ success: true, recentSearches: [] })
  } catch (error) {
    return next(error)
  }
}
