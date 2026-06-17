import { Response } from 'express'
import { VaultService } from './vault.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'

const vaultService = new VaultService()

export class VaultController {
  // POST /api/v1/vault  (Admin only)
  async createEntry(req: AuthRequest, res: Response) {
    try {
      const { service_name, username, password, assigned_to, notes } = req.body
      const adminId = req.user?.id

      if (!adminId) return errorResponse(res, 'Not authenticated', 401)
      if (!service_name || !username || !password) {
        return errorResponse(res, 'service_name, username and password are required', 400)
      }
      if (!assigned_to || !Array.isArray(assigned_to) || assigned_to.length === 0) {
        return errorResponse(res, 'assigned_to must be a non-empty array of employee IDs', 400)
      }

      const entry = await vaultService.createEntry({
        service_name,
        username,
        password,
        assigned_to,          // string[]
        created_by: adminId,
        notes,
      })

      return createdResponse(res, { entry }, 'Vault entry created successfully')
    } catch (error: any) {
      console.error('Create vault entry error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // GET /api/v1/vault  (Admin & Employee)
  async listEntries(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      const role   = req.user?.role as 'admin' | 'employee'

      if (!userId) return errorResponse(res, 'Not authenticated', 401)

      const entries = await vaultService.listEntries({ userId, role })
      return successResponse(res, { entries }, 'Vault entries fetched successfully')
    } catch (error: any) {
      console.error('List vault entries error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // POST /api/v1/vault/:id/reveal  (Employee — finds their own assignment)
  async revealPassword(req: AuthRequest, res: Response) {
    try {
      const id     = req.params.id as string
      const userId = req.user?.id

      if (!userId) return errorResponse(res, 'Not authenticated', 401)
      if (!id)     return errorResponse(res, 'Vault entry ID is required', 400)

      const result = await vaultService.revealPassword(id, userId)
      return successResponse(res, result, 'Password revealed')
    } catch (error: any) {
      console.error('Reveal password error:', error)
      if (error.message === 'ALREADY_REVEALED') {
        return errorResponse(res, 'Password has already been revealed. Contact your admin.', 403)
      }
      if (error.message === 'ACCESS_DENIED') {
        return errorResponse(res, 'You are not authorized to reveal this password', 403)
      }
      return errorResponse(res, error.message, 500)
    }
  }

  // DELETE /api/v1/vault/:id  (Admin only)
  async deleteEntry(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string
      if (!id) return errorResponse(res, 'Vault entry ID is required', 400)

      await vaultService.deleteEntry(id)
      return successResponse(res, null, 'Vault entry deleted')
    } catch (error: any) {
      console.error('Delete vault entry error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // POST /api/v1/vault/:id/assign  (Admin only) — add employees to existing entry
  async addAssignments(req: AuthRequest, res: Response) {
    try {
      const id         = req.params.id as string
      const { assigned_to } = req.body

      if (!id) return errorResponse(res, 'Vault entry ID is required', 400)
      if (!Array.isArray(assigned_to) || assigned_to.length === 0) {
        return errorResponse(res, 'assigned_to must be a non-empty array of employee IDs', 400)
      }

      const entry = await vaultService.addAssignments(id, assigned_to)
      return successResponse(res, { entry }, 'Employees assigned successfully')
    } catch (error: any) {
      console.error('Add assignments error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // POST /api/v1/vault/:id/reset  (Admin only)
  // Body: { employeeId?: string }  — omit to reset ALL employees for this entry
  async resetReveal(req: AuthRequest, res: Response) {
    try {
      const id         = req.params.id as string
      const employeeId = req.body?.employeeId as string | undefined

      if (!id) return errorResponse(res, 'Vault entry ID is required', 400)

      await vaultService.resetReveal(id, employeeId)

      const msg = employeeId
        ? 'Reveal reset for employee. They can view once more.'
        : 'Reveal reset for all assigned employees.'

      return successResponse(res, null, msg)
    } catch (error: any) {
      console.error('Reset reveal error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
