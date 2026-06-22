import { Router } from 'express'
import { EmployeesController } from './employees.controller'
import { authenticate, requireAdminOrHR } from '../../middleware/auth.middleware'

const router = Router()
const employeesController = new EmployeesController()

// All routes require authentication
router.use(authenticate)

// Get all employees (admin or HR)
router.get('/', requireAdminOrHR, (req, res) => employeesController.getAllEmployees(req, res))

// Get employee by ID (admin or HR)
router.get('/:id', requireAdminOrHR, (req, res) => employeesController.getEmployeeById(req, res))

export default router
