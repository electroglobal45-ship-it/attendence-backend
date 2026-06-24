import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
// Rate limiting disabled - import rateLimit from 'express-rate-limit'
import { errorHandler, notFoundHandler } from './middleware/error.middleware'

const app = express()

// Security middleware
app.use(helmet())

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    
    // In development, allow any localhost or local IP origin
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      if (origin.startsWith('http://localhost:') || 
          origin.startsWith('http://127.0.0.1:') || 
          origin.startsWith('http://192.168.') || 
          origin.startsWith('http://10.') || 
          origin.startsWith('http://172.')) {
        return callback(null, true)
      }
    }
    
    const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000'
    if (origin === corsOrigin) {
      return callback(null, true)
    }
    
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}))

// Rate limiting disabled for internal use
// const limiter = rateLimit({ ... })
// app.use('/api', limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Logging middleware
app.use(morgan('dev'))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  })
})

// API routes will be added here
app.get('/api/v1', (req, res) => {
  res.json({ 
    message: 'Attendance & Task Management API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      attendance: '/api/v1/attendance',
      tasks: '/api/v1/tasks',
      employees: '/api/v1/employees',
      leaves: '/api/v1/leaves',
      reports: '/api/v1/reports'
    }
  })
})

// Import route modules
import authRoutes from './modules/auth/auth.routes'
import attendanceRoutes from './modules/attendance/attendance.routes'
import tasksRoutes from './modules/tasks/tasks.routes'
import employeesRoutes from './modules/employees/employees.routes'
import usersRoutes from './modules/users/users.routes'
import adminRoutes from './modules/admin/admin.routes'
import holidaysRoutes from './modules/holidays/holidays.routes'
import settingsRoutes from './modules/settings/settings.routes'
import leavesRoutes from './modules/leaves/leaves.routes'
import boardsRoutes from './modules/boards/boards.routes'
import listsRoutes from './modules/lists/lists.routes'
import labelsRoutes from './modules/labels/labels.routes'
import driveRoutes from './modules/drive/drive.routes'
import vaultRoutes from './modules/vault/vault.routes'
import meetingsRoutes from './modules/meetings/meetings.routes'
import agentsRoutes from './modules/agents/agents.routes'
import channelsRoutes from './modules/messaging/channels.routes'
import messagesRoutes from './modules/messaging/messages.routes'
import conversationsRoutes from './modules/messaging/conversations.routes'

// Use route modules
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/attendance', attendanceRoutes)
app.use('/api/v1/tasks', tasksRoutes)
app.use('/api/v1/employees', employeesRoutes)
app.use('/api/v1/users', usersRoutes)
app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1/holidays', holidaysRoutes)
app.use('/api/v1/settings', settingsRoutes)
app.use('/api/v1/leaves', leavesRoutes)
app.use('/api/v1/boards', boardsRoutes)
app.use('/api/v1/lists', listsRoutes)
app.use('/api/v1/labels', labelsRoutes)
app.use('/api/v1/drive', driveRoutes)
app.use('/api/v1/vault', vaultRoutes)
app.use('/api/v1/meetings', meetingsRoutes)
app.use('/api/v1/agents', agentsRoutes)
app.use('/api/v1/channels', channelsRoutes)
app.use('/api/v1/messages', messagesRoutes)
app.use('/api/v1/conversations', conversationsRoutes)


// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

export default app
