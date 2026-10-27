export function requireAuth(request, response, next) {
  if (!request.session?.userId) {
    return response.status(401).json({ success: false, message: 'Authentication required.' })
  }

  request.user = { id: request.session.userId }
  return next()
}
