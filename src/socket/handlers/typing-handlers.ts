import { Server as SocketIOServer } from 'socket.io'
import { AuthenticatedSocket } from '../socket-server'

module.exports = (io: SocketIOServer, socket: AuthenticatedSocket) => {
  
  // User starts typing
  socket.on('typing_start', (data: {
    channelId?: string
    conversationId?: string
  }) => {
    const { channelId, conversationId } = data

    const typingData = {
      userId: socket.userId,
      userName: socket.userName
    }

    // Broadcast to channel or conversation (except sender)
    if (channelId) {
      socket.to(`channel:${channelId}`).emit('user_typing', {
        ...typingData,
        channelId
      })
    } else if (conversationId) {
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        ...typingData,
        conversationId
      })
    }
  })

  // User stops typing
  socket.on('typing_stop', (data: {
    channelId?: string
    conversationId?: string
  }) => {
    const { channelId, conversationId } = data

    const typingData = {
      userId: socket.userId
    }

    if (channelId) {
      socket.to(`channel:${channelId}`).emit('user_stop_typing', {
        ...typingData,
        channelId
      })
    } else if (conversationId) {
      socket.to(`conversation:${conversationId}`).emit('user_stop_typing', {
        ...typingData,
        conversationId
      })
    }
  })
}
