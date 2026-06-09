import { Response } from 'express'
import { BoardsService } from './boards.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const boardsService = new BoardsService()

export class BoardsController {
  // Get project boards
  async getProjectBoards(req: AuthRequest, res: Response) {
    try {
      const projectId = req.params.projectId as string

      if (!projectId) {
        return errorResponse(res, 'Project ID is required', 400)
      }

      const boards = await boardsService.getProjectBoards(projectId)
      return successResponse(res, { boards }, 'Boards fetched successfully')
    } catch (error: any) {
      console.error('Get project boards error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get board with all details
  async getBoardDetails(req: AuthRequest, res: Response) {
    try {
      const boardId = req.params.boardId as string

      if (!boardId) {
        return errorResponse(res, 'Board ID is required', 400)
      }

      // Get user info for filtering
      const userId = req.user?.id
      const userRole = req.user?.role

      const boardData = await boardsService.getBoardWithDetails(boardId, userId, userRole)
      return successResponse(res, boardData, 'Board details fetched successfully')
    } catch (error: any) {
      console.error('Get board details error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Create board
  async createBoard(req: AuthRequest, res: Response) {
    try {
      const { project_id, name, description, position } = req.body

      if (!project_id || !name) {
        return errorResponse(res, 'Project ID and name are required', 400)
      }

      const board = await boardsService.createBoard({
        project_id,
        name,
        description,
        position
      })

      return createdResponse(res, { board }, 'Board created successfully')
    } catch (error: any) {
      console.error('Create board error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Update board
  async updateBoard(req: AuthRequest, res: Response) {
    try {
      const boardId = req.params.boardId as string
      const updates = req.body

      if (!boardId) {
        return errorResponse(res, 'Board ID is required', 400)
      }

      const board = await boardsService.updateBoard(boardId, updates)
      return successResponse(res, { board }, 'Board updated successfully')
    } catch (error: any) {
      console.error('Update board error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Delete board
  async deleteBoard(req: AuthRequest, res: Response) {
    try {
      const boardId = req.params.boardId as string

      if (!boardId) {
        return errorResponse(res, 'Board ID is required', 400)
      }

      await boardsService.deleteBoard(boardId)
      return successResponse(res, null, 'Board deleted successfully')
    } catch (error: any) {
      console.error('Delete board error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Add board member
  async addBoardMember(req: AuthRequest, res: Response) {
    try {
      const boardId = req.params.boardId as string
      const { user_id, role, can_edit, can_comment } = req.body

      if (!boardId || !user_id) {
        return errorResponse(res, 'Board ID and user ID are required', 400)
      }

      const member = await boardsService.addBoardMember({
        board_id: boardId,
        user_id,
        role,
        can_edit,
        can_comment
      })

      return createdResponse(res, { member }, 'Board member added successfully')
    } catch (error: any) {
      console.error('Add board member error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Update board member
  async updateBoardMember(req: AuthRequest, res: Response) {
    try {
      const memberId = req.params.memberId as string
      const updates = req.body

      if (!memberId) {
        return errorResponse(res, 'Valid Member ID is required', 400)
      }

      const member = await boardsService.updateBoardMember(memberId, updates)
      return successResponse(res, { member }, 'Board member updated successfully')
    } catch (error: any) {
      console.error('Update board member error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Remove board member
  async removeBoardMember(req: AuthRequest, res: Response) {
    try {
      const memberId = req.params.memberId as string

      if (!memberId) {
        return errorResponse(res, 'Valid Member ID is required', 400)
      }

      await boardsService.removeBoardMember(memberId)
      return successResponse(res, null, 'Board member removed successfully')
    } catch (error: any) {
      console.error('Remove board member error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Toggle board favorite
  async toggleFavorite(req: AuthRequest, res: Response) {
    try {
      const boardId = req.params.boardId as string
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      if (!boardId) {
        return errorResponse(res, 'Valid Board ID is required', 400)
      }

      const result = await boardsService.toggleFavorite(boardId, userId)
      return successResponse(res, result, 'Favorite toggled successfully')
    } catch (error: any) {
      console.error('Toggle favorite error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get user favorites
  async getUserFavorites(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      const favorites = await boardsService.getUserFavoriteBoards(userId)
      return successResponse(res, { favorites }, 'Favorites fetched successfully')
    } catch (error: any) {
      console.error('Get favorites error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
