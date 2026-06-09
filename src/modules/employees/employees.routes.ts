import { Router } from 'express'
import { EmployeesController } from './employees.controller'
import { authenticate, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()
const employeesController = new EmployeesController()

// All routes require authentication
router.use(authenticate)

// Get all employees (admin only)
router.get('/', requireAdmin, (req, res) => employeesController.getAllEmployees(req, res))

// Get employee by ID (admin only)
router.get('/:id', requireAdmin, (req, res) => employeesController.getEmployeeById(req, res))

export default router
