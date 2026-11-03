import mongoose from 'mongoose'
import Review from '../models/Review.js'
import User from '../models/User.js'

const OPTIONAL_RATINGS = [
  'lotSpaciousness',
  'entranceExitAccessibility',
  'signage',
  'pricing',
]
const PARKING_DIFFICULTIES = ['beginner-friendly', 'moderate', 'challenging']

function httpError(message, status) {
  return Object.assign(new Error(message), { status })
}

function cleanCarparkId(value) {
  const id = String(value || '').trim()
  if (!id || id.length > 150) throw httpError('A valid carparkId is required.', 400)
  return id
}

function cleanComment(value, maximum = 2000) {
  const comment = String(value || '').trim()
  if (!comment) throw httpError('A written comment is required.', 400)
  if (comment.length > maximum) throw httpError(`Comment must be ${maximum} characters or fewer.`, 400)
  return comment
}

function cleanRating(value, name, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw httpError(`${name} is required.`, 400)
    return null
  }
  const rating = Number(value)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw httpError(`${name} must be a whole number from 1 to 5.`, 400)
  }
  return rating
}

function cleanParkingDifficulty(value) {
  const difficulty = String(value || '').trim()
  if (!PARKING_DIFFICULTIES.includes(difficulty)) {
    throw httpError('Parking difficulty must be Beginner Friendly, Moderate, or Challenging.', 400)
  }
  return difficulty
}

function reviewPayload(body) {
  const payload = {
    overallRating: cleanRating(body.overallRating, 'Overall rating', true),
    parkingDifficulty: cleanParkingDifficulty(body.parkingDifficulty),
    comment: cleanComment(body.comment),
  }
  for (const field of OPTIONAL_RATINGS) payload[field] = cleanRating(body[field], field)
  return payload
}

function validObjectId(value, label) {
  if (!mongoose.isValidObjectId(value)) throw httpError(`${label} was not found.`, 404)
}

function isOwner(user, userId) {
  return String(user?._id || user) === String(userId)
}

function averageExpression(field) {
  return { $avg: `$${field}` }
}

function difficultyScoreExpression() {
  return {
    $switch: {
      branches: [
        { case: { $eq: ['$parkingDifficulty', 'beginner-friendly'] }, then: 1 },
        { case: { $eq: ['$parkingDifficulty', 'moderate'] }, then: 2 },
        { case: { $eq: ['$parkingDifficulty', 'challenging'] }, then: 3 },
      ],
      default: null,
    },
  }
}

function addDifficultyConsensus(summary) {
  if (!summary) return summary
  const { parkingDifficultyScore, ...rest } = summary
  if (parkingDifficultyScore == null) return rest
  const score = Number(parkingDifficultyScore)
  const parkingDifficulty = score < 1.5
    ? 'beginner-friendly'
    : score < 2.5 ? 'moderate' : 'challenging'
  return { ...rest, parkingDifficulty }
}

export async function getMyReviews(request, response, next) {
  try {
    // Use the signed-in account, rather than a user ID supplied by the browser.
    const reviews = await Review.find({ user: request.user.id })
      .sort({ updatedAt: -1 })
      .select('carparkId overallRating lotSpaciousness entranceExitAccessibility signage pricing parkingDifficulty comment createdAt updatedAt')
      .lean()

    return response.json({ success: true, reviews })
  } catch (error) { return next(error) }
}

export async function getUserReviews(request, response, next) {
  try {
    const userId = request.params.userId
    validObjectId(userId, 'Profile')
    const user = await User.findById(userId).select('name createdAt').lean()
    if (!user) throw httpError('Profile was not found.', 404)

    const reviews = await Review.find({ user: userId })
      .sort({ updatedAt: -1 })
      .select('carparkId overallRating lotSpaciousness entranceExitAccessibility signage pricing parkingDifficulty comment createdAt updatedAt')
      .lean()

    // Other users can see the display name and reviews, but no account credentials.
    return response.json({
      success: true,
      user: { id: user._id.toString(), name: user.name, createdAt: user.createdAt },
      reviews,
    })
  } catch (error) { return next(error) }
}

export async function getCarparkReviews(request, response, next) {
  try {
    const carparkId = cleanCarparkId(request.params.carparkId)
    const reviews = await Review.find({ carparkId })
      .sort({ updatedAt: -1 })
      .populate('user', 'name')
      .populate('replies.user', 'name')
      .lean()

    const summaryRows = await Review.aggregate([
      { $match: { carparkId } },
      { $group: {
        _id: '$carparkId',
        reviewCount: { $sum: 1 },
        overallRating: averageExpression('overallRating'),
        lotSpaciousness: averageExpression('lotSpaciousness'),
        entranceExitAccessibility: averageExpression('entranceExitAccessibility'),
        signage: averageExpression('signage'),
        pricing: averageExpression('pricing'),
        parkingDifficultyScore: { $avg: difficultyScoreExpression() },
        parkingDifficultyReviewCount: { $sum: { $cond: [{ $in: ['$parkingDifficulty', PARKING_DIFFICULTIES] }, 1, 0] } },
      } },
    ])

    return response.json({
      success: true,
      reviews,
      summary: addDifficultyConsensus(summaryRows[0]) || { carparkId, reviewCount: 0, overallRating: null },
    })
  } catch (error) { return next(error) }
}

export async function createReview(request, response, next) {
  try {
    const carparkId = cleanCarparkId(request.body.carparkId)
    const review = await Review.create({
      user: request.user.id,
      carparkId,
      ...reviewPayload(request.body),
    })
    await review.populate('user', 'name')
    return response.status(201).json({ success: true, review })
  } catch (error) {
    if (error?.code === 11000) return response.status(409).json({ success: false, message: 'You have already reviewed this carpark. Edit your existing review instead.' })
    return next(error)
  }
}

export async function updateReview(request, response, next) {
  try {
    validObjectId(request.params.reviewId, 'Review')
    const review = await Review.findById(request.params.reviewId)
    if (!review) throw httpError('Review was not found.', 404)
    if (!isOwner(review.user, request.user.id)) throw httpError('You can only edit your own review.', 403)
    Object.assign(review, reviewPayload(request.body))
    await review.save()
    await review.populate(['user', 'replies.user'])
    return response.json({ success: true, review })
  } catch (error) { return next(error) }
}

export async function deleteReview(request, response, next) {
  try {
    validObjectId(request.params.reviewId, 'Review')
    const review = await Review.findById(request.params.reviewId)
    if (!review) throw httpError('Review was not found.', 404)
    if (!isOwner(review.user, request.user.id)) throw httpError('You can only delete your own review.', 403)
    await review.deleteOne()
    return response.json({ success: true, message: 'Review deleted.' })
  } catch (error) { return next(error) }
}

export async function createReply(request, response, next) {
  try {
    validObjectId(request.params.reviewId, 'Review')
    const review = await Review.findById(request.params.reviewId)
    if (!review) throw httpError('Review was not found.', 404)
    review.replies.push({ user: request.user.id, comment: cleanComment(request.body.comment, 1000) })
    await review.save()
    await review.populate('replies.user', 'name')
    return response.status(201).json({ success: true, reply: review.replies.at(-1) })
  } catch (error) { return next(error) }
}

export async function updateReply(request, response, next) {
  try {
    validObjectId(request.params.reviewId, 'Review')
    validObjectId(request.params.replyId, 'Reply')
    const review = await Review.findById(request.params.reviewId)
    if (!review) throw httpError('Review was not found.', 404)
    const reply = review.replies.id(request.params.replyId)
    if (!reply) throw httpError('Reply was not found.', 404)
    if (!isOwner(reply.user, request.user.id)) throw httpError('You can only edit your own reply.', 403)
    reply.comment = cleanComment(request.body.comment, 1000)
    await review.save()
    await review.populate('replies.user', 'name')
    return response.json({ success: true, reply: review.replies.id(request.params.replyId) })
  } catch (error) { return next(error) }
}

export async function deleteReply(request, response, next) {
  try {
    validObjectId(request.params.reviewId, 'Review')
    validObjectId(request.params.replyId, 'Reply')
    const review = await Review.findById(request.params.reviewId)
    if (!review) throw httpError('Review was not found.', 404)
    const reply = review.replies.id(request.params.replyId)
    if (!reply) throw httpError('Reply was not found.', 404)
    if (!isOwner(reply.user, request.user.id)) throw httpError('You can only delete your own reply.', 403)
    reply.deleteOne()
    await review.save()
    return response.json({ success: true, message: 'Reply deleted.' })
  } catch (error) { return next(error) }
}

export async function getCommunitySummaries(request, response, next) {
  try {
    const requestedIds = String(request.query.carparkIds || '')
      .split(',').map(value => value.trim()).filter(Boolean).slice(0, 500)
    const match = requestedIds.length ? { carparkId: { $in: requestedIds } } : {}
    const summaries = await Review.aggregate([
      { $match: match },
      { $sort: { updatedAt: -1 } },
      { $group: {
        _id: '$carparkId',
        reviewCount: { $sum: 1 },
        overallRating: averageExpression('overallRating'),
        lotSpaciousness: averageExpression('lotSpaciousness'),
        entranceExitAccessibility: averageExpression('entranceExitAccessibility'),
        signage: averageExpression('signage'),
        pricing: averageExpression('pricing'),
        parkingDifficultyScore: { $avg: difficultyScoreExpression() },
        parkingDifficultyReviewCount: { $sum: { $cond: [{ $in: ['$parkingDifficulty', PARKING_DIFFICULTIES] }, 1, 0] } },
        lastReviewedAt: { $max: '$updatedAt' },
        latestComment: { $first: '$comment' },
        latestRating: { $first: '$overallRating' },
      } },
      { $project: { _id: 0, carparkId: '$_id', reviewCount: 1, overallRating: 1, lotSpaciousness: 1, entranceExitAccessibility: 1, signage: 1, pricing: 1, parkingDifficultyScore: 1, parkingDifficultyReviewCount: 1, lastReviewedAt: 1, latestComment: 1, latestRating: 1 } },
    ])
    const recentActivity = await Review.find(match).sort({ updatedAt: -1 }).limit(8)
      .select('carparkId overallRating comment updatedAt user').populate('user', 'name').lean()
    return response.json({ success: true, summaries: summaries.map(addDifficultyConsensus), recentActivity })
  } catch (error) { return next(error) }
}
