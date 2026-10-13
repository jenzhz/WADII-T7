export function notFoundHandler(request, response) {
  response.status(404).json({
    success: false,
    message: `Route not found: ${request.method} ${request.originalUrl}`,
  })
}

// Express recognizes error middleware by its four parameters.
export function errorHandler(error, _request, response, _next) {
  console.error(error)
  const status = error.status || error.statusCode || 500
  response.status(status).json({
    success: false,
    message: status === 500 ? 'An unexpected server error occurred.' : error.message,
  })
}

