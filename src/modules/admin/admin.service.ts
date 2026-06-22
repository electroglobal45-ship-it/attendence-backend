import { supabaseAdmin } from '../../config/supabase'

export class AdminService {
  // Get dashboard statistics
  async getDashboardStats() {
    const today = new Date().toISOString().split('T')[0]

    // Get total employees
    const { count: totalEmployees } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .neq('role', 'admin')
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
      query = query.eq('date', params.date)
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
    action: 'present' | 'absent' | 'half_day' | 'late_within_buffer' | 'mark_checkout',
    reason?: string,
    checkIn?: string,
    checkOut?: string
  ) {
    // Check if attendance record exists
    const { data: existing, error: findError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .maybeSingle()

    if (findError) throw new Error(`Failed to find attendance: ${findError.message}`)

    const getUtcTimeFromIst = (dateStr: string, timeStr: string): string => {
      const [year, month, day] = dateStr.split('-').map(Number)
      const [hour, minute] = timeStr.split(':').map(Number)
      const dateObj = new Date(Date.UTC(year, month - 1, day, hour, minute))
      dateObj.setMinutes(dateObj.getMinutes() - 330) // UTC is IST - 5:30
      return dateObj.toISOString()
    }

    const resolveTime = (dateStr: string, timeInput?: string, defaultTimeStr?: string): string | null => {
      if (!timeInput && !defaultTimeStr) return null
      const val = timeInput || defaultTimeStr
      if (!val) return null
      if (val.includes('T') && val.includes('Z')) {
        return val
      }
      return getUtcTimeFromIst(dateStr, val)
    }

    let status = 'present'
    let attendanceValue = 1.0
    let isLate = false
    let lateCount = 0
    let checkInVal: string | null = null
    let checkOutVal: string | null = null

    if (action === 'absent') {
      status = 'absent'
      attendanceValue = 0.0
      isLate = false
      lateCount = 0
      checkInVal = null
      checkOutVal = null
    } else if (action === 'half_day') {
      status = 'half_day'
      attendanceValue = 0.5
      isLate = true
      lateCount = 1
      checkInVal = resolveTime(date, checkIn) || existing?.check_in || resolveTime(date, undefined, '10:00')
      checkOutVal = resolveTime(date, checkOut) || existing?.check_out || resolveTime(date, undefined, '18:00')
    } else if (action === 'present') {
      status = 'present'
      attendanceValue = 1.0
      isLate = false
      lateCount = 0
      checkInVal = resolveTime(date, checkIn) || existing?.check_in || resolveTime(date, undefined, '09:00')
      checkOutVal = resolveTime(date, checkOut) || existing?.check_out || resolveTime(date, undefined, '18:00')
    } else if (action === 'late_within_buffer') {
      status = 'late_within_buffer'
      attendanceValue = 1.0
      isLate = true
      lateCount = 1
      checkInVal = resolveTime(date, checkIn) || existing?.check_in || resolveTime(date, undefined, '09:15')
      checkOutVal = resolveTime(date, checkOut) || existing?.check_out || resolveTime(date, undefined, '18:00')
    } else if (action === 'mark_checkout') {
      status = existing?.status || 'present'
      attendanceValue = existing?.attendance_value !== undefined ? existing.attendance_value : 1.0
      isLate = existing?.is_late || false
      lateCount = existing?.late_count || 0
      checkInVal = resolveTime(date, checkIn) || existing?.check_in || resolveTime(date, undefined, '09:00')
      checkOutVal = resolveTime(date, checkOut) || new Date().toISOString()
    }

    let result
    const recordData = {
      employee_id: employeeId,
      date: date,
      status,
      attendance_value: attendanceValue,
      is_late: isLate,
      late_count: lateCount,
      check_in: checkInVal,
      check_out: checkOutVal,
      admin_marked: true,
      admin_reason: reason || `Manual override to ${action.replace(/_/g, ' ')}`,
      updated_at: new Date().toISOString()
    }

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('attendance')
        .update(recordData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw new Error(`Failed to update attendance: ${error.message}`)
      result = data
    } else {
      const { data, error } = await supabaseAdmin
        .from('attendance')
        .insert(recordData)
        .select()
        .single()

      if (error) throw new Error(`Failed to create attendance: ${error.message}`)
      result = data
    }

    return result
  }
}
