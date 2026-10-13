import mongoose from 'mongoose'

// Saves a carpark or destination for a user without storing live availability.
const favouriteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['carpark', 'destination'], required: true },
    label: { type: String, required: true, trim: true },
    carparkId: { type: String, trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { timestamps: true },
)

export default mongoose.model('Favourite', favouriteSchema)

