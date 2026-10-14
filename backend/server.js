import 'dotenv/config'
import app from './app.js'
import { connectDatabase } from './config/db.js'

const port = Number(process.env.PORT) || 3000

async function startServer() {
  // Public carpark searches do not require MongoDB. Auth/saved places still do.
  if (process.env.MONGODB_URI) await connectDatabase(process.env.MONGODB_URI)
  else console.warn('MongoDB not configured: only database-independent features are available.')
  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`)
  })
}

startServer().catch((error) => {
  console.error('Unable to start the backend:', error.message)
  process.exit(1)
})

