import 'dotenv/config'
import app from './app.js'
import { connectDatabase } from './config/db.js'

const port = Number(process.env.PORT) || 3000

async function startServer() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured in backend/.env')
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is not configured in backend/.env')
  await connectDatabase(process.env.MONGODB_URI)
  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`)
  })
}

startServer().catch((error) => {
  console.error('Unable to start the backend:', error.message)
  process.exit(1)
})

