import { Response } from 'express'
import { UsersService } from './users.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const usersService = new UsersService()

export class UsersController {
  // Get all users
  async getAllUsers(req: AuthRequest, res: Response) {
    try {
      const users = await usersService.getAllUsers()
      return successResponse(res, { users }, 'Users fetched successfully')
    } catch (error: any) {
      console.error('Get users error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get user by ID
  async getUserById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      
      if (!id) {
        return errorResponse(res, 'User ID is required', 400)
      }

      const user = await usersService.getUserById(id as string)
      return successResponse(res, { user }, 'User fetched successfully')
    } catch (error: any) {
      console.error('Get user error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Create user
  async createUser(req: AuthRequest, res: Response) {
    try {
      const { email, name, password, role, category, department, designation, monthly_salary, joining_date } = req.body

      if (!email || !name || !password || !role) {
        return errorResponse(res, 'Email, name, password, and role are required', 400)
      }

      if (!['admin', 'employee'].includes(role)) {
        return errorResponse(res, 'Role must be either admin or employee', 400)
      }

      const user = await usersService.createUser({
        email,
        name,
        password,
        role,
        category,
        department,
        designation,
        monthly_salary,
        joining_date
      })

      return createdResponse(res, { user }, 'User created successfully')
    } catch (error: any) {
      console.error('Create user error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Update user
  async updateUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const updates = req.body

      if (!id) {
        return errorResponse(res, 'User ID is required', 400)
      }

      const user = await usersService.updateUser(id as string, updates)
      return successResponse(res, { user }, 'User updated successfully')
    } catch (error: any) {
      console.error('Update user error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Delete user
  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      if (!id) {
        return errorResponse(res, 'User ID is required', 400)
      }

      await usersService.deleteUser(id as string)
      return successResponse(res, null, 'User deleted successfully')
    } catch (error: any) {
      console.error('Delete user error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Change user password
  async changeUserPassword(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { password } = req.body

      if (!id || !password) {
        return errorResponse(res, 'User ID and password are required', 400)
      }

      await usersService.changeUserPassword(id as string, password)
      return successResponse(res, null, 'Password changed successfully')
    } catch (error: any) {
      console.error('Change password error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
