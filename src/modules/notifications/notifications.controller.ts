import { Request, Response } from 'express'
import { NotificationsService } from './notifications.service'
import { AuthRequest } from '../../middleware/auth.middleware'

const notificationsService = new NotificationsService()

export class NotificationsController {
  // Create notification (Admin or Team Leader only)
  async createNotification(req: AuthRequest, res: Response) {
    try {
      const { title, message, type, recipient_ids, scheduled_for, meeting_link, priority } = req.body

      if (!title || !message || !type || !recipient_ids || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
        return res.status(400).json({ 
          error: 'Missing required fields: title, message, type, and recipient_ids (array)' 
        })
      }

      const result = await notificationsService.createNotification({
        title,
        message,
        type,
        created_by: req.user.id,
        recipient_ids,
        scheduled_for,
        meeting_link,
        priority
      })

      res.status(201).json({
        message: 'Notification created successfully',
        data: result
      })
    } catch (error: any) {
      console.error('Create notification error:', error)
      res.status(500).json({ error: error.message || 'Failed to create notification' })
    }
  }

  // Get user's notifications
  async getUserNotifications(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50
      const notifications = await notificationsService.getUserNotifications(req.user.id, limit)

      res.json({
        message: 'Notifications fetched successfully',
        data: notifications
      })
    } catch (error: any) {
      console.error('Get notifications error:', error)
      res.status(500).json({ error: error.message || 'Failed to fetch notifications' })
    }
  }

  // Get unread count
  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const count = await notificationsService.getUnreadCount(req.user.id)

      res.json({
        message: 'Unread count fetched successfully',
        data: { unread_count: count }
      })
    } catch (error: any) {
      console.error('Get unread count error:', error)
      res.status(500).json({ error: error.message || 'Failed to fetch unread count' })
    }
  }

  // Mark notification as read
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Notification ID is required' })
      }

      const notificationId = Array.isArray(id) ? id[0] : id
      const result = await notificationsService.markAsRead(req.user.id, notificationId)

      res.json({
        message: 'Notification marked as read',
        data: result
      })
    } catch (error: any) {
      console.error('Mark as read error:', error)
      res.status(500).json({ error: error.message || 'Failed to mark notification as read' })
    }
  }

  // Mark all as read
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      await notificationsService.markAllAsRead(req.user.id)

      res.json({
        message: 'All notifications marked as read',
        data: { success: true }
      })
    } catch (error: any) {
      console.error('Mark all as read error:', error)
      res.status(500).json({ error: error.message || 'Failed to mark all as read' })
    }
  }

  // Delete notification (creator or admin only)
  async deleteNotification(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Notification ID is required' })
      }

      const notificationId = Array.isArray(id) ? id[0] : id
      await notificationsService.deleteNotification(notificationId, req.user.id, req.user.role)

      res.json({
        message: 'Notification deleted successfully',
        data: { success: true }
      })
    } catch (error: any) {
      console.error('Delete notification error:', error)
      res.status(500).json({ error: error.message || 'Failed to delete notification' })
    }
  }

  // Get all notifications (Admin/Team Leader view)
  async getAllNotifications(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100
      const notifications = await notificationsService.getAllNotifications(limit)

      res.json({
        message: 'All notifications fetched successfully',
        data: notifications
      })
    } catch (error: any) {
      console.error('Get all notifications error:', error)
      res.status(500).json({ error: error.message || 'Failed to fetch all notifications' })
    }
  }
}
