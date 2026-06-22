import { Router } from 'express'
import { AgentsController } from './agents.controller'
import { authenticate, requireAdmin } from '../../middleware/auth.middleware'

const router = Router()
const agentsController = new AgentsController()

// All agent routes require authentication and admin access
router.use(authenticate)
router.use(requireAdmin)

// Get all agents configuration and performance stats
router.get('/', (req, res) => agentsController.getAgents(req, res))

// Toggle agent enabled/disabled state
router.post('/toggle', (req, res) => agentsController.toggleAgent(req, res))

// Update agent priority routing weight
router.post('/priority', (req, res) => agentsController.updatePriority(req, res))

export default router
