import bcrypt from 'bcrypt'
import User from '../models/User.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  }
}

function regenerateSession(request) {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => error ? reject(error) : resolve())
  })
}

function saveSession(request) {
  return new Promise((resolve, reject) => {
    request.session.save((error) => error ? reject(error) : resolve())
  })
}

async function establishSession(request, user) {
  await regenerateSession(request)
  request.session.userId = user._id.toString()
  await saveSession(request)
}

export async function registerUser(request, response, next) {
  try {
    const name = String(request.body.name || '').trim()
    const email = String(request.body.email || '').trim().toLowerCase()
    const password = String(request.body.password || '')

    if (!name || !EMAIL_PATTERN.test(email) || password.length < 8) {
      return response.status(400).json({
        success: false,
        message: 'Name, a valid email, and a password of at least 8 characters are required.',
      })
    }

    if (await User.exists({ email })) {
      return response.status(409).json({ success: false, message: 'An account with this email already exists.' })
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
    })

    await establishSession(request, user)
    return response.status(201).json({ success: true, user: publicUser(user) })
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ success: false, message: 'An account with this email already exists.' })
    }
    return next(error)
  }
}

export async function loginUser(request, response, next) {
  try {
    const email = String(request.body.email || '').trim().toLowerCase()
    const password = String(request.body.password || '')
    const user = await User.findOne({ email }).select('+passwordHash')

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({ success: false, message: 'Email or password is incorrect.' })
    }

    await establishSession(request, user)
    return response.json({ success: true, user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
}

export async function getCurrentUser(request, response, next) {
  try {
    const user = await User.findById(request.user.id)
    if (!user) {
      return response.status(401).json({ success: false, message: 'User account no longer exists.' })
    }
    return response.json({ success: true, user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
}

export function logoutUser(request, response, next) {
  request.session.destroy((error) => {
    if (error) return next(error)
    response.clearCookie('carparkcompare.sid', { path: '/' })
    return response.json({ success: true, message: 'Logged out.' })
  })
}

