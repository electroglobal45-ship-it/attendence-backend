import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

// Service role client (bypasses RLS - use for admin operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Anon client (respects RLS - use for user operations)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

// Helper to get user from authorization token
export const getUserFromToken = async (token: string) => {
  // Verify token with Supabase Auth
  const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token)
  
  if (authError || !authUser) {
    throw new Error('Invalid or expired token')
  }
  
  // Fetch user profile from our users table
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, role, category, is_active')
    .eq('id', authUser.id)
    .single()
  
  if (error || !user) {
    throw new Error('User not found')
  }
  
  if (!user.is_active) {
    throw new Error('User account is inactive')
  }
  
  return user
}
