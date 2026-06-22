import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { ConversationsController } from './conversations.controller'

const router = Router()
const conversationsController = new ConversationsController()

// All routes require authentication
router.use(authenticate)

// Get all conversations for current user
router.get('/', conversationsController.getUserConversations.bind(conversationsController))

// Create new conversation
router.post('/', conversationsController.createConversation.bind(conversationsController))

// Get conversation by ID
router.get('/:conversationId', conversationsController.getConversationById.bind(conversationsController))

export default router
