import { Router } from 'express'
import {
  getCarparkById,
  getCarparks,
  getNearbyCarparks,
} from '../controllers/carparkController.js'

const router = Router()

router.get('/', getCarparks)
router.get('/nearby', getNearbyCarparks)
router.get('/:id', getCarparkById)

export default router

