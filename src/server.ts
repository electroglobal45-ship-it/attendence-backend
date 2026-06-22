// Load environment variables FIRST
import dotenv from 'dotenv'
dotenv.config()

// Disable SSL verification for development (Windows SSL issue fix)
// WARNING: Only enable this in development environment
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  console.log('⚠️  SSL verification disabled for development')
}

// Now import app and socket server
import { createServer } from 'http'
import app from './app'
import { initializeSocketServer } from './socket/socket-server'

const PORT = process.env.PORT || 5000

// Create HTTP server
const httpServer = createServer(app)

// Initialize Socket.IO
const io = initializeSocketServer(httpServer)

// Make io accessible in app
app.set('io', io)

httpServer.listen(PORT, () => {
  console.log('🚀 Server started successfully!')
  console.log(`📡 Environment: ${process.env.NODE_ENV}`)
  console.log(`🌐 Server running on: http://localhost:${PORT}`)
  console.log(`💚 Health check: http://localhost:${PORT}/health`)
  console.log(`📚 API docs: http://localhost:${PORT}/api/v1`)
  console.log(`🔌 WebSocket server: Ready for connections`)
  console.log('\n✨ Ready to accept requests!\n')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  httpServer.close(() => {
    console.log('HTTP server closed')
    io.close(() => {
      console.log('Socket.IO server closed')
    })
  })
})
