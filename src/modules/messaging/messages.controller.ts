import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { MessagesService } from './messages.service'
import { successResponse, errorResponse } from '../../utils/response'

const messagesService = new MessagesService()

export class MessagesController {
  // Get messages in channel
  async getChannelMessages(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params
      const { limit, before } = req.query
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      // Ensure channelId is a string
      const channelIdStr = Array.isArray(channelId) ? channelId[0] : channelId

      const messages = await messagesService.getChannelMessages(
        channelIdStr,
        userId,
        limit ? parseInt(limit as string) : 50,
        before as string
      )

      return successResponse(res, { messages }, 'Messages fetched successfully')
    } catch (error: any) {
      console.error('Get channel messages error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get messages in conversation
  async getConversationMessages(req: AuthRequest, res: Response) {
    try {
      const { conversationId } = req.params
      const { limit, before } = req.query
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      // Ensure conversationId is a string
      const conversationIdStr = Array.isArray(conversationId) ? conversationId[0] : conversationId

      const messages = await messagesService.getConversationMessages(
        conversationIdStr,
        userId,
        limit ? parseInt(limit as string) : 50,
        before as string
      )

      return successResponse(res, { messages }, 'Messages fetched successfully')
    } catch (error: any) {
      console.error('Get conversation messages error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get thread replies
  async getThreadReplies(req: AuthRequest, res: Response) {
    try {
      const { messageId } = req.params
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      // Ensure messageId is a string
      const messageIdStr = Array.isArray(messageId) ? messageId[0] : messageId

      const replies = await messagesService.getThreadReplies(messageIdStr, userId)

      return successResponse(res, { replies }, 'Thread replies fetched successfully')
    } catch (error: any) {
      console.error('Get thread replies error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Search messages
  async searchMessages(req: AuthRequest, res: Response) {
    try {
      const { q, in: channelId, from: fromUserId } = req.query
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      if (!q) {
        return errorResponse(res, 'Search query is required', 400)
      }

      const results = await messagesService.searchMessages(
        userId,
        q as string,
        channelId as string,
        fromUserId as string
      )

      return successResponse(res, { results }, 'Search completed successfully')
    } catch (error: any) {
      console.error('Search messages error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get unread mentions
  async getUnreadMentions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      const mentions = await messagesService.getUnreadMentions(userId)

      return successResponse(res, { mentions }, 'Mentions fetched successfully')
    } catch (error: any) {
      console.error('Get mentions error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Mark mention as read
  async markMentionRead(req: AuthRequest, res: Response) {
    try {
      const { mentionId } = req.params
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      // Ensure mentionId is a string
      const mentionIdStr = Array.isArray(mentionId) ? mentionId[0] : mentionId

      await messagesService.markMentionRead(mentionIdStr, userId)

      return successResponse(res, null, 'Mention marked as read')
    } catch (error: any) {
      console.error('Mark mention read error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
