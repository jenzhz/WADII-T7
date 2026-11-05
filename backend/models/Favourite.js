import mongoose from 'mongoose'

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

favouriteSchema.index({ user: 1, type: 1, latitude: 1, longitude: 1 }, { unique: true })

export default mongoose.model('Favourite', favouriteSchema)

