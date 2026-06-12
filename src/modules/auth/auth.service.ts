import { supabaseAdmin, supabaseClient } from '../../config/supabase'

export class AuthService {
  // Login with email and password
  async login(email: string, password: string) {
    console.log('[Auth] Login attempt for:', email)
    
    // First, verify user exists in our users table
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())

    console.log('[Auth] User lookup result:', { 
      found: profiles && profiles.length > 0, 
      count: profiles?.length,
      error: profileError?.message 
    })

    if (profileError || !profiles || profiles.length === 0) {
      console.log('[Auth] User not found in database')
      throw new Error('Invalid email or password')
    }

    if (profiles.length > 1) {
      console.log('[Auth] Multiple users found with same email - data integrity issue')
      throw new Error('Account error - please contact admin')
    }

    const profile = profiles[0]
    console.log('[Auth] User found:', profile.email, 'role:', profile.role)

    if (!profile.is_active) {
      console.log('[Auth] User inactive')
      throw new Error('User account is inactive')
    }

    // Sign in with Supabase Auth using anon client
    console.log('[Auth] Signing in with Supabase Auth...')
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: password,
    })

    if (authError || !authData.session) {
      console.log('[Auth] Supabase Auth error:', authError?.message)
      throw new Error('Invalid email or password')
    }

    console.log('[Auth] Login successful!')

    return {
      token: authData.session.access_token,
      session: authData.session,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        category: profile.category,
      },
    }
  }

  // Refresh auth token
  async refreshToken(refreshToken: string) {
    console.log('[Auth] Refreshing token...')
    const { data, error } = await supabaseClient.auth.refreshSession({ refresh_token: refreshToken })

    if (error || !data.session) {
      console.log('[Auth] Refresh session error:', error?.message)
      throw new Error('Invalid or expired refresh token')
    }

    return {
      token: data.session.access_token,
      session: data.session,
    }
  }

  // Get user profile by ID
  async getUserProfile(userId: string) {
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, category, is_active')
      .eq('id', userId)
      .single()

    if (error) throw new Error('User not found')
    return profile
  }

  // Change password
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    // Get user
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      throw new Error('User not found')
    }

    // Verify old password
    if (user.password_hash !== oldPassword) {
      throw new Error('Current password is incorrect')
    }

    // Update password in users table
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ password_hash: newPassword })
      .eq('id', userId)

    if (updateError) {
      throw new Error('Failed to update password')
    }

    // Update in Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (authError) {
      console.error('Failed to update auth password:', authError)
    }

    return { success: true }
  }
}
