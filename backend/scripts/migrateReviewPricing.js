import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDatabase } from '../config/db.js'
import Review from '../models/Review.js'

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured in backend/.env')
  await connectDatabase(process.env.MONGODB_URI)

  const renamed = await Review.collection.updateMany(
    { evExperience: { $exists: true }, pricing: { $exists: false } },
    { $rename: { evExperience: 'pricing' } },
  )
  const cleaned = await Review.collection.updateMany(
    { evExperience: { $exists: true }, pricing: { $exists: true } },
    { $unset: { evExperience: '' } },
  )

  console.log(`Migrated ${renamed.modifiedCount} review pricing ratings.`)
  console.log(`Removed ${cleaned.modifiedCount} duplicate legacy EV rating fields.`)
}

main()
  .catch(error => {
    console.error(`Review pricing migration failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
