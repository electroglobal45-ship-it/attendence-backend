import { Server as SocketIOServer } from 'socket.io'
import { AuthenticatedSocket } from '../socket-server'

module.exports = (io: SocketIOServer, socket: AuthenticatedSocket) => {
  // Send real-time notification to specific users
  socket.on('notification:send', (data: { 
    recipient_ids: string[]
    notification: any 
  }) => {
    const { recipient_ids, notification } = data
    
    // Send to each recipient's personal room
    recipient_ids.forEach(userId => {
      io.to(`user:${userId}`).emit('notification:new', notification)
    })
  })

  // Broadcast notification read status
  socket.on('notification:read', (data: { 
    notification_id: string
    user_id: string 
  }) => {
    // Broadcast to user's other sessions
    socket.to(`user:${data.user_id}`).emit('notification:marked-read', data)
  })

  // Broadcast all notifications marked as read
  socket.on('notification:read-all', (data: { user_id: string }) => {
    socket.to(`user:${data.user_id}`).emit('notification:all-marked-read', {})
  })
}
