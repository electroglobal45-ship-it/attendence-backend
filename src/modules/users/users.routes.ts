import { Router } from 'express'
import { UsersController } from './users.controller'
import { authenticate, requireAdmin, requireEmployee } from '../../middleware/auth.middleware'

const router = Router()
const usersController = new UsersController()

// All routes require authentication
router.use(authenticate)

// Get all users (accessible to all employees for board member display)
router.get('/', requireEmployee, (req, res) => usersController.getAllUsers(req, res))

// Get user by ID (accessible to all employees)
router.get('/:id', requireEmployee, (req, res) => usersController.getUserById(req, res))

// Admin-only routes
router.post('/', requireAdmin, (req, res) => usersController.createUser(req, res))
router.put('/:id', requireAdmin, (req, res) => usersController.updateUser(req, res))
router.delete('/:id', requireAdmin, (req, res) => usersController.deleteUser(req, res))
router.put('/:id/password', requireAdmin, (req, res) => usersController.changeUserPassword(req, res))

export default router
