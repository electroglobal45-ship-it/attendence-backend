import { Response } from 'express'
import { SettingsService } from './settings.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const settingsService = new SettingsService()

export class SettingsController {
  // Get office locations
  async getOfficeLocations(req: AuthRequest, res: Response) {
    try {
      const locations = await settingsService.getOfficeLocations()
      return successResponse(res, { locations }, 'Office locations fetched successfully')
    } catch (error: any) {
      console.error('Get office locations error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Create office location
  async createOfficeLocation(req: AuthRequest, res: Response) {
    try {
      const { name, latitude, longitude, radius_meters } = req.body

      if (!name || latitude === undefined || longitude === undefined) {
        return errorResponse(res, 'Name, latitude, and longitude are required', 400)
      }

      const location = await settingsService.createOfficeLocation({
        name,
        latitude,
        longitude,
        radius_meters
      })

      return createdResponse(res, { location }, 'Office location created successfully')
    } catch (error: any) {
      console.error('Create office location error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Update office location
  async updateOfficeLocation(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const updates = req.body

      if (!id) {
        return errorResponse(res, 'Location ID is required', 400)
      }

      const location = await settingsService.updateOfficeLocation(id as string, updates)

      return successResponse(res, { location }, 'Office location updated successfully')
    } catch (error: any) {
      console.error('Update office location error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Delete office location
  async deleteOfficeLocation(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      if (!id) {
        return errorResponse(res, 'Location ID is required', 400)
      }

      await settingsService.deleteOfficeLocation(id as string)

      return successResponse(res, null, 'Office location deleted successfully')
    } catch (error: any) {
      console.error('Delete office location error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
