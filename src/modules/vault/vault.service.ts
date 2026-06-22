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
    site_url?: string
  }) {
    if (!data.assigned_to || data.assigned_to.length === 0) {
      throw new Error('At least one employee must be assigned')
    }

    const encrypted_password = encryptPassword(data.password)
    // Generate bcrypt hash with pepper for verification layer (non-reversible)
    const password_hash = await hashPassword(data.password)

    // Pack site_url and notes into notes column as JSON
    const notes_json = JSON.stringify({
      site_url: data.site_url || '',
      notes: data.notes || ''
    })

    const { data: entry, error } = await supabaseAdmin
      .from('password_vault')
      .insert({
        service_name:       data.service_name,
        username:           data.username,
        encrypted_password,
        password_hash,
        created_by:         data.created_by,
        notes:              notes_json,
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

  // ── Edit vault entry ───────────────────────────────────────────────────────
  async updateEntry(
    id: string,
    data: {
      service_name?: string
      username?: string
      password?: string
      notes?: string
      site_url?: string
      assigned_to?: string[]
    }
  ) {
    const updates: any = {}
    if (data.service_name !== undefined) updates.service_name = data.service_name
    if (data.username !== undefined) updates.username = data.username
    
    // If password is changed, encrypt and hash it again!
    if (data.password !== undefined) {
      updates.encrypted_password = encryptPassword(data.password)
      updates.password_hash = await hashPassword(data.password)
      
      // Also reset is_revealed status of assignments so employees see hashed form first again
      await supabaseAdmin
        .from('password_vault_assignments')
        .update({ is_revealed: false })
        .eq('vault_id', id)
    }

    // Handle site_url and notes packing
    if (data.notes !== undefined || data.site_url !== undefined) {
      const { data: current, error: fetchErr } = await supabaseAdmin
        .from('password_vault')
        .select('notes')
        .eq('id', id)
        .single()
      
      let currentSiteUrl = ""
      let currentNotes = ""
      if (!fetchErr && current && current.notes) {
        try {
          const parsed = JSON.parse(current.notes)
          if (parsed && typeof parsed === 'object') {
            currentSiteUrl = parsed.site_url || ""
            currentNotes = parsed.notes || ""
          } else {
            currentNotes = current.notes
          }
        } catch {
          currentNotes = current.notes
        }
      }

      const finalSiteUrl = data.site_url !== undefined ? data.site_url : currentSiteUrl
      const finalNotes = data.notes !== undefined ? data.notes : currentNotes

      updates.notes = JSON.stringify({
        site_url: finalSiteUrl,
        notes: finalNotes
      })
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin
        .from('password_vault')
        .update(updates)
        .eq('id', id)

      if (error) throw new Error(`Failed to update vault entry: ${error.message}`)
    }

    // Admin can update assignments
    if (data.assigned_to !== undefined && Array.isArray(data.assigned_to)) {
      // Delete old assignments
      const { error: delErr } = await supabaseAdmin
        .from('password_vault_assignments')
        .delete()
        .eq('vault_id', id)

      if (delErr) throw new Error(`Failed to update assignments (delete phase): ${delErr.message}`)

      if (data.assigned_to.length > 0) {
        const rows = data.assigned_to.map(empId => ({
          vault_id:    id,
          assigned_to: empId,
          is_revealed: false,
        }))

        const { error: insErr } = await supabaseAdmin
          .from('password_vault_assignments')
          .insert(rows)

        if (insErr) throw new Error(`Failed to update assignments (insert phase): ${insErr.message}`)
      }
    }

    return this._fetchEntry(id)
  }

  // ── Internal: fetch a single entry with all assignments ───────────────────
  private async _fetchEntry(id: string) {
    const { data, error } = await supabaseAdmin
      .from('password_vault')
      .select(`
        id, service_name, username, created_by, notes, created_at, encrypted_password,
        creator:users!password_vault_created_by_fkey(id, name, email),
        assignments:password_vault_assignments(
          id, assigned_to, is_revealed,
          assignee:users!password_vault_assignments_assigned_to_fkey(id, name, email)
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw new Error(`Failed to fetch vault entry: ${error.message}`)

    let password = ''
    try {
      if (data.encrypted_password) {
        password = decryptPassword(data.encrypted_password)
      }
    } catch (err) {
      console.error("Failed to decrypt password for vault entry:", data.id, err)
    }

    let unpackedNotes = ''
    let unpackedSiteUrl = ''
    if (data.notes) {
      try {
        const parsed = JSON.parse(data.notes)
        if (parsed && typeof parsed === 'object') {
          unpackedNotes = parsed.notes || ''
          unpackedSiteUrl = parsed.site_url || ''
        } else {
          unpackedNotes = data.notes
        }
      } catch {
        unpackedNotes = data.notes
      }
    }

    return {
      id: data.id,
      service_name: data.service_name,
      username: data.username,
      created_by: data.created_by,
      notes: unpackedNotes,
      site_url: unpackedSiteUrl,
      created_at: data.created_at,
      creator: data.creator,
      assignments: data.assignments,
      password,
    }
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

        let unpackedNotes = ''
        let unpackedSiteUrl = ''
        if (e.notes) {
          try {
            const parsed = JSON.parse(e.notes)
            if (parsed && typeof parsed === 'object') {
              unpackedNotes = parsed.notes || ''
              unpackedSiteUrl = parsed.site_url || ''
            } else {
              unpackedNotes = e.notes
            }
          } catch {
            unpackedNotes = e.notes
          }
        }

        return {
          id: e.id,
          service_name: e.service_name,
          username: e.username,
          created_by: e.created_by,
          notes: unpackedNotes,
          site_url: unpackedSiteUrl,
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
            id, service_name, username, notes, created_at, created_by,
            creator:users!password_vault_created_by_fkey(id, name, email)
          )
        `)
        .eq('assigned_to', params.userId)
        .order('created_at', { ascending: false })

      if (error) throw new Error(`Failed to fetch vault entries: ${error.message}`)

      return (data || []).map((a: any) => {
        let unpackedNotes = ''
        let unpackedSiteUrl = ''
        if (a.vault?.notes) {
          try {
            const parsed = JSON.parse(a.vault.notes)
            if (parsed && typeof parsed === 'object') {
              unpackedNotes = parsed.notes || ''
              unpackedSiteUrl = parsed.site_url || ''
            } else {
              unpackedNotes = a.vault.notes
            }
          } catch {
            unpackedNotes = a.vault.notes
          }
        }

        return {
          id:            a.vault?.id,
          assignment_id: a.id,
          service_name:  a.vault?.service_name,
          username:      a.vault?.username,
          notes:         unpackedNotes,
          site_url:      unpackedSiteUrl,
          created_at:    a.vault?.created_at || a.created_at,
          created_by:    a.vault?.created_by,
          creator:       a.vault?.creator,
          is_revealed:   a.is_revealed,
        }
      })
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
