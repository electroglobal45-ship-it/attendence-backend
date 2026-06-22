import { supabaseAdmin } from '../../config/supabase'

export class EmployeesService {
  // Get all employees
  async getAllEmployees() {
    const { data: employees, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, category, department, designation, monthly_salary, joining_date, is_active, created_at')
      .neq('role', 'admin')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw new Error(`Failed to fetch employees: ${error.message}`)

    return employees || []
  }

  // Get employee by ID
  async getEmployeeById(id: string) {
    const { data: employee, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, category, department, designation, monthly_salary, joining_date, is_active, created_at')
      .eq('id', id)
      .neq('role', 'admin')
      .single()

    if (error) throw new Error(`Failed to fetch employee: ${error.message}`)

    return employee
  }
}
