import { Server as SocketIOServer } from 'socket.io'
import { AuthenticatedSocket } from '../socket-server'

module.exports = (io: SocketIOServer, socket: AuthenticatedSocket) => {
  
  // Join a channel room
  socket.on('join_channel', async (data: { channelId: string }) => {
    try {
      const { channelId } = data
      
      // Verify user has access to channel
      const hasAccess = await verifyChannelAccess(socket.userId!, channelId)
      
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to this channel' })
        return
      }

      // Join the channel room
      socket.join(`channel:${channelId}`)
      
      console.log(`👤 ${socket.userName} joined channel ${channelId}`)
      
      // Notify others in the channel
      socket.to(`channel:${channelId}`).emit('user_joined_channel', {
        userId: socket.userId,
        userName: socket.userName,
        channelId
      })
    } catch (error) {
      console.error('Error joining channel:', error)
      socket.emit('error', { message: 'Failed to join channel' })
    }
  })

  // Leave a channel room
  socket.on('leave_channel', (data: { channelId: string }) => {
    const { channelId } = data
    socket.leave(`channel:${channelId}`)
    
    console.log(`👤 ${socket.userName} left channel ${channelId}`)
    
    // Notify others
    socket.to(`channel:${channelId}`).emit('user_left_channel', {
      userId: socket.userId,
      userName: socket.userName,
      channelId
    })
  })

  // Join a conversation (DM)
  socket.on('join_conversation', async (data: { conversationId: string }) => {
    try {
      const { conversationId } = data
      
      // Verify user is participant
      const isParticipant = await verifyConversationParticipant(socket.userId!, conversationId)
      
      if (!isParticipant) {
        socket.emit('error', { message: 'Access denied to this conversation' })
        return
      }

      socket.join(`conversation:${conversationId}`)
      console.log(`💬 ${socket.userName} joined conversation ${conversationId}`)
    } catch (error) {
      console.error('Error joining conversation:', error)
      socket.emit('error', { message: 'Failed to join conversation' })
    }
  })

  // Join a thread
  socket.on('join_thread', (data: { messageId: string }) => {
    const { messageId } = data
    socket.join(`thread:${messageId}`)
    console.log(`🧵 ${socket.userName} joined thread ${messageId}`)
  })
}

// Helper functions
async function verifyChannelAccess(userId: string, channelId: string): Promise<boolean> {
  const { supabaseAdmin } = require('../../config/supabase')
  
  try {
    // Check if user is a member of the channel
    const { data, error } = await supabaseAdmin
      .from('channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .single()

    return !!data
  } catch (error) {
    return false
  }
}

async function verifyConversationParticipant(userId: string, conversationId: string): Promise<boolean> {
  const { supabaseAdmin } = require('../../config/supabase')
  
  try {
    const { data, error } = await supabaseAdmin
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single()

    return !!data
  } catch (error) {
    return false
  }
}
