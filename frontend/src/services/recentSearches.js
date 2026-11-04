import api from './api'

// Recent destination searches, saved to the signed-in user's account (MongoDB).
// The backend keeps the newest 5 and moves a repeated destination to the top.

export async function getRecentSearches() {
  const { data } = await api.get('/users/recent-searches')
  return data.recentSearches
}

export async function addRecentSearch({ label, latitude, longitude }) {
  const { data } = await api.post('/users/recent-searches', { label, latitude, longitude })
  return data.recentSearches
}

export async function deleteRecentSearch(id) {
  const { data } = await api.delete(`/users/recent-searches/${encodeURIComponent(id)}`)
  return data.recentSearches
}

export async function clearRecentSearches() {
  const { data } = await api.delete('/users/recent-searches')
  return data.recentSearches
}
