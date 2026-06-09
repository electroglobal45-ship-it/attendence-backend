import { supabaseAdmin } from '../../config/supabase'

export class EmployeesService {
  // Get all employees
  async getAllEmployees() {
    const { data: employees, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, category, is_active, created_at')
      .eq('role', 'employee')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw new Error(`Failed to fetch employees: ${error.message}`)

    return employees || []
  }

  // Get employee by ID
  async getEmployeeById(id: string) {
    const { data: employee, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, category, is_active, created_at')
      .eq('id', id)
      .eq('role', 'employee')
      .single()

    if (error) throw new Error(`Failed to fetch employee: ${error.message}`)

    return employee
  }
}
