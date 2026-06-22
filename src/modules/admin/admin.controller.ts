import { Response } from 'express'
import { AdminService } from './admin.service'
import { successResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const adminService = new AdminService()

export class AdminController {
  // Get dashboard stats
  async getDashboardStats(req: AuthRequest, res: Response) {
    try {
      const stats = await adminService.getDashboardStats()
      return successResponse(res, stats, 'Stats fetched successfully')
    } catch (error: any) {
      console.error('Get stats error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get all attendance
  async getAllAttendance(req: AuthRequest, res: Response) {
    try {
      const { date, employeeId, limit } = req.query

      const records = await adminService.getAllAttendance({
        date: date as string,
        employeeId: employeeId as string,
        limit: limit ? parseInt(limit as string) : undefined
      })

      return successResponse(res, { records }, 'Attendance fetched successfully')
    } catch (error: any) {
      console.error('Get attendance error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get all leaves
  async getAllLeaves(req: AuthRequest, res: Response) {
    try {
      const { status } = req.query

      const leaves = await adminService.getAllLeaveRequests(status as string)

      return successResponse(res, { leaves }, 'Leaves fetched successfully')
    } catch (error: any) {
      console.error('Get leaves error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Update leave status
  async updateLeaveStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { status, adminNotes } = req.body

      if (!id || !status) {
        return errorResponse(res, 'Leave ID and status are required', 400)
      }

      if (!['approved', 'rejected'].includes(status)) {
        return errorResponse(res, 'Status must be approved or rejected', 400)
      }

      const leave = await adminService.updateLeaveStatus(id as string, status, adminNotes)

      return successResponse(res, { leave }, 'Leave updated successfully')
    } catch (error: any) {
      console.error('Update leave error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Mark attendance (admin manually overrides attendance status/times)
  async markAttendance(req: AuthRequest, res: Response) {
    try {
      const { employeeId, date, action, reason, checkIn, checkOut } = req.body

      if (!employeeId || !date || !action) {
        return errorResponse(res, 'employeeId, date, and action are required', 400)
      }

      const validActions = ['present', 'absent', 'half_day', 'late_within_buffer', 'mark_checkout']
      if (!validActions.includes(action)) {
        return errorResponse(res, 'action must be: present, absent, half_day, late_within_buffer, or mark_checkout', 400)
      }

      const result = await adminService.markAttendance(employeeId, date, action, reason, checkIn, checkOut)

      return successResponse(res, { attendance: result }, `Successfully marked as ${action.replace(/_/g, ' ')}`)
    } catch (error: any) {
      console.error('Mark attendance error:', error)
      return errorResponse(res, error.message, 400)
    }
  }
}
