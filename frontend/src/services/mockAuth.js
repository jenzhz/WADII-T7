const ACCOUNTS_KEY = 'carparkcompare.mockAccounts'
const SESSION_KEY = 'carparkcompare.mockSession'
const LEGACY_DEMO_EMAILS = ['demo@gmail.com', 'demo@carparkcompare.local']

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function createSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password, salt) {
  const input = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function publicAccount(account) {
  const { passwordHash: _passwordHash, salt: _salt, ...safeAccount } = account
  return safeAccount
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

async function buildAccount({ name, email, password }) {
  const salt = createSalt()

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: await hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  }
}

// Development-only browser storage. Replace calls to this file with the shared
// Axios client when the Express/MongoDB authentication endpoints are implemented.
export async function ensureMockAccounts() {
  const existingAccounts = readJson(ACCOUNTS_KEY, null)
  if (Array.isArray(existingAccounts)) {
    const accounts = existingAccounts.filter(
      (account) => !LEGACY_DEMO_EMAILS.includes(account.email),
    )

    if (accounts.length !== existingAccounts.length) saveAccounts(accounts)
    if (LEGACY_DEMO_EMAILS.includes(getMockSession()?.email)) logoutMockAccount()
    return
  }

  saveAccounts([])
}

export function listMockAccounts() {
  return readJson(ACCOUNTS_KEY, []).map(publicAccount)
}

export async function registerMockAccount({ name, email, password }) {
  await ensureMockAccounts()
  const accounts = readJson(ACCOUNTS_KEY, [])
  const normalisedEmail = email.trim().toLowerCase()

  if (accounts.some((account) => account.email === normalisedEmail)) {
    throw new Error('An account with this email already exists.')
  }

  const account = await buildAccount({ name, email: normalisedEmail, password })
  saveAccounts([...accounts, account])
  return publicAccount(account)
}

export async function loginMockAccount({ email, password }) {
  await ensureMockAccounts()
  const accounts = readJson(ACCOUNTS_KEY, [])
  const account = accounts.find(
    (candidate) => candidate.email === email.trim().toLowerCase(),
  )

  if (!account || account.passwordHash !== await hashPassword(password, account.salt)) {
    throw new Error('Email or password is incorrect.')
  }

  account.lastLoginAt = new Date().toISOString()
  saveAccounts(accounts)

  const session = publicAccount(account)
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function getMockSession() {
  return readJson(SESSION_KEY, null)
}

export function logoutMockAccount() {
  localStorage.removeItem(SESSION_KEY)
}

export function deleteMockAccount(id) {
  const accounts = readJson(ACCOUNTS_KEY, [])
  saveAccounts(accounts.filter((account) => account.id !== id))

  if (getMockSession()?.id === id) logoutMockAccount()
}

export async function resetMockAccounts() {
  saveAccounts([])
  localStorage.removeItem(SESSION_KEY)
}
