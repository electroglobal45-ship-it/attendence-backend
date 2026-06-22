import { Router } from 'express'
import { AdminController } from './admin.controller'
import { authenticate, requireAdmin, requireAdminOrHR } from '../../middleware/auth.middleware'

const router = Router()
const adminController = new AdminController()

// All routes require authentication
router.use(authenticate)

// Dashboard stats (accessible to admin and HR)
router.get('/stats', requireAdminOrHR, (req, res) => adminController.getDashboardStats(req, res))

// Attendance management - viewing (accessible to admin and HR)
router.get('/attendance', requireAdminOrHR, (req, res) => adminController.getAllAttendance(req, res))

// Attendance management - marking (admin only)
router.post('/mark-attendance', requireAdmin, (req, res) => adminController.markAttendance(req, res))

// Leave management (admin only)
router.get('/leaves', requireAdmin, (req, res) => adminController.getAllLeaves(req, res))
router.put('/leaves/:id', requireAdmin, (req, res) => adminController.updateLeaveStatus(req, res))

export default router
