import mongoose from 'mongoose'

// Example account model. Authentication logic will be implemented later.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    isDemo: { type: Boolean, default: false, index: true },
    // Last few destinations this user searched, newest first (max 5, see recentSearchController.js)
    recentSearches: {
      type: [
        new mongoose.Schema(
          {
            label: { type: String, required: true, trim: true },
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true },
            searchedAt: { type: Date, default: Date.now },
          },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
)

export default mongoose.model('User', userSchema)

