// Placeholder user/authentication actions. Replace these responses as a team.
export function registerUser(_request, response) {
  response.status(501).json({ success: false, message: 'User registration is not implemented yet.' })
}

export function loginUser(_request, response) {
  response.status(501).json({ success: false, message: 'User login is not implemented yet.' })
}

export function getCurrentUser(_request, response) {
  response.status(501).json({ success: false, message: 'User profile lookup is not implemented yet.' })
}

