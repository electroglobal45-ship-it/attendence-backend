import { Router } from 'express'
import { NotificationsController } from './notifications.controller'
import { authenticate, requireAdminOrTL } from '../../middleware/auth.middleware'

const router = Router()
const notificationsController = new NotificationsController()

// All routes require authentication
router.use(authenticate)

// Create notification (Admin or Team Leader only)
router.post('/', requireAdminOrTL, (req, res) => 
  notificationsController.createNotification(req, res)
)

// Get all notifications (Admin or Team Leader only)
router.get('/all', requireAdminOrTL, (req, res) =>
  notificationsController.getAllNotifications(req, res)
)

// Get user's notifications
router.get('/', (req, res) =>
  notificationsController.getUserNotifications(req, res)
)

// Get unread count
router.get('/unread/count', (req, res) =>
  notificationsController.getUnreadCount(req, res)
)

// Mark all as read
router.put('/read-all', (req, res) =>
  notificationsController.markAllAsRead(req, res)
)

// Mark specific notification as read
router.put('/:id/read', (req, res) =>
  notificationsController.markAsRead(req, res)
)

// Delete notification (creator or admin only)
router.delete('/:id', (req, res) =>
  notificationsController.deleteNotification(req, res)
)

export default router
