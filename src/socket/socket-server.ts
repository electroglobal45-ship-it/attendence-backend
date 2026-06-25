import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { getUserFromToken } from '../config/supabase'

export interface AuthenticatedSocket extends Socket {
  userId?: string
  userName?: string
  userEmail?: string
}

export function initializeSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)

        // Always allow localhost/local IP origins
        if (
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:') ||
          origin.startsWith('http://192.168.') ||
          origin.startsWith('http://10.') ||
          origin.startsWith('http://172.')
        ) {
          return callback(null, true)
        }

        // Support comma-separated list of allowed origins
        const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
          .split(',')
          .map((o) => o.trim())

        if (corsOrigins.includes(origin)) {
          return callback(null, true)
        }

        callback(new Error('Not allowed by CORS'))
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')
      
      if (!token) {
        return next(new Error('Authentication required'))
      }

      // Verify token and get user
      const user = await getUserFromToken(token)
      
      if (!user) {
        return next(new Error('Invalid token'))
      }

      // Attach user info to socket
      socket.userId = user.id
      socket.userName = user.name
      socket.userEmail = user.email

      next()
    } catch (error) {
      console.error('Socket authentication error:', error)
      next(new Error('Authentication failed'))
    }
  })

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`✅ User connected: ${socket.userName} (${socket.userId})`)

    // Join user's personal room for direct notifications
    socket.join(`user:${socket.userId}`)

    // Update user presence to online
    updateUserPresence(socket.userId!, 'online')

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userName}`)
      updateUserPresence(socket.userId!, 'offline')
    })

    // Load socket event handlers
    require('./handlers/channel-handlers')(io, socket)
    require('./handlers/message-handlers')(io, socket)
    require('./handlers/typing-handlers')(io, socket)
    require('./handlers/presence-handlers')(io, socket)
    require('./handlers/board-handlers')(io, socket)
    require('./handlers/meeting-handlers')(io, socket)
  })

  return io
}

// Helper function to update user presence
async function updateUserPresence(userId: string, status: 'online' | 'offline' | 'away' | 'busy') {
  const { supabaseAdmin } = require('../config/supabase')
  
  try {
    await supabaseAdmin
      .from('user_presence')
      .upsert({
        user_id: userId,
        status,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('Error updating presence:', error)
  }
}
