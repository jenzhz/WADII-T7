import { Router } from 'express'
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../controllers/userController.js'
import { requireAuth } from '../middleware/auth.js'
import {
  addRecentSearch,
  clearRecentSearches,
  deleteRecentSearch,
  listRecentSearches,
} from '../controllers/recentSearchController.js'

const router = Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/logout', requireAuth, logoutUser)
router.get('/profile', requireAuth, getCurrentUser)

router.get('/recent-searches', requireAuth, listRecentSearches)
router.post('/recent-searches', requireAuth, addRecentSearch)
router.delete('/recent-searches', requireAuth, clearRecentSearches)
router.delete('/recent-searches/:id', requireAuth, deleteRecentSearch)

export default router

