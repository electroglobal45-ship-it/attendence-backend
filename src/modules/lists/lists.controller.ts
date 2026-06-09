import { Response } from 'express'
import { ListsService } from './lists.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const listsService = new ListsService()

export class ListsController {
  async createList(req: AuthRequest, res: Response) {
    try {
      const { project_id, board_id, name, position, color } = req.body

      if (!project_id || !board_id || !name) {
        return errorResponse(res, 'Project ID, board ID, and name are required', 400)
      }

      const list = await listsService.createList({ project_id, board_id, name, position, color })
      return createdResponse(res, { list }, 'List created successfully')
    } catch (error: any) {
      console.error('Create list error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async updateList(req: AuthRequest, res: Response) {
    try {
      const listId = req.params.listId as string
      const updates = req.body

      if (!listId) {
        return errorResponse(res, 'List ID is required', 400)
      }

      const list = await listsService.updateList(listId, updates)
      return successResponse(res, { list }, 'List updated successfully')
    } catch (error: any) {
      console.error('Update list error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async deleteList(req: AuthRequest, res: Response) {
    try {
      const listId = req.params.listId as string

      if (!listId) {
        return errorResponse(res, 'List ID is required', 400)
      }

      await listsService.deleteList(listId)
      return successResponse(res, null, 'List deleted successfully')
    } catch (error: any) {
      console.error('Delete list error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async moveCards(req: AuthRequest, res: Response) {
    try {
      const listId = req.params.listId as string
      const { targetListId } = req.body

      if (!listId || !targetListId) {
        return errorResponse(res, 'Source and target list IDs are required', 400)
      }

      const tasks = await listsService.moveCards(listId, targetListId)
      return successResponse(res, { tasks }, 'Cards moved successfully')
    } catch (error: any) {
      console.error('Move cards error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async sortCards(req: AuthRequest, res: Response) {
    try {
      const listId = req.params.listId as string
      const { sortBy, order } = req.body

      if (!listId || !sortBy) {
        return errorResponse(res, 'List ID and sortBy are required', 400)
      }

      const tasks = await listsService.sortCards(listId, sortBy, order)
      return successResponse(res, { tasks }, 'Cards sorted successfully')
    } catch (error: any) {
      console.error('Sort cards error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
