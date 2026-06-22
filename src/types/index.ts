// User types
export interface User {
  id: string
  email: string
  role: 'admin' | 'employee' | 'hr' | 'team leader'
  name?: string
  user_metadata?: any
}

// Attendance types
export interface Attendance {
  id: string
  employee_id: string
  date: string
  check_in?: string
  check_out?: string
  status: 'present' | 'absent' | 'half_day' | 'leave'
  gps_location?: any
  selfie_url?: string
  created_at: string
  updated_at: string
}

// Leave types
export interface Leave {
  id: string
  employee_id: string
  leave_type: 'full_day' | 'half_day' | 'short_leave'
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

// Task types
export interface Task {
  id: string
  title: string
  description?: string
  status: string
  priority?: string
  assigned_to?: string
  board_id: string
  created_by: string
  due_date?: string
  created_at: string
  updated_at: string
}

// Board types
export interface Board {
  id: string
  name: string
  description?: string
  project_id?: string
  team_leader_id?: string
  created_by: string
  created_at: string
  updated_at: string
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
}
