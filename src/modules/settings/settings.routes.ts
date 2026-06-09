import { Router } from 'express'
import { SettingsController } from './settings.controller'
import { authenticate, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()
const settingsController = new SettingsController()

// All routes require authentication and admin role
router.use(authenticate)
router.use(requireAdmin)

// Office locations
router.get('/office', (req, res) => settingsController.getOfficeLocations(req, res))
router.post('/office', (req, res) => settingsController.createOfficeLocation(req, res))
router.put('/office/:id', (req, res) => settingsController.updateOfficeLocation(req, res))
router.delete('/office/:id', (req, res) => settingsController.deleteOfficeLocation(req, res))

export default router
