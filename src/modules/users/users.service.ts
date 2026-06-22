import { supabaseAdmin, supabaseClient } from '../../config/supabase'

export class UsersService {
  // Get all users
  async getAllUsers() {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, category, is_active, created_at')
      .order('name', { ascending: true })

    if (error) throw new Error(`Failed to fetch users: ${error.message}`)

    return users || []
  }

  // Get user by ID
  async getUserById(id: string) {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, category, is_active, created_at')
      .eq('id', id)
      .single()

    if (error) throw new Error(`Failed to fetch user: ${error.message}`)

    return user
  }

  // Create new user (admin only)
  async createUser(data: {
    email: string
    name: string
    password: string
    role: 'admin' | 'employee' | 'hr' | 'team leader'
    category?: string
    department?: string
    designation?: string
    monthly_salary?: number
    joining_date?: string
  }) {
    const { email, name, password, role, category, department, designation, monthly_salary, joining_date } = data

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name,
        role: role
      }
    })

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`)
    }

    // Create user in public.users table
    const { data: publicUser, error: publicError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: email.toLowerCase(),
        name: name,
        password_hash: password, // Plain text for backend validation
        role: role,
        category: category || 'regular',
        department: department || null,
        designation: designation || null,
        monthly_salary: monthly_salary || 0,
        joining_date: joining_date || new Date().toISOString().split('T')[0],
        is_active: true
      })
      .select()
      .single()

    if (publicError) {
      // If public.users insert fails, delete the auth user to maintain consistency
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw new Error(`Failed to create user profile: ${publicError.message}`)
    }

    return publicUser
  }

  // Update user
  async updateUser(userId: string, updates: {
    name?: string
    email?: string
    role?: string
    category?: string
    is_active?: boolean
  }) {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update user: ${error.message}`)

    // If email or role is updated, update in auth.users too
    if (updates.email || updates.role) {
      const authUpdates: any = {}
      if (updates.email) authUpdates.email = updates.email
      if (updates.role) {
        authUpdates.user_metadata = { role: updates.role }
      }
      await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates)
    }

    return user
  }

  // Delete user
  async deleteUser(userId: string) {
    // Delete from public.users first
    const { error: publicError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)

    if (publicError) {
      throw new Error(`Failed to delete user: ${publicError.message}`)
    }

    // Delete from auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Failed to delete auth user:', authError.message)
      // Don't throw error here as public user is already deleted
    }

    return { success: true }
  }

  // Change user password
  async changeUserPassword(userId: string, newPassword: string) {
    // Update password in auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    })

    if (authError) {
      throw new Error(`Failed to update auth password: ${authError.message}`)
    }

    // Update password_hash in public.users
    const { error: publicError } = await supabaseAdmin
      .from('users')
      .update({ password_hash: newPassword, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (publicError) {
      throw new Error(`Failed to update user password: ${publicError.message}`)
    }

    return { success: true }
  }
}
