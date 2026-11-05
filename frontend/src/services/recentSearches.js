import api from './api'


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
