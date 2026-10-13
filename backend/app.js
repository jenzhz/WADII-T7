import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import carparkRoutes from './routes/carparkRoutes.js'
import favouriteRoutes from './routes/favouriteRoutes.js'
import locationRoutes from './routes/locationRoutes.js'
import userRoutes from './routes/userRoutes.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.get('/api/health', (_request, response) => {
  response.json({ success: true, message: 'CarparkCompare API is running' })
})

// REST routes return JSON so they can be called by Vue and tested in Postman.
app.use('/api/users', userRoutes)
app.use('/api/favourites', favouriteRoutes)
app.use('/api/carparks', carparkRoutes)
app.use('/api/locations', locationRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app

