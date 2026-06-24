import { Response } from 'express'
import { MeetingsService } from './meetings.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const meetingsService = new MeetingsService()

const DAILY_API_KEY = process.env.DAILY_API_KEY || ''
const DAILY_DOMAIN  = process.env.DAILY_DOMAIN  || ''  // e.g. "yourteam" (without .daily.co)

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

  // POST /api/v1/meetings/:id/daily-room
  // Creates (or retrieves) a Daily.co room for the given meeting and returns the join URL.
  async getDailyRoom(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Not authenticated', 401)

      if (!DAILY_API_KEY) {
        return errorResponse(res, 'Meeting service not configured. Please contact your administrator.', 503)
      }

      const { roomName } = req.body as { roomName: string }
      if (!roomName) return errorResponse(res, 'roomName is required', 400)

      // Sanitize: Daily.co room names must be [a-z0-9-] and max 35 chars
      const safeName = roomName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')           // collapse multiple hyphens
        .replace(/(^-|-$)/g, '')       // strip leading/trailing hyphens
        .substring(0, 35)

      const dailyBaseUrl = 'https://api.daily.co/v1'
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      }

      // Helper to fetch an existing room
      const getRoom = async (): Promise<string | null> => {
        const r = await fetch(`${dailyBaseUrl}/rooms/${safeName}`, { headers })
        if (r.ok) {
          const d = await r.json() as { url: string }
          return d.url || null
        }
        return null
      }

      // 1. Try to get existing room first
      let roomUrl = await getRoom()

      if (!roomUrl) {
        // 2. Room doesn't exist — create it
        const createRes = await fetch(`${dailyBaseUrl}/rooms`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: safeName,
            privacy: 'public',
            properties: {
              enable_prejoin_ui: false,   // skip lobby — call starts instantly
              start_video_off: false,
              start_audio_off: false,
            },
          }),
        })

        if (createRes.ok) {
          const createdData = await createRes.json() as { url: string }
          roomUrl = createdData.url
        } else {
          // Race condition: another request created the room between our GET and POST
          // Try fetching it again before giving up
          roomUrl = await getRoom()

          if (!roomUrl) {
            const errBody = await createRes.json().catch(() => ({}))
            console.error('Daily.co room creation failed:', errBody)
            return errorResponse(res, 'Failed to create meeting room', 502)
          }
        }
      }

      return successResponse(res, { url: roomUrl, roomName: safeName }, 'Daily room ready')
    } catch (error: any) {
      console.error('getDailyRoom error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
