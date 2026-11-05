import 'dotenv/config'
import MongoStore from 'connect-mongo'
import cors from 'cors'
import express from 'express'
import session from 'express-session'
import helmet from 'helmet'
import morgan from 'morgan'
import carparkRoutes from './routes/carparkRoutes.js'
import favouriteRoutes from './routes/favouriteRoutes.js'
import locationRoutes from './routes/locationRoutes.js'
import reviewRoutes from './routes/reviewRoutes.js'
import userRoutes from './routes/userRoutes.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { requireAuth } from './middleware/auth.js'
import { connectDatabase } from './config/db.js'

const app = express()
const isProduction = process.env.NODE_ENV === 'production'

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured in backend/.env')
if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is not configured in backend/.env')

if (process.env.VERCEL === '1') {
  app.set('trust proxy', 1)
  await connectDatabase(process.env.MONGODB_URI)
}

app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(session({
  name: 'carparkcompare.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}))

app.get('/api/health', (_request, response) => {
  response.json({ success: true, message: 'CarparkCompare API is running' })
})

app.use('/api/users', userRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/favourites', requireAuth, favouriteRoutes)
app.use('/api/carparks', carparkRoutes)
app.use('/api/carpark-details', carparkRoutes)
app.use('/api/locations', locationRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app

