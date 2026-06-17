import { Response } from 'express'
import { MeetingsService } from './meetings.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const meetingsService = new MeetingsService()

export class MeetingsController {
  // GET /api/v1/meetings
  async listMeetings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      const role   = req.user?.role

      if (!userId || !role) return errorResponse(res, 'Not authenticated', 401)

      const meetings = await meetingsService.listMeetings({ userId, role })
      return successResponse(res, { meetings }, 'Meetings fetched successfully')
    } catch (error: any) {
      console.error('List meetings error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // POST /api/v1/meetings
  async createMeeting(req: AuthRequest, res: Response) {
    try {
      const { title, is_permanent, scheduled_at, assigned_to } = req.body
      const userId = req.user?.id
      const role   = req.user?.role

      if (!userId || !role) return errorResponse(res, 'Not authenticated', 401)
      if (!title || title.trim() === '') {
        return errorResponse(res, 'Title is required', 400)
      }

      const meeting = await meetingsService.createMeeting({
        title,
        is_permanent,
        scheduled_at,
        created_by: userId,
        role,
        assigned_to,
      })

      return createdResponse(res, { meeting }, 'Meeting created successfully')
    } catch (error: any) {
      console.error('Create meeting error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // DELETE /api/v1/meetings/:id
  async deleteMeeting(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string
      const userId = req.user?.id
      const role = req.user?.role

      if (!userId || !role) return errorResponse(res, 'Not authenticated', 401)
      if (!id) return errorResponse(res, 'Meeting ID is required', 400)

      await meetingsService.deleteMeeting(id, userId, role)
      return successResponse(res, null, 'Meeting deleted successfully')
    } catch (error: any) {
      console.error('Delete meeting error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // POST /api/v1/meetings/:id/start
  async startMeeting(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string
      const userId = req.user?.id
      const role = req.user?.role

      if (!userId || !role) return errorResponse(res, 'Not authenticated', 401)
      if (!id) return errorResponse(res, 'Meeting ID is required', 400)

      const meeting = await meetingsService.startMeeting(id, userId, role)
      return successResponse(res, { meeting }, 'Meeting started successfully')
    } catch (error: any) {
      console.error('Start meeting error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // POST /api/v1/meetings/:id/end
  async endMeeting(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string
      const userId = req.user?.id
      const role = req.user?.role

      if (!userId || !role) return errorResponse(res, 'Not authenticated', 401)
      if (!id) return errorResponse(res, 'Meeting ID is required', 400)

      const meeting = await meetingsService.endMeeting(id, userId, role)
      return successResponse(res, { meeting }, 'Meeting ended successfully')
    } catch (error: any) {
      console.error('End meeting error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // POST /api/v1/meetings/:id/ping
  async pingMeeting(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string
      const userId = req.user?.id

      if (!userId) return errorResponse(res, 'Not authenticated', 401)
      if (!id) return errorResponse(res, 'Meeting ID is required', 400)

      const status = await meetingsService.pingMeeting(id, userId)
      return successResponse(res, status, 'Ping processed successfully')
    } catch (error: any) {
      console.error('Ping meeting error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
