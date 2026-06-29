import { supabaseAdmin } from '../../config/supabase'

export class NotificationsService {
  // Create notification and assign to users
  async createNotification(data: {
    title: string
    message: string
    type: string
    created_by: string
    recipient_ids: string[]
    scheduled_for?: string
    meeting_link?: string
    priority?: string
  }) {
    const { title, message, type, created_by, recipient_ids, scheduled_for, meeting_link, priority } = data

    // Create notification
    const { data: notification, error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        title,
        message,
        type,
        created_by,
        scheduled_for: scheduled_for || null,
        meeting_link: meeting_link || null,
        priority: priority || 'normal'
      })
      .select()
      .single()

    if (notificationError) {
      throw new Error(`Failed to create notification: ${notificationError.message}`)
    }

    // Create notification recipients
    const recipients = recipient_ids.map(user_id => ({
      notification_id: notification.id,
      user_id,
      is_read: false
    }))

    const { error: recipientsError } = await supabaseAdmin
      .from('notification_recipients')
      .insert(recipients)

    if (recipientsError) {
      // Rollback notification if recipients insert fails
      await supabaseAdmin.from('notifications').delete().eq('id', notification.id)
      throw new Error(`Failed to assign recipients: ${recipientsError.message}`)
    }

    return { notification, recipient_count: recipient_ids.length }
  }

  // Get notifications for a user
  async getUserNotifications(userId: string, limit: number = 50) {
    const { data, error } = await supabaseAdmin
      .from('notification_recipients')
      .select(`
        id,
        notification_id,
        is_read,
        read_at,
        created_at,
        notifications:notification_id (
          id,
          title,
          message,
          type,
          created_by,
          created_at,
          scheduled_for,
          meeting_link,
          priority
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch notifications: ${error.message}`)
    }

    // Fetch creator info separately for each notification
    const results: any[] = data || []
    
    for (const item of results) {
      const notif = item.notifications
      if (notif && typeof notif === 'object' && 'created_by' in notif && notif.created_by) {
        try {
          console.log('Fetching creator for user ID:', notif.created_by)
          const { data: creatorData, error: creatorError } = await supabaseAdmin
            .from('users')
            .select('id, name, email, role')
            .eq('id', notif.created_by)
            .single()
          
          console.log('Creator data:', creatorData, 'Error:', creatorError)
          
          if (creatorData) {
            notif.creator = creatorData
          }
        } catch (err) {
          console.error('Failed to fetch creator:', err)
        }
      }
    }

    console.log('Final results with creators:', JSON.stringify(results, null, 2))
    return results
  }

  // Get unread notification count for a user
  async getUnreadCount(userId: string) {
    const { count, error } = await supabaseAdmin
      .from('notification_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      throw new Error(`Failed to fetch unread count: ${error.message}`)
    }

    return count || 0
  }

  // Mark notification as read
  async markAsRead(userId: string, notificationId: string) {
    const { data, error } = await supabaseAdmin
      .from('notification_recipients')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('notification_id', notificationId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`)
    }

    return data
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string) {
    const { error } = await supabaseAdmin
      .from('notification_recipients')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      throw new Error(`Failed to mark all notifications as read: ${error.message}`)
    }

    return { success: true }
  }

  // Delete notification (only by creator or admin)
  async deleteNotification(notificationId: string, userId: string, userRole: string) {
    // Check if user is creator or admin
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('notifications')
      .select('created_by')
      .eq('id', notificationId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch notification: ${fetchError.message}`)
    }

    if (notification.created_by !== userId && userRole !== 'admin') {
      throw new Error('Unauthorized to delete this notification')
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (error) {
      throw new Error(`Failed to delete notification: ${error.message}`)
    }

    return { success: true }
  }

  // Get all notifications (admin/team leader view)
  async getAllNotifications(limit: number = 100) {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select(`
        *,
        creator:created_by (
          id,
          name,
          email,
          role
        ),
        recipients:notification_recipients (
          user_id,
          is_read,
          read_at,
          user:user_id (
            id,
            name,
            email
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch all notifications: ${error.message}`)
    }

    return data || []
  }
}
