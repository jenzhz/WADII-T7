import mongoose from 'mongoose'

// Opens the single MongoDB connection shared by all Mongoose models.
export async function connectDatabase(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not configured')
  }

  await mongoose.connect(uri)
  console.log('MongoDB connected')
}

