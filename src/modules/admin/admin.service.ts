import { supabaseAdmin } from '../../config/supabase'

export class AdminService {
  // Get dashboard statistics
  async getDashboardStats() {
    const today = new Date().toISOString().split('T')[0]

    // Get total employees
    const { count: totalEmployees } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'employee')
      .eq('is_active', true)

    // Get today's attendance
    const { count: presentToday } = await supabaseAdmin
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .gte('check_in', `${today}T00:00:00`)
      .lte('check_in', `${today}T23:59:59`)

    // Get pending leave requests
    const { count: pendingLeaves } = await supabaseAdmin
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    // Get pending short leaves
    const { count: pendingShortLeaves } = await supabaseAdmin
      .from('short_leaves')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    // Get active tasks
    const { count: activeTasks } = await supabaseAdmin
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .in('status', ['todo', 'in_progress', 'review'])

    return {
      totalEmployees: totalEmployees || 0,
      presentToday: presentToday || 0,
      absentToday: (totalEmployees || 0) - (presentToday || 0),
      pendingLeaves: pendingLeaves || 0,
      pendingShortLeaves: pendingShortLeaves || 0,
      activeTasks: activeTasks || 0
    }
  }

  // Get all attendance records (admin view)
  async getAllAttendance(params?: {
    date?: string
    employeeId?: string
    limit?: number
  }) {
    let query = supabaseAdmin
      .from('attendance')
      .select(`
        *,
        user:users(id, name, email)
      `)
      .order('check_in', { ascending: false })

    if (params?.date) {
      query = query.gte('check_in', `${params.date}T00:00:00`)
                   .lte('check_in', `${params.date}T23:59:59`)
    }

    if (params?.employeeId) {
      query = query.eq('user_id', params.employeeId)
    }

    if (params?.limit) {
      query = query.limit(params.limit)
    }

    const { data: records, error } = await query

    if (error) throw new Error(`Failed to fetch attendance: ${error.message}`)

    const formatted = records?.map(record => ({
      ...record,
      user_name: record.user?.name || 'Unknown',
      user_email: record.user?.email || '',
      user: undefined
    }))

    return formatted || []
  }

  // Get all leave requests (admin view)
  async getAllLeaveRequests(status?: string) {
    let query = supabaseAdmin
      .from('leave_requests')
      .select(`
        *,
        users!leave_requests_employee_id_fkey(id, name, email)
      `)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: leaves, error } = await query

    if (error) throw new Error(`Failed to fetch leaves: ${error.message}`)

    const formatted = leaves?.map(leave => ({
      ...leave,
      users: leave.users || { id: leave.employee_id, name: 'Unknown', email: '' }
    }))

    return formatted || []
  }

  // Approve/reject leave request
  async updateLeaveStatus(leaveId: string, status: 'approved' | 'rejected', adminNotes?: string) {
    const { data: leave, error } = await supabaseAdmin
      .from('leave_requests')
      .update({
        status,
        admin_notes: adminNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', leaveId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update leave: ${error.message}`)

    return leave
  }

  // Admin manually marks attendance
  async markAttendance(
    employeeId: string, 
    date: string, 
    action: 'absent' | 'half_day' | 'mark_checkout',
    reason?: string
  ) {
    // Check if attendance record exists
    const { data: existing, error: findError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .maybeSingle()

    if (findError) throw new Error(`Failed to find attendance: ${findError.message}`)

    let result

    if (action === 'absent') {
      // Mark as absent
      if (existing) {
        const { data, error } = await supabaseAdmin
          .from('attendance')
          .update({
            status: 'absent',
            attendance_value: 0,
            admin_marked: true,
            admin_reason: reason || 'Marked absent by admin',
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw new Error(`Failed to update attendance: ${error.message}`)
        result = data
      } else {
        const { data, error } = await supabaseAdmin
          .from('attendance')
          .insert({
            employee_id: employeeId,
            date: date,
            status: 'absent',
            attendance_value: 0,
            admin_marked: true,
            admin_reason: reason || 'Marked absent by admin',
          })
          .select()
          .single()

        if (error) throw new Error(`Failed to create attendance: ${error.message}`)
        result = data
      }
    } else if (action === 'half_day') {
      if (!existing) {
        throw new Error('Cannot mark half day without check-in record')
      }

      const { data, error } = await supabaseAdmin
        .from('attendance')
        .update({
          status: 'half_day',
          attendance_value: 0.5,
          admin_marked: true,
          admin_reason: reason || 'Marked half day by admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw new Error(`Failed to update attendance: ${error.message}`)
      result = data
    } else if (action === 'mark_checkout') {
      if (!existing || !existing.check_in) {
        throw new Error('Cannot mark checkout without check-in record')
      }

      if (existing.check_out) {
        throw new Error('Already checked out')
      }

      const { data, error } = await supabaseAdmin
        .from('attendance')
        .update({
          check_out: new Date().toISOString(),
          admin_marked: true,
          admin_reason: reason || 'Checkout marked by admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw new Error(`Failed to update attendance: ${error.message}`)
      result = data
    }

    return result
  }
}
