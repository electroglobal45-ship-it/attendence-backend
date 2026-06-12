import { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { successResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const authService = new AuthService()

export class AuthController {
  // POST /api/v1/auth/login
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body

      if (!email || !password) {
        return errorResponse(res, 'Email and password are required', 400)
      }

      const result = await authService.login(email, password)
      
      return successResponse(res, result, 'Login successful')
    } catch (error: any) {
      console.error('Login error:', error)
      return errorResponse(res, error.message || 'Login failed', 401)
    }
  }

  // POST /api/v1/auth/refresh
  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body

      if (!refreshToken) {
        return errorResponse(res, 'Refresh token is required', 400)
      }

      const result = await authService.refreshToken(refreshToken)
      
      return successResponse(res, result, 'Token refreshed successfully')
    } catch (error: any) {
      console.error('Refresh token error:', error)
      return errorResponse(res, error.message || 'Failed to refresh token', 401)
    }
  }

  // GET /api/v1/auth/me
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      const profile = await authService.getUserProfile(userId)
      
      return successResponse(res, profile)
    } catch (error: any) {
      console.error('Get profile error:', error)
      return errorResponse(res, error.message || 'Failed to get profile', 500)
    }
  }

  // POST /api/v1/auth/change-password
  async changePassword(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      const { oldPassword, newPassword } = req.body

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      if (!oldPassword || !newPassword) {
        return errorResponse(res, 'Old password and new password are required', 400)
      }

      if (newPassword.length < 6) {
        return errorResponse(res, 'New password must be at least 6 characters', 400)
      }

      await authService.changePassword(userId, oldPassword, newPassword)
      
      return successResponse(res, null, 'Password changed successfully')
    } catch (error: any) {
      console.error('Change password error:', error)
      return errorResponse(res, error.message || 'Failed to change password', 400)
    }
  }

  // POST /api/v1/auth/logout
  async logout(req: AuthRequest, res: Response) {
    try {
      // With Supabase Auth, logout is handled client-side
      // This endpoint is just for consistency
      return successResponse(res, null, 'Logged out successfully')
    } catch (error: any) {
      console.error('Logout error:', error)
      return errorResponse(res, error.message || 'Logout failed', 500)
    }
  }
}
