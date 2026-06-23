import { supabaseAdmin } from '../../config/supabase'

export class MeetingsService {
  // ── List all meetings ──────────────────────────────────────────────────────
  async listMeetings(params: { userId: string; role: string }) {
    const nowISO = new Date().toISOString()
    
    // Auto-expire scheduled meetings that haven't started within 15 minutes of their scheduled time
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    try {
      await supabaseAdmin
        .from('meetings')
        .update({ ended_at: nowISO })
        .is('started_at', null)
        .is('ended_at', null)
        .is('is_permanent', false)
        .lt('scheduled_at', fifteenMinsAgo)
    } catch (err) {
      console.error("Failed to auto-expire scheduled meetings:", err)
    }

    if (params.role === 'admin') {
      const { data, error } = await supabaseAdmin
        .from('meetings')
        .select(`
          id, title, room_name, is_permanent, scheduled_at, started_at, ended_at, created_by, created_at,
          creator:users!meetings_created_by_fkey(id, name, email),
          assignments:meeting_assignments(
            id, user_id,
            assignee:users!meeting_assignments_user_id_fkey(id, name, email)
          )
        `)
        .is('ended_at', null)
        .order('is_permanent', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw new Error(`Failed to fetch meetings: ${error.message}`)
      return data || []
    } else {
      // Employees see:
      // 1. All permanent meetings (daily standups)
      // 2. Meetings created by them
      // 3. Meetings they are assigned to

      // Step A: Fetch all active meetings
      const { data: allMeetings, error } = await supabaseAdmin
        .from('meetings')
        .select(`
          id, title, room_name, is_permanent, scheduled_at, started_at, ended_at, created_by, created_at,
          creator:users!meetings_created_by_fkey(id, name, email),
          assignments:meeting_assignments(
            id, user_id,
            assignee:users!meeting_assignments_user_id_fkey(id, name, email)
          )
        `)
        .is('ended_at', null)
        .order('is_permanent', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw new Error(`Failed to fetch meetings: ${error.message}`)

      // Step B: Filter in-memory
      const filtered = (allMeetings || []).filter((meeting) => {
        if (meeting.is_permanent) return true
        if (meeting.created_by === params.userId) return true
        if (meeting.assignments?.some((a: any) => a.user_id === params.userId)) return true
        return false
      })

      return filtered
    }
  }

  // ── Create a meeting ───────────────────────────────────────────────────────
  async createMeeting(data: {
    title: string
    is_permanent?: boolean
    scheduled_at?: string
    created_by: string
    role: string
    assigned_to?: string[] // array of user UUIDs
  }) {
    if (!data.title || data.title.trim() === '') {
      throw new Error('Meeting title is required')
    }

    // Only Admins can create permanent daily standups
    if (data.is_permanent && data.role !== 'admin') {
      throw new Error('Only administrators are authorized to create permanent daily standup meetings')
    }

    // Generate a secure Jitsi-safe unique room name
    const randomSuffix = Math.random().toString(36).substring(2, 10)
    const cleanTitle   = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    const room_name    = `electroglobal-${cleanTitle || 'room'}-${randomSuffix}`

    const { data: meeting, error } = await supabaseAdmin
      .from('meetings')
      .insert({
        title:        data.title,
        room_name,
        is_permanent: data.is_permanent || false,
        scheduled_at: data.scheduled_at || null,
        created_by:   data.created_by,
      })
      .select('id')
      .single()

    if (error) throw new Error(`Failed to create meeting: ${error.message}`)

    // Handle assignments if any
    if (data.assigned_to && data.assigned_to.length > 0) {
      const rows = data.assigned_to.map(userId => ({
        meeting_id: meeting.id,
        user_id:    userId,
      }))

      const { error: assignErr } = await supabaseAdmin
        .from('meeting_assignments')
        .insert(rows)

      if (assignErr) {
        // Rollback meeting insertion if assignments fail
        await supabaseAdmin.from('meetings').delete().eq('id', meeting.id)
        throw new Error(`Failed to create meeting assignments: ${assignErr.message}`)
      }
    }

    return this._fetchMeetingDetails(meeting.id)
  }

  // Helper to fetch details of a single meeting
  private async _fetchMeetingDetails(id: string) {
    const { data, error } = await supabaseAdmin
      .from('meetings')
      .select(`
        id, title, room_name, is_permanent, scheduled_at, started_at, ended_at, created_by, created_at,
        creator:users!meetings_created_by_fkey(id, name, email),
        assignments:meeting_assignments(
          id, user_id,
          assignee:users!meeting_assignments_user_id_fkey(id, name, email)
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw new Error(`Failed to fetch meeting details: ${error.message}`)
    return data
  }

  // ── Delete a meeting ───────────────────────────────────────────────────────
  async deleteMeeting(id: string, userId: string, role: string) {
    // Check if the meeting exists
    const { data: meeting, error: fetchErr } = await supabaseAdmin
      .from('meetings')
      .select('id, created_by, is_permanent')
      .eq('id', id)
      .single()

    if (fetchErr || !meeting) throw new Error('Meeting not found')

    // Permanent daily rooms cannot be deleted by normal users
    if (meeting.is_permanent && role !== 'admin') {
      throw new Error('Only administrators can delete permanent daily standup meetings')
    }

    // Normal employees can only delete meetings they created
    if (role !== 'admin' && meeting.created_by !== userId) {
      throw new Error('You do not have permission to delete this meeting')
    }

    const { error } = await supabaseAdmin
      .from('meetings')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete meeting: ${error.message}`)
    return { success: true }
  }

  // ── Start a meeting ────────────────────────────────────────────────────────
  async startMeeting(id: string, userId: string, role: string) {
    const { data: meeting, error: fetchErr } = await supabaseAdmin
      .from('meetings')
      .select('id, created_by, is_permanent')
      .eq('id', id)
      .single()

    if (fetchErr || !meeting) throw new Error('Meeting not found')

    // Only host (creator) or admin can start the meeting
    if (role !== 'admin' && meeting.created_by !== userId) {
      throw new Error('Only the meeting host can start the meeting')
    }

    const { error } = await supabaseAdmin
      .from('meetings')
      .update({
        started_at: new Date().toISOString(),
        ended_at: null
      })
      .eq('id', id)

    if (error) throw new Error(`Failed to start meeting: ${error.message}`)
    return this._fetchMeetingDetails(id)
  }

  // ── End a meeting ──────────────────────────────────────────────────────────
  async endMeeting(id: string, userId: string, role: string) {
    const { data: meeting, error: fetchErr } = await supabaseAdmin
      .from('meetings')
      .select('id, created_by, is_permanent')
      .eq('id', id)
      .single()

    if (fetchErr || !meeting) throw new Error('Meeting not found')

    // Only host (creator) or admin can end the meeting
    if (role !== 'admin' && meeting.created_by !== userId) {
      throw new Error('Only the meeting host can end the meeting')
    }

    const { error } = await supabaseAdmin
      .from('meetings')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw new Error(`Failed to end meeting: ${error.message}`)
    return this._fetchMeetingDetails(id)
  }

  // ── Heartbeat Ping for active participants ─────────────────────────────────
  async pingMeeting(id: string, userId: string) {
    try {
      // 1. Check if meeting is already ended
      const { data: meeting, error: fetchErr } = await supabaseAdmin
        .from('meetings')
        .select('id, is_permanent, started_at, ended_at')
        .eq('id', id)
        .single()

      if (fetchErr || !meeting) {
        return { ended: true, activeParticipantsCount: 0 }
      }
      if (meeting.ended_at) {
        return { ended: true, activeParticipantsCount: 0 }
      }

      // 2. Upsert ping for this user
      const { error: upsertErr } = await supabaseAdmin
        .from('meeting_participants')
        .upsert({
          meeting_id: id,
          user_id: userId,
          last_ping: new Date().toISOString()
        }, {
          onConflict: 'meeting_id,user_id'
        })

      if (upsertErr) {
        console.error("Upsert ping failed:", upsertErr)
        return { ended: true, activeParticipantsCount: 0 }
      }

      // 3. Clean up stale pings (>30 seconds)
      const thirtySecsAgo = new Date(Date.now() - 30 * 1000).toISOString()
      await supabaseAdmin
        .from('meeting_participants')
        .delete()
        .eq('meeting_id', id)
        .lt('last_ping', thirtySecsAgo)

      // 4. Count remaining active participants
      const { data: participants, error: countErr } = await supabaseAdmin
        .from('meeting_participants')
        .select('user_id')
        .eq('meeting_id', id)

      const activeCount = participants?.length || 0

      // 5. If the meeting was started, and everyone left (count = 0), and it is not permanent, end it
      if (meeting.started_at && activeCount === 0 && !meeting.is_permanent) {
        await supabaseAdmin
          .from('meetings')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', id)

        return { ended: true, activeParticipantsCount: 0 }
      }

      return { ended: false, activeParticipantsCount: activeCount }
    } catch (err: any) {
      console.error("Error in pingMeeting:", err)
      return { ended: true, activeParticipantsCount: 0 }
    }
  }
}
