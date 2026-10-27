import { Router } from 'express'
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../controllers/userController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/logout', requireAuth, logoutUser)
router.get('/profile', requireAuth, getCurrentUser)

export default router

