import { supabaseAdmin } from '../../config/supabase'

export class LeavesService {
  // Get leave requests (admin can see all, employee sees own)
  async getLeaveRequests(params?: {
    userId?: string
    all?: boolean
  }) {
    let query = supabaseAdmin
      .from('leave_requests')
      .select(`
        *,
        users!leave_requests_employee_id_fkey(id, name, email)
      `)
      .order('created_at', { ascending: false })

    if (params?.userId && !params.all) {
      query = query.eq('employee_id', params.userId)
    }

    const { data: leaves, error } = await query

    if (error) throw new Error(`Failed to fetch leave requests: ${error.message}`)

    const formatted = leaves?.map(leave => ({
      ...leave,
      user_name: leave.users?.name || 'Unknown',
      user_email: leave.users?.email || '',
      users: leave.users
    }))

    return formatted || []
  }

  // Apply for leave
  async applyLeave(data: {
    employee_id: string
    type: string
    start_date: string
    end_date: string
    reason: string
  }) {
    const { data: leave, error } = await supabaseAdmin
      .from('leave_requests')
      .insert({
        ...data,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to apply leave: ${error.message}`)

    return leave
  }

  // Get short leaves (admin can see all, employee sees own)
  async getShortLeaves(params?: {
    userId?: string
    all?: boolean
  }) {
    let query = supabaseAdmin
      .from('short_leaves')
      .select(`
        *,
        users!short_leaves_employee_id_fkey(id, name, email)
      `)
      .order('created_at', { ascending: false })

    if (params?.userId && !params.all) {
      query = query.eq('employee_id', params.userId)
    }

    const { data: leaves, error } = await query

    if (error) throw new Error(`Failed to fetch short leaves: ${error.message}`)

    const formatted = leaves?.map(leave => ({
      ...leave,
      user_name: leave.users?.name || 'Unknown',
      user_email: leave.users?.email || '',
      users: leave.users
    }))

    return formatted || []
  }

  // Request short leave
  async requestShortLeave(data: {
    employee_id: string
    date: string
    short_leave_type: string
    reason: string
  }) {
    const { data: leave, error } = await supabaseAdmin
      .from('short_leaves')
      .insert({
        ...data,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create short leave: ${error.message}`)

    return leave
  }

  // Update short leave status (admin only)
  async updateShortLeaveStatus(
    leaveId: string,
    status: 'approved' | 'rejected',
    adminNotes?: string
  ) {
    const { data: leave, error } = await supabaseAdmin
      .from('short_leaves')
      .update({
        status,
        admin_notes: adminNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', leaveId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update short leave: ${error.message}`)

    return leave
  }
}
