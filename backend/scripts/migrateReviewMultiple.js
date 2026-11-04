import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDatabase } from '../config/db.js'
import Review from '../models/Review.js'

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured in backend/.env')
  await connectDatabase(process.env.MONGODB_URI)

  const indexes = await Review.collection.indexes()
  const uniqueUserCarparkIndex = indexes.find(index =>
    index.unique === true &&
    index.key?.user === 1 &&
    index.key?.carparkId === 1,
  )

  if (!uniqueUserCarparkIndex) {
    console.log('Multiple reviews per user and carpark are already enabled.')
    return
  }

  await Review.collection.dropIndex(uniqueUserCarparkIndex.name)
  console.log(`Removed unique review index: ${uniqueUserCarparkIndex.name}`)
  console.log('Users can now submit multiple reviews for the same carpark.')
}

main()
  .catch(error => {
    console.error(`Review index migration failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
