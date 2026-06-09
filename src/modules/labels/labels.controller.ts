import { Response } from 'express'
import { LabelsService } from './labels.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const labelsService = new LabelsService()

export class LabelsController {
  async getBoardLabels(req: AuthRequest, res: Response) {
    try {
      const boardId = req.params.boardId as string
      if (!boardId) return errorResponse(res, 'Board ID is required', 400)

      const labels = await labelsService.getBoardLabels(boardId)
      return successResponse(res, { labels }, 'Board labels fetched successfully')
    } catch (error: any) {
      return errorResponse(res, error.message, 500)
    }
  }

  async createLabel(req: AuthRequest, res: Response) {
    try {
      const { board_id, name, color, position } = req.body
      if (!board_id || !color) return errorResponse(res, 'Board ID and color are required', 400)

      const label = await labelsService.createLabel({ board_id, name, color, position })
      return createdResponse(res, { label }, 'Label created successfully')
    } catch (error: any) {
      return errorResponse(res, error.message, 500)
    }
  }

  async updateLabel(req: AuthRequest, res: Response) {
    try {
      const labelId = req.params.labelId as string
      const label = await labelsService.updateLabel(labelId, req.body)
      return successResponse(res, { label }, 'Label updated successfully')
    } catch (error: any) {
      return errorResponse(res, error.message, 500)
    }
  }

  async deleteLabel(req: AuthRequest, res: Response) {
    try {
      const labelId = req.params.labelId as string
      await labelsService.deleteLabel(labelId)
      return successResponse(res, null, 'Label deleted successfully')
    } catch (error: any) {
      return errorResponse(res, error.message, 500)
    }
  }

  async addLabelToTask(req: AuthRequest, res: Response) {
    try {
      const taskId = req.params.taskId as string
      const { labelId } = req.body
      const data = await labelsService.addLabelToTask(taskId, labelId)
      return createdResponse(res, data, 'Label added to task')
    } catch (error: any) {
      return errorResponse(res, error.message, 500)
    }
  }

  async removeLabelFromTask(req: AuthRequest, res: Response) {
    try {
      const taskId = req.params.taskId as string
      const labelId = req.params.labelId as string
      await labelsService.removeLabelFromTask(taskId, labelId)
      return successResponse(res, null, 'Label removed from task')
    } catch (error: any) {
      return errorResponse(res, error.message, 500)
    }
  }
}
