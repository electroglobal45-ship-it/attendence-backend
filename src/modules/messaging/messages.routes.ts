import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { MessagesController } from './messages.controller'

const router = Router()
const messagesController = new MessagesController()

// All routes require authentication
router.use(authenticate)

// Get messages in a channel
router.get('/channels/:channelId', messagesController.getChannelMessages.bind(messagesController))

// Get messages in a conversation
router.get('/conversations/:conversationId', messagesController.getConversationMessages.bind(messagesController))

// Get thread replies
router.get('/threads/:messageId', messagesController.getThreadReplies.bind(messagesController))

// Search messages
router.get('/search', messagesController.searchMessages.bind(messagesController))

// Get unread mentions
router.get('/mentions', messagesController.getUnreadMentions.bind(messagesController))

// Mark mention as read
router.put('/mentions/:mentionId/read', messagesController.markMentionRead.bind(messagesController))

export default router
