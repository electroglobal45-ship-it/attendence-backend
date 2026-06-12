import { Router } from 'express'
import { AuthController } from './auth.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()
const authController = new AuthController()

// Public routes
router.post('/login', (req, res) => authController.login(req, res))
router.post('/refresh', (req, res) => authController.refreshToken(req, res))

// Protected routes
router.get('/me', authenticate, (req, res) => authController.getProfile(req, res))
router.post('/change-password', authenticate, (req, res) => authController.changePassword(req, res))
router.post('/logout', authenticate, (req, res) => authController.logout(req, res))

export default router
