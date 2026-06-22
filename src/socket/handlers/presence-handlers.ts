import { Server as SocketIOServer } from 'socket.io'
import { AuthenticatedSocket } from '../socket-server'

module.exports = (io: SocketIOServer, socket: AuthenticatedSocket) => {
  
  // Heartbeat to maintain online status
  socket.on('heartbeat', async () => {
    try {
      await updateUserPresence(socket.userId!, 'online')
      
      // Broadcast presence update to all connected users
      io.emit('presence_update', {
        userId: socket.userId,
        status: 'online',
        lastSeenAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('Heartbeat error:', error)
    }
  })

  // User manually changes status
  socket.on('status_change', async (data: {
    status: 'online' | 'away' | 'busy'
    statusText?: string
    statusEmoji?: string
  }) => {
    try {
      const { status, statusText, statusEmoji } = data

      await updateUserStatus(socket.userId!, status, statusText, statusEmoji)

      // Broadcast to all users
      io.emit('presence_update', {
        userId: socket.userId,
        status,
        statusText,
        statusEmoji,
        lastSeenAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('Status change error:', error)
    }
  })
}

// Helper functions
async function updateUserPresence(userId: string, status: string) {
  const { supabaseAdmin } = require('../../config/supabase')
  
  await supabaseAdmin
    .from('user_presence')
    .upsert({
      user_id: userId,
      status,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
}

async function updateUserStatus(
  userId: string, 
  status: string, 
  statusText?: string, 
  statusEmoji?: string
) {
  const { supabaseAdmin } = require('../../config/supabase')
  
  await supabaseAdmin
    .from('user_presence')
    .upsert({
      user_id: userId,
      status,
      status_text: statusText || null,
      status_emoji: statusEmoji || null,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
}
