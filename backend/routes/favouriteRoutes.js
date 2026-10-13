import { Router } from 'express'
import {
  createFavourite,
  deleteFavourite,
  listFavourites,
} from '../controllers/favouriteController.js'

const router = Router()

router.get('/', listFavourites)
router.post('/', createFavourite)
router.delete('/:id', deleteFavourite)

export default router

