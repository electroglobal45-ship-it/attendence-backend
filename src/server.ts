// Load environment variables FIRST
import dotenv from 'dotenv'
dotenv.config()

// Disable SSL verification for development (Windows SSL issue fix)
// WARNING: Only enable this in development environment
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  console.log('⚠️  SSL verification disabled for development')
}

// Now import app
import app from './app'

const PORT = process.env.PORT || 5000

const server = app.listen(PORT, () => {
  console.log('🚀 Server started successfully!')
  console.log(`📡 Environment: ${process.env.NODE_ENV}`)
  console.log(`🌐 Server running on: http://localhost:${PORT}`)
  console.log(`💚 Health check: http://localhost:${PORT}/health`)
  console.log(`📚 API docs: http://localhost:${PORT}/api/v1`)
  console.log('\n✨ Ready to accept requests!\n')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    console.log('HTTP server closed')
  })
})
