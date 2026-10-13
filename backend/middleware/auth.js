import jwt from 'jsonwebtoken'

// Starter Bearer-token middleware for routes that will require a signed-in user.
// It is not connected yet because registration and login remain placeholders.
export function requireAuth(request, response, next) {
  const token = request.headers.authorization?.startsWith('Bearer ')
    ? request.headers.authorization.slice(7)
    : null

  if (!token) {
    return response.status(401).json({ success: false, message: 'Authentication required.' })
  }

  try {
    request.user = jwt.verify(token, process.env.JWT_SECRET)
    return next()
  } catch {
    return response.status(401).json({ success: false, message: 'Invalid or expired token.' })
  }
}
