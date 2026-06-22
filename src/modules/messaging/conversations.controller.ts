import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { ConversationsService } from './conversations.service'

const conversationsService = new ConversationsService()

export class ConversationsController {
  // Get all conversations for current user
  async getUserConversations(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        })
      }

      const conversations = await conversationsService.getUserConversations(userId)

      res.json({
        success: true,
        data: conversations
      })
    } catch (error: any) {
      console.error('Get user conversations error:', error)
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch conversations'
      })
    }
  }

  // Create new conversation
  async createConversation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      const { type, participant_ids } = req.body

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        })
      }

      if (!type || !participant_ids || !Array.isArray(participant_ids)) {
        return res.status(400).json({
          success: false,
          message: 'Type and participant_ids are required'
        })
      }

      if (type === 'direct' && participant_ids.length !== 1) {
        return res.status(400).json({
          success: false,
          message: 'Direct conversations must have exactly one other participant'
        })
      }

      const conversation = await conversationsService.createConversation({
        type,
        participant_ids,
        created_by: userId
      })

      res.status(201).json({
        success: true,
        data: conversation
      })
    } catch (error: any) {
      console.error('Create conversation error:', error)
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create conversation'
      })
    }
  }

  // Get conversation by ID
  async getConversationById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      const { conversationId } = req.params

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        })
      }

      // Ensure conversationId is a string
      const conversationIdStr = Array.isArray(conversationId) ? conversationId[0] : conversationId

      const conversation = await conversationsService.getConversationById(conversationIdStr, userId)

      res.json({
        success: true,
        data: conversation
      })
    } catch (error: any) {
      console.error('Get conversation error:', error)
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch conversation'
      })
    }
  }
}
