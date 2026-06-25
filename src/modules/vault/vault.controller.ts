import { Response } from 'express'
import { VaultService } from './vault.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'
import { supabaseAdmin } from '../../config/supabase'

const vaultService = new VaultService()

export class VaultController {
  // POST /api/v1/vault  (Admin & Employee)
  async createEntry(req: AuthRequest, res: Response) {
    try {
      const { service_name, username, password, assigned_to, notes, site_url } = req.body
      const creatorId = req.user?.id
      const userRole = req.user?.role

      if (!creatorId) return errorResponse(res, 'Not authenticated', 401)
      if (!service_name || !username || !password) {
        return errorResponse(res, 'service_name, username and password are required', 400)
      }

      // If user is not admin, force assignment to themselves
      let finalAssignedTo = assigned_to
      if (userRole !== 'admin') {
        finalAssignedTo = [creatorId]
      } else {
        if (!assigned_to || !Array.isArray(assigned_to) || assigned_to.length === 0) {
          return errorResponse(res, 'assigned_to must be a non-empty array of employee IDs', 400)
        }
      }

      const entry = await vaultService.createEntry({
        service_name,
        username,
        password,
        assigned_to: finalAssignedTo,
        created_by: creatorId,
        notes,
        site_url,
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

  // DELETE /api/v1/vault/:id  (Admin or Owner Employee)
  async deleteEntry(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string
      const userId = req.user?.id
      const userRole = req.user?.role

      if (!userId) return errorResponse(res, 'Not authenticated', 401)
      if (!id) return errorResponse(res, 'Vault entry ID is required', 400)

      // If user is not admin, check if they created this vault entry
      if (userRole !== 'admin') {
        const { data: entry, error } = await supabaseAdmin
          .from('password_vault')
          .select('created_by')
          .eq('id', id)
          .single()

        if (error || !entry) {
          return errorResponse(res, 'Vault entry not found', 404)
        }

        if (entry.created_by !== userId) {
          return errorResponse(res, 'You are not authorized to delete this vault entry', 403)
        }
      }

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

  // PUT /api/v1/vault/:id  (Admin or Owner Employee)
  async updateEntry(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string
      const { service_name, username, password, notes, site_url, assigned_to } = req.body
      const userId = req.user?.id
      const userRole = req.user?.role

      if (!userId) return errorResponse(res, 'Not authenticated', 401)
      if (!id) return errorResponse(res, 'Vault entry ID is required', 400)

      // If user is not admin, check if they created this vault entry
      if (userRole !== 'admin') {
        const { data: entry, error } = await supabaseAdmin
          .from('password_vault')
          .select('created_by')
          .eq('id', id)
          .single()

        if (error || !entry) {
          return errorResponse(res, 'Vault entry not found', 404)
        }

        if (entry.created_by !== userId) {
          return errorResponse(res, 'You are not authorized to edit this vault entry', 403)
        }
      }

      const entry = await vaultService.updateEntry(id, {
        service_name,
        username,
        password,
        notes,
        site_url,
        assigned_to: userRole === 'admin' ? assigned_to : undefined
      }, userId)

      return successResponse(res, { entry }, 'Vault entry updated successfully')
    } catch (error: any) {
      console.error('Update vault entry error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // GET /api/v1/vault/:id/history (Admin & Employee)
  async getHistory(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string
      const userId = req.user?.id
      const userRole = req.user?.role

      if (!userId) return errorResponse(res, 'Not authenticated', 401)
      if (!id) return errorResponse(res, 'Vault entry ID is required', 400)

      // Access control: Non-admins can only see history if they own/created the password or are assigned to it
      if (userRole !== 'admin') {
        const { data: assignment } = await supabaseAdmin
          .from('password_vault_assignments')
          .select('id')
          .eq('vault_id', id)
          .eq('assigned_to', userId)
          .maybeSingle()

        const { data: vault } = await supabaseAdmin
          .from('password_vault')
          .select('created_by')
          .eq('id', id)
          .maybeSingle()

        if (!assignment && vault?.created_by !== userId) {
          return errorResponse(res, 'You are not authorized to view this history', 403)
        }
      }

      const history = await vaultService.getHistory(id)
      return successResponse(res, { history }, 'Vault history fetched successfully')
    } catch (error: any) {
      console.error('Get vault history error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // POST /api/v1/vault/:id/revive (Admin & Owner Employee)
  async reviveVersion(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string
      const { historyId } = req.body
      const userId = req.user?.id
      const userRole = req.user?.role

      if (!userId) return errorResponse(res, 'Not authenticated', 401)
      if (!id) return errorResponse(res, 'Vault entry ID is required', 400)
      if (!historyId) return errorResponse(res, 'historyId is required', 400)

      // Access control: Non-admins can only revive if they created this vault entry
      if (userRole !== 'admin') {
        const { data: vault } = await supabaseAdmin
          .from('password_vault')
          .select('created_by')
          .eq('id', id)
          .single()

        if (!vault || vault.created_by !== userId) {
          return errorResponse(res, 'You are not authorized to restore versions for this entry', 403)
        }
      }

      const entry = await vaultService.reviveVersion(id, historyId, userId)
      return successResponse(res, { entry }, 'Vault entry version revived successfully')
    } catch (error: any) {
      console.error('Revive vault version error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // POST /api/v1/vault/bulk-delete (Admin only)
  async bulkDelete(req: AuthRequest, res: Response) {
    try {
      const { ids } = req.body
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 'ids must be a non-empty array of vault IDs', 400)
      }

      // Access control: Admin only
      if (req.user?.role !== 'admin') {
        return errorResponse(res, 'Admin privileges required', 403)
      }

      await vaultService.bulkDelete(ids)
      return successResponse(res, null, 'Vault entries deleted in bulk')
    } catch (error: any) {
      console.error('Bulk delete error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // POST /api/v1/vault/bulk-assign (Admin only)
  async bulkAssign(req: AuthRequest, res: Response) {
    try {
      const { ids, assigned_to } = req.body
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 'ids must be a non-empty array of vault IDs', 400)
      }
      if (!assigned_to || !Array.isArray(assigned_to) || assigned_to.length === 0) {
        return errorResponse(res, 'assigned_to must be a non-empty array of employee IDs', 400)
      }

      // Access control: Admin only
      if (req.user?.role !== 'admin') {
        return errorResponse(res, 'Admin privileges required', 403)
      }

      await vaultService.bulkAssign(ids, assigned_to)
      return successResponse(res, null, 'Assignments added in bulk')
    } catch (error: any) {
      console.error('Bulk assign error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // GET /api/v1/vault/global/history (Admin & Employee)
  async getAllHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      const userRole = req.user?.role

      if (!userId) return errorResponse(res, 'Not authenticated', 401)

      // Access control: Non-admins can only see their own created password histories
      // Or they can only see histories of passwords assigned to them
      let history = await vaultService.getAllHistory()

      if (userRole !== 'admin') {
        // Fetch user's assigned vault IDs
        const { data: assignments } = await supabaseAdmin
          .from('password_vault_assignments')
          .select('vault_id')
          .eq('assigned_to', userId)

        const assignedVaultIds = (assignments || []).map(a => a.vault_id)

        history = history.filter(h => 
          assignedVaultIds.includes(h.vault_id) || h.updated_by === userId
        )
      }

      return successResponse(res, { history }, 'All password versions fetched successfully')
    } catch (error: any) {
      console.error('Get all history error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
