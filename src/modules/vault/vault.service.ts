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
        updated_by:         data.created_by,
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

  // ── Edit vault entry (with tracking & history backup) ──────────────────────
  async updateEntry(
    id: string,
    data: {
      service_name?: string
      username?: string
      password?: string
      notes?: string
      site_url?: string
      assigned_to?: string[]
    },
    editorId: string
  ) {
    // 1. Fetch current entry state before updating
    const { data: currentEntry, error: fetchCurrentErr } = await supabaseAdmin
      .from('password_vault')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchCurrentErr || !currentEntry) {
      throw new Error('Vault entry not found')
    }

    // 2. Backup the current state to history table
    const { error: historyErr } = await supabaseAdmin
      .from('password_vault_history')
      .insert({
        vault_id:           currentEntry.id,
        service_name:       currentEntry.service_name,
        username:           currentEntry.username,
        encrypted_password: currentEntry.encrypted_password,
        notes:              currentEntry.notes,
        site_url:           currentEntry.site_url || '',
        updated_by:         currentEntry.updated_by || currentEntry.created_by,
        created_at:         currentEntry.updated_at || currentEntry.created_at,
      })

    if (historyErr) {
      console.error('Failed to save password history:', historyErr.message)
    }

    // 3. Build updates list
    const updates: any = {}
    if (data.service_name !== undefined) updates.service_name = data.service_name
    if (data.username !== undefined) updates.username = data.username
    
    // Track editor
    updates.updated_by = editorId

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
      let currentSiteUrl = ""
      let currentNotes = ""
      if (currentEntry.notes) {
        try {
          const parsed = JSON.parse(currentEntry.notes)
          if (parsed && typeof parsed === 'object') {
            currentSiteUrl = parsed.site_url || ""
            currentNotes = parsed.notes || ""
          } else {
            currentNotes = currentEntry.notes
          }
        } catch {
          currentNotes = currentEntry.notes
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
        id, service_name, username, created_by, notes, created_at, encrypted_password, updated_by,
        creator:users!password_vault_created_by_fkey(id, name, email),
        editor:users!password_vault_updated_by_fkey(id, name, email),
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
      editor: data.editor,
      assignments: data.assignments,
      password,
    }
  }

  // ── List entries ──────────────────────────────────────────────────────────
  async listEntries(params: { userId: string; role: 'admin' | 'employee' }) {
    if (params.role === 'admin') {
      const { data, error } = await supabaseAdmin
        .from('password_vault')
        .select(`
          id, service_name, username, encrypted_password, created_by, notes, created_at, updated_by,
          creator:users!password_vault_created_by_fkey(id, name, email),
          editor:users!password_vault_updated_by_fkey(id, name, email),
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
          editor: e.editor,
          assignments: e.assignments,
          password,
        }
      })
    } else {
      // Fetch both assignments and entries created by this employee
      const [assignedRes, createdRes] = await Promise.all([
        supabaseAdmin
          .from('password_vault_assignments')
          .select(`
            id, vault_id, is_revealed,
            vault:password_vault(
              id, service_name, username, notes, created_at, created_by, updated_by,
              creator:users!password_vault_created_by_fkey(id, name, email),
              editor:users!password_vault_updated_by_fkey(id, name, email)
            )
          `)
          .eq('assigned_to', params.userId),
        supabaseAdmin
          .from('password_vault')
          .select(`
            id, service_name, username, notes, created_at, created_by, updated_by,
            creator:users!password_vault_created_by_fkey(id, name, email),
            editor:users!password_vault_updated_by_fkey(id, name, email),
            assignments:password_vault_assignments(
              id, assigned_to, is_revealed
            )
          `)
          .eq('created_by', params.userId)
      ])

      if (assignedRes.error) throw new Error(`Failed to fetch assigned vault entries: ${assignedRes.error.message}`)
      if (createdRes.error) throw new Error(`Failed to fetch created vault entries: ${createdRes.error.message}`)

      // Map assigned entries
      const assignedList = (assignedRes.data || []).map((a: any) => {
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
          editor:        a.vault?.editor,
          is_revealed:   a.is_revealed,
        }
      })

      // Map created entries
      const createdList = (createdRes.data || []).map((v: any) => {
        let unpackedNotes = ''
        let unpackedSiteUrl = ''
        if (v.notes) {
          try {
            const parsed = JSON.parse(v.notes)
            if (parsed && typeof parsed === 'object') {
              unpackedNotes = parsed.notes || ''
              unpackedSiteUrl = parsed.site_url || ''
            } else {
              unpackedNotes = v.notes
            }
          } catch {
            unpackedNotes = v.notes
          }
        }

        // Find if requesting user has an assignment record for their own vault entry
        const myAssignment = (v.assignments || []).find((a: any) => a.assigned_to === params.userId)

        return {
          id:            v.id,
          assignment_id: myAssignment?.id || null,
          service_name:  v.service_name,
          username:      v.username,
          notes:         unpackedNotes,
          site_url:      unpackedSiteUrl,
          created_at:    v.created_at,
          created_by:    v.created_by,
          creator:       v.creator,
          editor:        v.editor,
          is_revealed:   myAssignment ? myAssignment.is_revealed : true, // Creator inherently can view or has it active
        }
      })

      // Merge and remove duplicates by vault ID
      const mergedMap = new Map<string, any>()
      
      // Put assigned ones first
      assignedList.forEach(item => {
        if (item.id) mergedMap.set(item.id, item)
      })
      
      // Add created ones (will overwrite if duplicate, keeping created details)
      createdList.forEach(item => {
        if (item.id) mergedMap.set(item.id, item)
      })

      const mergedList = Array.from(mergedMap.values())
      
      // Sort by created_at descending
      mergedList.sort((a: any, b: any) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      return mergedList
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

  // ── History Listing ────────────────────────────────────────────────────────
  async getHistory(vaultId: string) {
    const { data, error } = await supabaseAdmin
      .from('password_vault_history')
      .select(`
        id, service_name, username, notes, created_at, encrypted_password, updated_by,
        editor:users!password_vault_history_updated_by_fkey(id, name, email)
      `)
      .eq('vault_id', vaultId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch history: ${error.message}`)

    return (data || []).map((h: any) => {
      let password = ''
      try {
        if (h.encrypted_password) {
          password = decryptPassword(h.encrypted_password)
        }
      } catch (err) {
        console.error("Failed to decrypt history password:", h.id, err)
      }

      let unpackedNotes = ''
      let unpackedSiteUrl = ''
      if (h.notes) {
        try {
          const parsed = JSON.parse(h.notes)
          if (parsed && typeof parsed === 'object') {
            unpackedNotes = parsed.notes || ''
            unpackedSiteUrl = parsed.site_url || ''
          } else {
            unpackedNotes = h.notes
          }
        } catch {
          unpackedNotes = h.notes
        }
      }

      return {
        id: h.id,
        service_name: h.service_name,
        username: h.username,
        notes: unpackedNotes,
        site_url: unpackedSiteUrl,
        created_at: h.created_at,
        editor: h.editor,
        password,
      }
    })
  }

  // ── History Revival ────────────────────────────────────────────────────────
  async reviveVersion(vaultId: string, historyId: string, editorId: string) {
    // 1. Fetch current active entry to save it to history before overwriting
    const { data: currentEntry, error: fetchCurrentErr } = await supabaseAdmin
      .from('password_vault')
      .select('*')
      .eq('id', vaultId)
      .single()

    if (fetchCurrentErr || !currentEntry) {
      throw new Error('Vault entry not found')
    }

    // 2. Fetch target history version
    const { data: targetHistory, error: fetchHistoryErr } = await supabaseAdmin
      .from('password_vault_history')
      .select('*')
      .eq('id', historyId)
      .single()

    if (fetchHistoryErr || !targetHistory) {
      throw new Error('History version not found')
    }

    // 3. Save current active entry to history logs
    await supabaseAdmin
      .from('password_vault_history')
      .insert({
        vault_id:           currentEntry.id,
        service_name:       currentEntry.service_name,
        username:           currentEntry.username,
        encrypted_password: currentEntry.encrypted_password,
        notes:              currentEntry.notes,
        site_url:           currentEntry.site_url || '',
        updated_by:         currentEntry.updated_by || currentEntry.created_by,
        created_at:         currentEntry.updated_at || currentEntry.created_at,
      })

    // 4. Overwrite active entry with history values
    const password_hash = await hashPassword(decryptPassword(targetHistory.encrypted_password))
    
    // Notes needs packing if it was saved unpacked or packed
    let notes_json = targetHistory.notes
    if (notes_json && !notes_json.startsWith('{')) {
      notes_json = JSON.stringify({
        site_url: targetHistory.site_url || '',
        notes: targetHistory.notes || ''
      })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('password_vault')
      .update({
        service_name:       targetHistory.service_name,
        username:           targetHistory.username,
        encrypted_password: targetHistory.encrypted_password,
        password_hash,
        notes:              notes_json,
        updated_by:         editorId,
      })
      .eq('id', vaultId)

    if (updateErr) throw new Error(`Failed to restore version: ${updateErr.message}`)

    // 5. Reset reveal status for all assignments since credential changed
    await supabaseAdmin
      .from('password_vault_assignments')
      .update({ is_revealed: false })
      .eq('vault_id', vaultId)

    return this._fetchEntry(vaultId)
  }

  // ── Global Password History (All versions of all passwords) ────────────────
  async getAllHistory() {
    const { data, error } = await supabaseAdmin
      .from('password_vault_history')
      .select(`
        id, vault_id, service_name, username, notes, created_at, encrypted_password, updated_by,
        editor:users!password_vault_history_updated_by_fkey(id, name, email)
      `)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch global history: ${error.message}`)

    return (data || []).map((h: any) => {
      let password = ''
      try {
        if (h.encrypted_password) {
          password = decryptPassword(h.encrypted_password)
        }
      } catch (err) {
        console.error("Failed to decrypt history password:", h.id, err)
      }

      let unpackedNotes = ''
      let unpackedSiteUrl = ''
      if (h.notes) {
        try {
          const parsed = JSON.parse(h.notes)
          if (parsed && typeof parsed === 'object') {
            unpackedNotes = parsed.notes || ''
            unpackedSiteUrl = parsed.site_url || ''
          } else {
            unpackedNotes = h.notes
          }
        } catch {
          unpackedNotes = h.notes
        }
      }

      return {
        id: h.id,
        vault_id: h.vault_id,
        service_name: h.service_name,
        username: h.username,
        notes: unpackedNotes,
        site_url: unpackedSiteUrl,
        created_at: h.created_at,
        editor: h.editor,
        updated_by: h.updated_by,
        password,
      }
    })
  }

  // ── Bulk Actions: Bulk delete ──────────────────────────────────────────────
  async bulkDelete(ids: string[]) {
    const { error } = await supabaseAdmin
      .from('password_vault')
      .delete()
      .in('id', ids)

    if (error) throw new Error(`Failed to bulk delete entries: ${error.message}`)
    return { success: true }
  }

  // ── Bulk Actions: Bulk assign ──────────────────────────────────────────────
  async bulkAssign(ids: string[], employeeIds: string[]) {
    if (!ids || ids.length === 0 || !employeeIds || employeeIds.length === 0) {
      throw new Error('Vault IDs and Employee IDs are required')
    }

    const rows: any[] = []
    ids.forEach(vaultId => {
      employeeIds.forEach(empId => {
        rows.push({
          vault_id:    vaultId,
          assigned_to: empId,
          is_revealed: false,
        })
      })
    })

    const { error } = await supabaseAdmin
      .from('password_vault_assignments')
      .upsert(rows, { onConflict: 'vault_id,assigned_to', ignoreDuplicates: true })

    if (error) throw new Error(`Failed to bulk assign entries: ${error.message}`)
    return { success: true }
  }
}
