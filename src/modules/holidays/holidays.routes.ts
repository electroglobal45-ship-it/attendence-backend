import { Router } from 'express'
import { HolidaysController } from './holidays.controller'
import { authenticate, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()
const holidaysController = new HolidaysController()

// All routes require authentication
router.use(authenticate)

// Get holidays (all users)
router.get('/', (req, res) => holidaysController.getAllHolidays(req, res))

// Admin only routes
router.post('/', requireAdmin, (req, res) => holidaysController.createHoliday(req, res))
router.put('/:id', requireAdmin, (req, res) => holidaysController.updateHoliday(req, res))
router.delete('/:id', requireAdmin, (req, res) => holidaysController.deleteHoliday(req, res))

export default router
