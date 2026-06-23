import { Server as SocketIOServer } from 'socket.io'
import { AuthenticatedSocket } from '../socket-server'

module.exports = (io: SocketIOServer, socket: AuthenticatedSocket) => {
  // Direct Call: Forward call details to specific user
  socket.on('meeting:call_user', (data: {
    targetUserId: string
    meetingId: string
    roomName: string
    title: string
  }) => {
    const { targetUserId, meetingId, roomName, title } = data
    if (!targetUserId || !meetingId) return

    console.log(`[Meeting] Call from ${socket.userName} to user: ${targetUserId}`)

    // Broadcast to target user's personal room
    io.to(`user:${targetUserId}`).emit('meeting:incoming_call', {
      meetingId,
      roomName,
      title,
      callerName: socket.userName || 'Someone',
      callerId: socket.userId
    })
  })

  // Decline Call: Notify caller that the call was declined
  socket.on('meeting:decline_call', (data: {
    callerId: string
  }) => {
    const { callerId } = data
    if (!callerId) return

    io.to(`user:${callerId}`).emit('meeting:call_declined', {
      declinedBy: socket.userName || 'User'
    })
  })
}
