import { Response } from 'express'
import { HolidaysService } from './holidays.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const holidaysService = new HolidaysService()

export class HolidaysController {
  // Get all holidays
  async getAllHolidays(req: AuthRequest, res: Response) {
    try {
      const { year } = req.query

      const holidays = await holidaysService.getAllHolidays(
        year ? parseInt(year as string) : undefined
      )

      return successResponse(res, { holidays }, 'Holidays fetched successfully')
    } catch (error: any) {
      console.error('Get holidays error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Create holiday
  async createHoliday(req: AuthRequest, res: Response) {
    try {
      const { date, name, is_mandatory } = req.body

      if (!date || !name) {
        return errorResponse(res, 'Date and name are required', 400)
      }

      const holiday = await holidaysService.createHoliday({
        date,
        name,
        is_mandatory
      })

      return createdResponse(res, { holiday }, 'Holiday created successfully')
    } catch (error: any) {
      console.error('Create holiday error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Update holiday
  async updateHoliday(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const updates = req.body

      if (!id) {
        return errorResponse(res, 'Holiday ID is required', 400)
      }

      const holiday = await holidaysService.updateHoliday(id as string, updates)

      return successResponse(res, { holiday }, 'Holiday updated successfully')
    } catch (error: any) {
      console.error('Update holiday error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Delete holiday
  async deleteHoliday(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      if (!id) {
        return errorResponse(res, 'Holiday ID is required', 400)
      }

      await holidaysService.deleteHoliday(id as string)

      return successResponse(res, null, 'Holiday deleted successfully')
    } catch (error: any) {
      console.error('Delete holiday error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
