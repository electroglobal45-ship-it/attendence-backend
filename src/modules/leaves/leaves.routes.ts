import { Router } from 'express'
import { LeavesController } from './leaves.controller'
import { authenticate, requireAdmin, requireEmployee } from '../../middleware/auth.middleware'

const router = Router()
const leavesController = new LeavesController()

// All routes require authentication
router.use(authenticate)

// ===== FULL/HALF DAY LEAVE ROUTES =====

// Get leave requests (employee sees own, admin sees all)
router.get('/', requireEmployee, (req, res) => leavesController.getLeaveRequests(req, res))

// Apply for leave
router.post('/apply', requireEmployee, (req, res) => leavesController.applyLeave(req, res))

// ===== SHORT LEAVE ROUTES =====

// Get short leaves (employee sees own, admin sees all)
router.get('/short', requireEmployee, (req, res) => leavesController.getShortLeaves(req, res))

// Request short leave
router.post('/short', requireEmployee, (req, res) => leavesController.requestShortLeave(req, res))

// Update short leave status (admin only)
router.put('/short/:id', requireAdmin, (req, res) => leavesController.updateShortLeaveStatus(req, res))

export default router
