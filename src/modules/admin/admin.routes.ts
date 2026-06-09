import { Router } from 'express'
import { AdminController } from './admin.controller'
import { authenticate, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()
const adminController = new AdminController()

// All routes require authentication and admin role
router.use(authenticate)
router.use(requireAdmin)

// Dashboard stats
router.get('/stats', (req, res) => adminController.getDashboardStats(req, res))

// Attendance management
router.get('/attendance', (req, res) => adminController.getAllAttendance(req, res))
router.post('/mark-attendance', (req, res) => adminController.markAttendance(req, res))

// Leave management
router.get('/leaves', (req, res) => adminController.getAllLeaves(req, res))
router.put('/leaves/:id', (req, res) => adminController.updateLeaveStatus(req, res))

export default router
