import { Response } from 'express'
import { AttendanceService } from './attendance.service'
import { successResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const attendanceService = new AttendanceService()

export class AttendanceController {
  // GET /api/v1/attendance/today
  async getTodayAttendance(req: AuthRequest, res: Response) {
    try {
      const employeeId = req.user?.id

      if (!employeeId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      const attendance = await attendanceService.getTodayAttendance(employeeId)
      
      return successResponse(res, { attendance: attendance || null })
    } catch (error: any) {
      console.error('Get today attendance error:', error)
      return errorResponse(res, error.message || 'Failed to get attendance', 500)
    }
  }

  // POST /api/v1/attendance/mark
  async markAttendance(req: AuthRequest, res: Response) {
    try {
      const employeeId = req.user?.id

      if (!employeeId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      const { latitude, longitude, accuracy, selfieURL, selfieBase64, address } = req.body

      if (!latitude || !longitude) {
        return errorResponse(res, 'GPS location is required', 400)
      }

      if (!selfieBase64 && !selfieURL) {
        return errorResponse(res, 'Selfie photo is required', 400)
      }

      // If selfieURL is provided (old way), just store it. If selfieBase64, upload it.
      let selfieToUse = selfieURL

      if (selfieBase64 && !selfieURL) {
        const uploadedUrl = await attendanceService.uploadSelfieFromBase64(employeeId, selfieBase64)
        selfieToUse = uploadedUrl
      }

      const result = await attendanceService.markAttendanceWithURL(
        employeeId,
        latitude,
        longitude,
        accuracy || 0,
        selfieToUse,
        address
      )
      
      return successResponse(res, result, 'Attendance marked successfully')
    } catch (error: any) {
      console.error('Mark attendance error:', error)
      return errorResponse(res, error.message || 'Failed to mark attendance', 400)
    }
  }

  // POST /api/v1/attendance/markout
  async markOut(req: AuthRequest, res: Response) {
    try {
      const employeeId = req.user?.id

      if (!employeeId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      const { latitude, longitude, accuracy, markoutSelfieURL, markoutSelfieBase64, address } = req.body

      // If markoutSelfieURL is provided (old way), use it. If markoutSelfieBase64, upload it.
      let selfieToUse = markoutSelfieURL

      if (markoutSelfieBase64 && !markoutSelfieURL) {
        const uploadedUrl = await attendanceService.uploadSelfieFromBase64(employeeId, markoutSelfieBase64)
        selfieToUse = uploadedUrl
      }

      const result = await attendanceService.markOutWithURL(
        employeeId,
        latitude,
        longitude,
        accuracy,
        selfieToUse,
        address
      )
      
      return successResponse(res, result, 'Marked out successfully')
    } catch (error: any) {
      console.error('Mark out error:', error)
      return errorResponse(res, error.message || 'Failed to mark out', 400)
    }
  }

  // GET /api/v1/attendance/history
  async getHistory(req: AuthRequest, res: Response) {
    try {
      const employeeId = req.user?.id

      if (!employeeId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      const limit = parseInt(req.query.limit as string) || 30

      const records = await attendanceService.getAttendanceHistory(employeeId, limit)
      
      return successResponse(res, { records })
    } catch (error: any) {
      console.error('Get history error:', error)
      return errorResponse(res, error.message || 'Failed to get history', 500)
    }
  }
}
