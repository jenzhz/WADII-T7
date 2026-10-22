import { Router } from 'express'
import {
  getCarparkById,
  getCarparkDetails,
  getCarparks,
  getNearbyCarparks,
} from '../controllers/carparkController.js'

const router = Router()

router.get('/', (request, response, next) => {
  if (
    request.baseUrl.endsWith('/carpark-details') ||
    request.query.carparkId ||
    request.query.id
  ) {
    return getCarparkDetails(request, response, next)
  }
  return getCarparks(request, response, next)
})

router.get('/nearby', getNearbyCarparks)
router.get('/details', getCarparkDetails)
router.get('/:id', getCarparkById)

export default router
