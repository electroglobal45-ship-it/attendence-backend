import { Response } from 'express'
import { AgentsService } from './agents.service'
import { successResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const agentsService = new AgentsService()

export class AgentsController {
  // Get all agents configuration and performance stats
  async getAgents(req: AuthRequest, res: Response) {
    try {
      const agents = await agentsService.getAgents()
      return successResponse(res, { agents }, 'Agents configuration and stats fetched successfully')
    } catch (error: any) {
      console.error('Get agents error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Toggle an agent's enabled state
  async toggleAgent(req: AuthRequest, res: Response) {
    try {
      const { agentId, enabled } = req.body
      
      if (!agentId || enabled === undefined) {
        return errorResponse(res, 'agentId and enabled properties are required', 400)
      }

      const agents = await agentsService.toggleAgent(agentId, enabled)
      return successResponse(res, { agents }, `Agent ${agentId} enabled status updated to ${enabled}`)
    } catch (error: any) {
      console.error('Toggle agent error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Update an agent's priority weight
  async updatePriority(req: AuthRequest, res: Response) {
    try {
      const { agentId, priority } = req.body

      if (!agentId || priority === undefined) {
        return errorResponse(res, 'agentId and priority properties are required', 400)
      }

      const agents = await agentsService.updatePriority(agentId, priority)
      return successResponse(res, { agents }, `Agent ${agentId} priority updated to ${priority}`)
    } catch (error: any) {
      console.error('Update agent priority error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
