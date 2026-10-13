import { Router } from 'express'
import { getWalkingRoute, searchLocations } from '../controllers/locationController.js'

const router = Router()

router.get('/search', searchLocations)
router.get('/walking-route', getWalkingRoute)

export default router
