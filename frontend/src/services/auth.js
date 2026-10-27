import api from './api'

const USER_KEY = 'carparkcompare.user'
const SEARCH_KEY = 'carparkcompare.search'
let sessionVerified = false

function saveSession({ user }) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  sessionVerified = true
  window.dispatchEvent(new Event('auth-changed'))
  return user
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    clearSession()
    return null
  }
}

export async function registerAccount(details) {
  const { data } = await api.post('/users/register', details)
  return saveSession(data)
}

export async function loginAccount(credentials) {
  const { data } = await api.post('/users/login', credentials)
  return saveSession(data)
}

export async function verifySession() {
  if (sessionVerified) return getCurrentUser()
  const { data } = await api.get('/users/profile')
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  sessionVerified = true
  return data.user
}

export async function logoutAccount() {
  try {
    await api.post('/users/logout')
  } finally {
    clearSession()
  }
}

export function clearSession() {
  sessionVerified = false
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(SEARCH_KEY)
  localStorage.removeItem('lastComparison')
  window.dispatchEvent(new Event('auth-changed'))
}
