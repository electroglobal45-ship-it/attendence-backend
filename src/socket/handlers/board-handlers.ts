import { Server as SocketIOServer } from 'socket.io'
import { AuthenticatedSocket } from '../socket-server'
import { supabaseAdmin } from '../../config/supabase'

module.exports = (io: SocketIOServer, socket: AuthenticatedSocket) => {

  // Join a board room to receive live updates for that board
  socket.on('board:join', (boardId: string) => {
    socket.join(`board:${boardId}`)
    console.log(`[Board] ${socket.userName} joined board room: ${boardId}`)
  })

  // Leave a board room
  socket.on('board:leave', (boardId: string) => {
    socket.leave(`board:${boardId}`)
    console.log(`[Board] ${socket.userName} left board room: ${boardId}`)
  })

  // Update board background — save to DB and broadcast to all users in the board room
  socket.on('board:update_background', async (data: {
    boardId: string
    backgroundImage: string | null
    backgroundColor: string | null
  }) => {
    try {
      const { boardId, backgroundImage, backgroundColor } = data

      if (!boardId || !socket.userId) return

      // Save to database
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString()
      }
      if (backgroundImage !== undefined) updatePayload.background_image = backgroundImage
      if (backgroundColor !== undefined) updatePayload.background_color = backgroundColor

      const { error } = await supabaseAdmin
        .from('boards')
        .update(updatePayload)
        .eq('id', boardId)

      if (error) {
        console.error('[Board] Failed to update background:', error.message)
        socket.emit('board:error', { message: 'Failed to update background' })
        return
      }

      // Broadcast to ALL users in the board room (including sender)
      io.to(`board:${boardId}`).emit('board:background_changed', {
        boardId,
        backgroundImage: backgroundImage ?? null,
        backgroundColor: backgroundColor ?? null,
        changedBy: socket.userName,
      })

      console.log(`[Board] Background updated by ${socket.userName} for board ${boardId}`)
    } catch (err) {
      console.error('[Board] Error updating background:', err)
      socket.emit('board:error', { message: 'Server error' })
    }
  })
}
