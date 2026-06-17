import { supabaseAdmin } from '../../config/supabase'
import { encryptPassword, decryptPassword, hashPassword } from '../../utils/encryption'

export class VaultService {
  // ── Admin: Create vault entry and assign to one or more employees ─────────
  async createEntry(data: {
    service_name: string
    username: string
    password: string
    assigned_to: string[]
    created_by: string
    notes?: string
  }) {
    if (!data.assigned_to || data.assigned_to.length === 0) {
      throw new Error('At least one employee must be assigned')
    }

    const encrypted_password = encryptPassword(data.password)
    // Generate bcrypt hash with pepper for verification layer (non-reversible)
    const password_hash = await hashPassword(data.password)

    const { data: entry, error } = await supabaseAdmin
      .from('password_vault')
      .insert({
        service_name:       data.service_name,
        username:           data.username,
        encrypted_password,
        password_hash,
        created_by:         data.created_by,
        notes:              data.notes || null,
      })
      .select('id')
      .single()

    if (error) throw new Error(`Failed to create vault entry: ${error.message}`)

    const rows = data.assigned_to.map(empId => ({
      vault_id:    entry.id,
      assigned_to: empId,
      is_revealed: false,
    }))

    const { error: assignErr } = await supabaseAdmin
      .from('password_vault_assignments')
      .insert(rows)

    if (assignErr) throw new Error(`Failed to create assignments: ${assignErr.message}`)

    return this._fetchEntry(entry.id)
  }

  // ── Admin: Add/re-assign employees to an existing entry ───────────────────
  async addAssignments(vaultId: string, employeeIds: string[]) {
    if (!employeeIds || employeeIds.length === 0) {
      throw new Error('At least one employee ID is required')
    }

    const rows = employeeIds.map(empId => ({
      vault_id:    vaultId,
      assigned_to: empId,
      is_revealed: false,
    }))

    // upsert: insert new assignments, skip if already exists
    const { error } = await supabaseAdmin
      .from('password_vault_assignments')
      .upsert(rows, { onConflict: 'vault_id,assigned_to', ignoreDuplicates: true })

    if (error) throw new Error(`Failed to add assignments: ${error.message}`)

    return this._fetchEntry(vaultId)
  }

  // ── Internal: fetch a single entry with all assignments ───────────────────
  private async _fetchEntry(id: string) {
    const { data, error } = await supabaseAdmin
      .from('password_vault')
      .select(`
        id, service_name, username, created_by, notes, created_at,
        creator:users!password_vault_created_by_fkey(id, name, email),
        assignments:password_vault_assignments(
          id, assigned_to, is_revealed,
          assignee:users!password_vault_assignments_assigned_to_fkey(id, name, email)
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw new Error(`Failed to fetch vault entry: ${error.message}`)
    return data
  }

  // ── List entries — password never returned ────────────────────────────────
  async listEntries(params: { userId: string; role: 'admin' | 'employee' }) {
    if (params.role === 'admin') {
      const { data, error } = await supabaseAdmin
        .from('password_vault')
        .select(`
          id, service_name, username, encrypted_password, created_by, notes, created_at,
          creator:users!password_vault_created_by_fkey(id, name, email),
          assignments:password_vault_assignments(
            id, assigned_to, is_revealed,
            assignee:users!password_vault_assignments_assigned_to_fkey(id, name, email)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw new Error(`Failed to fetch vault entries: ${error.message}`)
      
      return (data || []).map((e: any) => {
        let password = ''
        try {
          if (e.encrypted_password) {
            password = decryptPassword(e.encrypted_password)
          }
        } catch (err) {
          console.error("Failed to decrypt password for vault entry:", e.id, err)
        }
        return {
          id: e.id,
          service_name: e.service_name,
          username: e.username,
          created_by: e.created_by,
          notes: e.notes,
          created_at: e.created_at,
          creator: e.creator,
          assignments: e.assignments,
          password,
        }
      })
    } else {
      const { data, error } = await supabaseAdmin
        .from('password_vault_assignments')
        .select(`
          id, vault_id, is_revealed,
          vault:password_vault(
            id, service_name, username, notes, created_at,
            creator:users!password_vault_created_by_fkey(id, name, email)
          )
        `)
        .eq('assigned_to', params.userId)
        .order('created_at', { ascending: false })

      if (error) throw new Error(`Failed to fetch vault entries: ${error.message}`)

      return (data || []).map((a: any) => ({
        id:            a.vault?.id,
        assignment_id: a.id,
        service_name:  a.vault?.service_name,
        username:      a.vault?.username,
        notes:         a.vault?.notes,
        created_at:    a.vault?.created_at || a.created_at,
        creator:       a.vault?.creator,
        is_revealed:   a.is_revealed,
      }))
    }
  }

  // ── Employee: One-time reveal (per assignment row) ─────────────────────────
  async revealPassword(vaultId: string, requestingUserId: string) {
    const { data: assignment, error } = await supabaseAdmin
      .from('password_vault_assignments')
      .select('id, vault_id, assigned_to, is_revealed')
      .eq('vault_id',    vaultId)
      .eq('assigned_to', requestingUserId)
      .single()

    if (error || !assignment) throw new Error('ACCESS_DENIED')
    if (assignment.is_revealed)  throw new Error('ALREADY_REVEALED')

    const { data: vault, error: vErr } = await supabaseAdmin
      .from('password_vault')
      .select('encrypted_password')
      .eq('id', vaultId)
      .single()

    if (vErr || !vault) throw new Error('Vault entry not found')

    const plaintext = decryptPassword(vault.encrypted_password)

    const { error: upErr } = await supabaseAdmin
      .from('password_vault_assignments')
      .update({ is_revealed: true })
      .eq('id', assignment.id)

    if (upErr) throw new Error(`Failed to mark as revealed: ${upErr.message}`)

    return { password: plaintext }
  }

  // ── Admin: Delete a vault entry (cascades to assignments) ──────────────────
  async deleteEntry(id: string) {
    const { error } = await supabaseAdmin
      .from('password_vault')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete vault entry: ${error.message}`)
    return { success: true }
  }

  // ── Admin: Reset reveal for a specific employee OR all employees ───────────
  async resetReveal(vaultId: string, employeeId?: string) {
    let query = supabaseAdmin
      .from('password_vault_assignments')
      .update({ is_revealed: false })
      .eq('vault_id', vaultId)

    if (employeeId) {
      query = (query as any).eq('assigned_to', employeeId)
    }

    const { error } = await query
    if (error) throw new Error(`Failed to reset reveal: ${error.message}`)
    return { success: true }
  }
}
