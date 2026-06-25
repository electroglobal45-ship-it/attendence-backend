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
      const { type, participant_ids, name } = req.body

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
        created_by: userId,
        name
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

  // Get conversation members
  async getMembers(req: AuthRequest, res: Response) {
    try {
      const { conversationId } = req.params
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' })
      }

      const conversationIdStr = Array.isArray(conversationId) ? conversationId[0] : conversationId

      // Verify access
      const hasAccess = await conversationsService.verifyConversationAccess(userId, conversationIdStr)
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied' })
      }

      const members = await conversationsService.getConversationMembers(conversationIdStr)
      return res.json({ success: true, data: { members } })
    } catch (error: any) {
      console.error('Get conversation members error:', error)
      return res.status(500).json({ success: false, message: error.message || 'Failed to fetch members' })
    }
  }

  // Add conversation member
  async addMember(req: AuthRequest, res: Response) {
    try {
      const { conversationId } = req.params
      const { userId: memberUserId } = req.body
      const currentUserId = req.user?.id

      if (!currentUserId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' })
      }

      if (!memberUserId) {
        return res.status(400).json({ success: false, message: 'User ID is required' })
      }

      const conversationIdStr = Array.isArray(conversationId) ? conversationId[0] : conversationId

      // Verify access
      const hasAccess = await conversationsService.verifyConversationAccess(currentUserId, conversationIdStr)
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied' })
      }

      await conversationsService.addConversationMember(conversationIdStr, memberUserId)
      return res.status(201).json({ success: true, message: 'Member added successfully' })
    } catch (error: any) {
      console.error('Add conversation member error:', error)
      return res.status(500).json({ success: false, message: error.message || 'Failed to add member' })
    }
  }

  // Remove conversation member
  async removeMember(req: AuthRequest, res: Response) {
    try {
      const { conversationId, userId: memberUserId } = req.params
      const currentUserId = req.user?.id

      if (!currentUserId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' })
      }

      const conversationIdStr = Array.isArray(conversationId) ? conversationId[0] : conversationId
      const memberUserIdStr = Array.isArray(memberUserId) ? memberUserId[0] : memberUserId

      // Verify access
      const hasAccess = await conversationsService.verifyConversationAccess(currentUserId, conversationIdStr)
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied' })
      }

      await conversationsService.removeConversationMember(conversationIdStr, memberUserIdStr)
      return res.json({ success: true, message: 'Member removed successfully' })
    } catch (error: any) {
      console.error('Remove conversation member error:', error)
      return res.status(500).json({ success: false, message: error.message || 'Failed to remove member' })
    }
  }

  // Delete conversation
  async deleteConversation(req: AuthRequest, res: Response) {
    try {
      const { conversationId } = req.params
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' })
      }

      const conversationIdStr = Array.isArray(conversationId) ? conversationId[0] : conversationId

      // Verify access
      const hasAccess = await conversationsService.verifyConversationAccess(userId, conversationIdStr)
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied' })
      }

      await conversationsService.deleteConversation(conversationIdStr)
      return res.json({ success: true, message: 'Conversation deleted successfully' })
    } catch (error: any) {
      console.error('Delete conversation error:', error)
      return res.status(500).json({ success: false, message: error.message || 'Failed to delete conversation' })
    }
  }
}
