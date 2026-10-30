import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  createReply,
  createReview,
  deleteReply,
  deleteReview,
  getCarparkReviews,
  getCommunitySummaries,
  getMyReviews,
  getUserReviews,
  updateReply,
  updateReview,
} from '../controllers/reviewController.js'

const router = Router()

router.get('/mine', requireAuth, getMyReviews)
router.get('/user/:userId', requireAuth, getUserReviews)
router.get('/community', getCommunitySummaries)
router.get('/carpark/:carparkId', getCarparkReviews)
router.post('/', requireAuth, createReview)
router.put('/:reviewId', requireAuth, updateReview)
router.delete('/:reviewId', requireAuth, deleteReview)
router.post('/:reviewId/replies', requireAuth, createReply)
router.put('/:reviewId/replies/:replyId', requireAuth, updateReply)
router.delete('/:reviewId/replies/:replyId', requireAuth, deleteReply)

export default router
