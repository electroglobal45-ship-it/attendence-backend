import { Router } from 'express'
import { UsersController } from './users.controller'
import { authenticate, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()
const usersController = new UsersController()

// All routes require authentication and admin role
router.use(authenticate)
router.use(requireAdmin)

// Get all users
router.get('/', (req, res) => usersController.getAllUsers(req, res))

// Get user by ID
router.get('/:id', (req, res) => usersController.getUserById(req, res))

// Create user
router.post('/', (req, res) => usersController.createUser(req, res))

// Update user
router.put('/:id', (req, res) => usersController.updateUser(req, res))

// Delete user
router.delete('/:id', (req, res) => usersController.deleteUser(req, res))

// Change user password
router.put('/:id/password', (req, res) => usersController.changeUserPassword(req, res))

export default router
