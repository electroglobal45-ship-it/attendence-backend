import { Router } from 'express'
import { AttendanceController } from './attendance.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()
const attendanceController = new AttendanceController()

// All attendance routes require authentication
router.use(authenticate)

// Get today's attendance
router.get('/today', (req, res) => attendanceController.getTodayAttendance(req, res))

// Mark attendance (check-in)
router.post('/mark', (req, res) => attendanceController.markAttendance(req, res))

// Mark out (check-out)
router.post('/markout', (req, res) => attendanceController.markOut(req, res))

// Get attendance history
router.get('/history', (req, res) => attendanceController.getHistory(req, res))

export default router
