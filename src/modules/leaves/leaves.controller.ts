import { Response } from 'express'
import { LeavesService } from './leaves.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const leavesService = new LeavesService()

export class LeavesController {
  // Get leave requests
  async getLeaveRequests(req: AuthRequest, res: Response) {
    try {
      const { all } = req.query
      const userId = req.user?.id
      const userRole = req.user?.role

      // Admin can see all, employee sees own
      const leaves = await leavesService.getLeaveRequests({
        userId: userRole === 'admin' && all === 'true' ? undefined : userId,
        all: userRole === 'admin' && all === 'true'
      })

      return successResponse(res, { leaves }, 'Leave requests fetched successfully')
    } catch (error: any) {
      console.error('Get leave requests error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Apply for leave
  async applyLeave(req: AuthRequest, res: Response) {
    try {
      const { type, start_date, end_date, reason } = req.body
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      if (!type || !start_date || !end_date || !reason) {
        return errorResponse(res, 'All fields are required', 400)
      }

      const leave = await leavesService.applyLeave({
        employee_id: userId,
        type,
        start_date,
        end_date,
        reason
      })

      return createdResponse(res, { leave }, 'Leave applied successfully')
    } catch (error: any) {
      console.error('Apply leave error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get short leaves
  async getShortLeaves(req: AuthRequest, res: Response) {
    try {
      const { all } = req.query
      const userId = req.user?.id
      const userRole = req.user?.role

      // Admin can see all, employee sees own
      const leaves = await leavesService.getShortLeaves({
        userId: userRole === 'admin' && all === 'true' ? undefined : userId,
        all: userRole === 'admin' && all === 'true'
      })

      return successResponse(res, { leaves }, 'Short leaves fetched successfully')
    } catch (error: any) {
      console.error('Get short leaves error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Request short leave
  async requestShortLeave(req: AuthRequest, res: Response) {
    try {
      const { date, short_leave_type, reason } = req.body
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      if (!date || !short_leave_type || !reason) {
        return errorResponse(res, 'All fields are required', 400)
      }

      const leave = await leavesService.requestShortLeave({
        employee_id: userId,
        date,
        short_leave_type,
        reason
      })

      return createdResponse(res, { leave }, 'Short leave requested successfully')
    } catch (error: any) {
      console.error('Request short leave error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Update short leave status (admin only)
  async updateShortLeaveStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { status, adminNotes } = req.body

      if (!id || !status) {
        return errorResponse(res, 'Leave ID and status are required', 400)
      }

      if (!['approved', 'rejected'].includes(status)) {
        return errorResponse(res, 'Status must be approved or rejected', 400)
      }

      const leave = await leavesService.updateShortLeaveStatus(
        id as string,
        status,
        adminNotes
      )

      return successResponse(res, { leave }, 'Short leave updated successfully')
    } catch (error: any) {
      console.error('Update short leave error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
