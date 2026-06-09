import { Response } from 'express'
import { EmployeesService } from './employees.service'
import { successResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const employeesService = new EmployeesService()

export class EmployeesController {
  // Get all employees
  async getAllEmployees(req: AuthRequest, res: Response) {
    try {
      const employees = await employeesService.getAllEmployees()
      return successResponse(res, { employees }, 'Employees fetched successfully')
    } catch (error: any) {
      console.error('Get employees error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get employee by ID
  async getEmployeeById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      
      if (!id) {
        return errorResponse(res, 'Employee ID is required', 400)
      }

      const employee = await employeesService.getEmployeeById(id as string)
      return successResponse(res, { employee }, 'Employee fetched successfully')
    } catch (error: any) {
      console.error('Get employee error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
