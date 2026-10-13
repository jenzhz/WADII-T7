import { Router } from 'express'
import { getCurrentUser, loginUser, registerUser } from '../controllers/userController.js'

const router = Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.get('/profile', getCurrentUser)

export default router

