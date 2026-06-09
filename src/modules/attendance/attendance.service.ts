import { supabaseAdmin } from '../../config/supabase'
import { getTodayIST, getCurrentTimeIST } from '../../utils/date'
import { uploadSelfieFromBase64 } from '../../utils/storage'

export class AttendanceService {
  // Get today's attendance for an employee
  async getTodayAttendance(employeeId: string) {
    const today = getTodayIST()
    
    const { data: attendance, error } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message)
    }

    return attendance
  }

  // Calculate distance between two GPS coordinates (Haversine formula)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => deg * (Math.PI / 180)
    const R = 6371 // Earth's radius in km
    
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Check if attendance is allowed (holidays/weekends)
  private async checkAttendanceAllowed(date: string, employeeId: string) {
    // Check if it's a holiday
    const { data: holidays } = await supabaseAdmin
      .from('holidays')
      .select('name, date')
      .eq('is_active', true)
      .eq('date', date)
      .maybeSingle()

    if (holidays) {
      // Check if employee has opt-in for this holiday
      const { data: optIn } = await supabaseAdmin
        .from('working_day_opt_ins')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', date)
        .maybeSingle()

      if (!optIn) {
        return { allowed: false, reason: `Today is ${holidays.name}. You can request to work on this day from the attendance page.` }
      }
    }

    // Check if it's weekend (Saturday = 6, Sunday = 0)
    const dayOfWeek = new Date(date).getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Check for opt-in
      const { data: optIn } = await supabaseAdmin
        .from('working_day_opt_ins')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', date)
        .maybeSingle()

      if (!optIn) {
        return { allowed: false, reason: 'Attendance not allowed on weekends. You can request to work on this day from the attendance page.' }
      }
    }

    return { allowed: true }
  }

  // Mark attendance (check-in) - with URL
  async markAttendanceWithURL(
    employeeId: string,
    latitude: number,
    longitude: number,
    accuracy: number,
    selfieUrl: string,
    address?: string
  ) {
    const today = getTodayIST()
    const now = new Date()

    // Check if already marked today
    const existing = await this.getTodayAttendance(employeeId)
    if (existing) {
      throw new Error('Attendance already marked for today')
    }

    // Check if attendance is allowed
    const attendanceCheck = await this.checkAttendanceAllowed(today, employeeId)
    if (!attendanceCheck.allowed) {
      throw new Error(attendanceCheck.reason || 'Attendance not allowed')
    }

    // Get office location
    const { data: officeLocation, error: officeError } = await supabaseAdmin
      .from('office_locations')
      .select('latitude, longitude, radius_meters, name')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (officeError || !officeLocation) {
      throw new Error('Office location not configured. Please ask admin to set up office coordinates.')
    }

    // Validate GPS distance
    const distance = this.calculateDistance(
      latitude,
      longitude,
      officeLocation.latitude,
      officeLocation.longitude
    )

    const allowedRadiusKm = officeLocation.radius_meters / 1000

    if (distance > allowedRadiusKm) {
      throw new Error(
        `You are ${distance.toFixed(2)} km away from ${officeLocation.name}. Please be within ${officeLocation.radius_meters}m to mark attendance.`
      )
    }

    // Check office hours (9 AM - 6:30 PM IST)
    const istOffset = 5.5 * 60 * 60 * 1000
    const istDate = new Date(now.getTime() + istOffset)
    const istHour = istDate.getUTCHours()
    const istMinute = istDate.getUTCMinutes()
    const totalMinutes = istHour * 60 + istMinute

    if (totalMinutes < 540) { // Before 9:00 AM
      throw new Error('Too early! Office hours start at 9:00 AM')
    }

    if (totalMinutes >= 1110) { // After 6:30 PM
      throw new Error('Office hours ended at 6:30 PM. Please contact admin to mark attendance.')
    }

    // Determine status based on time
    let status = 'present'
    let attendanceValue = 1.0
    let isLate = false

    if (totalMinutes <= 545) { // Up to 9:05 AM
      status = 'present'
      attendanceValue = 1.0
      isLate = false
    } else if (totalMinutes <= 570) { // Up to 9:30 AM
      status = 'late_within_buffer'
      attendanceValue = 1.0
      isLate = true
    } else { // After 9:30 AM
      status = 'half_day'
      attendanceValue = 0.5
      isLate = true
    }

    // Insert attendance record
    const { data: attendance, error: insertError } = await supabaseAdmin
      .from('attendance')
      .insert({
        employee_id: employeeId,
        date: today,
        check_in: now.toISOString(),
        status,
        selfie_url: selfieUrl,
        attendance_value: attendanceValue,
        is_late: isLate,
        late_count: isLate ? 1 : 0,
        gps_data: {
          latitude,
          longitude,
          accuracy,
          address: address || null,
          captured_at: now.toISOString(),
        },
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(insertError.message || 'Failed to mark attendance')
    }

    return {
      id: attendance.id,
      status,
      attendance_value: attendanceValue,
      is_late: isLate,
      check_in: attendance.check_in,
    }
  }

  // Upload selfie from base64
  async uploadSelfieFromBase64(employeeId: string, base64Data: string) {
    return await uploadSelfieFromBase64(employeeId, base64Data)
  }

  // Mark attendance (check-in)
  async markAttendance(
    employeeId: string,
    latitude: number,
    longitude: number,
    accuracy: number,
    selfieBase64: string,
    address?: string
  ) {
    // Upload selfie first
    const selfieUrl = await this.uploadSelfieFromBase64(employeeId, selfieBase64)
    
    // Then use the URL-based method
    return await this.markAttendanceWithURL(employeeId, latitude, longitude, accuracy, selfieUrl, address)
  }

  // Mark out (check-out) - with URL
  async markOutWithURL(
    employeeId: string,
    latitude?: number,
    longitude?: number,
    accuracy?: number,
    markoutSelfieUrl?: string,
    address?: string
  ) {
    const today = getTodayIST()
    const now = new Date()

    // Find today's attendance record
    const existing = await this.getTodayAttendance(employeeId)

    if (!existing) {
      throw new Error('No check-in record found for today')
    }

    if (existing.check_out) {
      throw new Error('Already marked out for today')
    }

    // Prepare update data
    const updateData: any = {
      check_out: now.toISOString(),
      updated_at: now.toISOString(),
    }

    // Handle markout GPS and selfie
    if (latitude && longitude) {
      updateData.gps_data = {
        ...(existing.gps_data || {}),
        markout: {
          latitude,
          longitude,
          accuracy: accuracy || 0,
          address: address || null,
          captured_at: now.toISOString(),
          selfie_url: markoutSelfieUrl || null,
        },
      }
    }

    // Check for early markout penalty (before 5:30 PM)
    const istOffset = 5.5 * 60 * 60 * 1000
    const istDate = new Date(now.getTime() + istOffset)
    const istHour = istDate.getUTCHours()
    const istMinute = istDate.getUTCMinutes()
    const totalMinutes = istHour * 60 + istMinute

    if (totalMinutes < 1050) { // Before 5:30 PM (17:30)
      const currentValue = existing.attendance_value || 1.0
      updateData.attendance_value = Math.max(0, currentValue - 0.5)
    }

    // Update attendance record
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('attendance')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(updateError.message || 'Failed to mark out')
    }

    return updated
  }

  // Mark out (check-out)
  async markOut(
    employeeId: string,
    latitude?: number,
    longitude?: number,
    accuracy?: number,
    markoutSelfieBase64?: string,
    address?: string
  ) {
    let markoutSelfieUrl: string | undefined = undefined

    if (markoutSelfieBase64) {
      markoutSelfieUrl = await uploadSelfieFromBase64(employeeId, markoutSelfieBase64)
    }

    return await this.markOutWithURL(employeeId, latitude, longitude, accuracy, markoutSelfieUrl, address)
  }

  // Get attendance history for an employee
  async getAttendanceHistory(employeeId: string, limit = 30) {
    const { data: records, error } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .order('date', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(error.message)
    }

    return records
  }
}
