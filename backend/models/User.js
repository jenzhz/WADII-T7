import mongoose from 'mongoose'

// Example account model. Authentication logic will be implemented later.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
)

export default mongoose.model('User', userSchema)

