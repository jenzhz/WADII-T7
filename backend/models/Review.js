import mongoose from 'mongoose'

const ratingField = () => ({
  type: Number,
  min: 1,
  max: 5,
  default: null,
})

const replySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
  },
  { timestamps: true },
)

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    carparkId: { type: String, required: true, trim: true, index: true },
    isDemo: { type: Boolean, default: false, index: true },
    overallRating: { type: Number, required: true, min: 1, max: 5 },
    lotSpaciousness: ratingField(),
    entranceExitAccessibility: ratingField(),
    signage: ratingField(),
    pricing: ratingField(),
    comment: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    replies: { type: [replySchema], default: [] },
  },
  { timestamps: true },
)

reviewSchema.index({ user: 1, carparkId: 1 }, { unique: true })

export default mongoose.model('Review', reviewSchema)
