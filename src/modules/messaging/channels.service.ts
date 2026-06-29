import { supabaseAdmin } from '../../config/supabase'

export class ChannelsService {
  // Get all channels user has access to
  async getUserChannels(userId: string) {
    const { data: channels, error } = await supabaseAdmin
      .from('channels')
      .select(`
        *,
        channel_members!inner(
          user_id,
          role,
          last_read_at,
          notifications_enabled
        )
      `)
      .eq('channel_members.user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })

    if (error) throw new Error(`Failed to fetch channels: ${error.message}`)

    return channels || []
  }

  // Get channel by ID with members
  async getChannelById(channelId: string, userId: string, userSystemRole?: string) {
    // Verify access
    const hasAccess = await this.verifyChannelAccess(userId, channelId, userSystemRole)
    if (!hasAccess) {
      throw new Error('Access denied to this channel')
    }

    const { data: channel, error } = await supabaseAdmin
      .from('channels')
      .select(`
        *,
        created_by_user:users!channels_created_by_fkey(id, name, email),
        channel_members(
          id,
          role,
          joined_at,
          user:users(id, name, email)
        )
      `)
      .eq('id', channelId)
      .single()

    if (error) throw new Error(`Failed to fetch channel: ${error.message}`)

    return channel
  }

  // Create new channel
  async createChannel(data: {
    name: string
    description?: string
    type: 'public' | 'private'
    topic?: string
    purpose?: string
    createdBy: string
    members?: string[] // user IDs to add
  }) {
    // Create channel
    const { data: channel, error } = await supabaseAdmin
      .from('channels')
      .insert({
        name: data.name,
        description: data.description,
        type: data.type,
        topic: data.topic,
        purpose: data.purpose,
        created_by: data.createdBy
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create channel: ${error.message}`)

    // Add creator as owner
    const { error: creatorError } = await supabaseAdmin
      .from('channel_members')
      .insert({
        channel_id: channel.id,
        user_id: data.createdBy,
        role: 'owner'
      })

    if (creatorError) {
      console.error('Failed to add channel creator:', creatorError)
      throw new Error(`Failed to add creator to channel: ${creatorError.message}`)
    }

    // Add other members
    if (data.members && data.members.length > 0) {
      const membersToAdd = data.members.map(userId => ({
        channel_id: channel.id,
        user_id: userId,
        role: 'member' as const
      }))

      const { error: membersError } = await supabaseAdmin
        .from('channel_members')
        .insert(membersToAdd)

      if (membersError) {
        console.error('Failed to add channel members:', membersError)
        throw new Error(`Failed to add members to channel: ${membersError.message}`)
      }
    }

    return channel
  }

  // Update channel
  async updateChannel(channelId: string, userId: string, updates: {
    name?: string
    description?: string
    topic?: string
    purpose?: string
  }, userSystemRole?: string) {
    // Verify user is owner or admin
    const isAuthorized = await this.verifyChannelAdmin(userId, channelId, userSystemRole)
    if (!isAuthorized) {
      throw new Error('Only channel owners/admins can update channels')
    }

    const { data: channel, error } = await supabaseAdmin
      .from('channels')
      .update(updates)
      .eq('id', channelId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update channel: ${error.message}`)

    return channel
  }

  // Archive channel
  async archiveChannel(channelId: string, userId: string, userSystemRole?: string) {
    const isAuthorized = await this.verifyChannelAdmin(userId, channelId, userSystemRole)
    if (!isAuthorized) {
      throw new Error('Only channel owners/admins can archive channels')
    }

    const { error } = await supabaseAdmin
      .from('channels')
      .update({ is_archived: true })
      .eq('id', channelId)

    if (error) throw new Error(`Failed to archive channel: ${error.message}`)

    return { success: true }
  }

  // Add member to channel
  async addMember(channelId: string, userId: string, memberUserId: string, role: 'admin' | 'member' = 'member', userSystemRole?: string) {
    const isAuthorized = await this.verifyChannelAdmin(userId, channelId, userSystemRole)
    if (!isAuthorized) {
      throw new Error('Only channel owners/admins can add members')
    }

    const { data: member, error } = await supabaseAdmin
      .from('channel_members')
      .insert({
        channel_id: channelId,
        user_id: memberUserId,
        role
      })
      .select(`
        *,
        users:user_id (id, name, email)
      `)
      .single()

    if (error) throw new Error(`Failed to add member: ${error.message}`)

    const u = Array.isArray((member as any).users) ? (member as any).users[0] : (member as any).users
    return {
      id: u?.id || memberUserId,
      name: u?.name || 'User',
      email: u?.email || '',
      role: member.role || 'member',
      joined_at: member.joined_at || new Date().toISOString()
    }
  }

  // Remove member from channel
  async removeMember(channelId: string, userId: string, memberUserId: string, userSystemRole?: string) {
    const isAuthorized = await this.verifyChannelAdmin(userId, channelId, userSystemRole)
    if (!isAuthorized) {
      throw new Error('Only channel owners/admins can remove members')
    }

    const { error } = await supabaseAdmin
      .from('channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', memberUserId)

    if (error) throw new Error(`Failed to remove member: ${error.message}`)

    return { success: true }
  }

  // Join public channel
  async joinChannel(channelId: string, userId: string) {
    // Verify it's a public channel
    const { data: channel } = await supabaseAdmin
      .from('channels')
      .select('type')
      .eq('id', channelId)
      .single()

    if (channel?.type !== 'public') {
      throw new Error('Can only join public channels')
    }

    const { data: member, error } = await supabaseAdmin
      .from('channel_members')
      .insert({
        channel_id: channelId,
        user_id: userId,
        role: 'member'
      })
      .select(`
        *,
        users:user_id (id, name, email)
      `)
      .single()

    if (error) throw new Error(`Failed to join channel: ${error.message}`)

    return member
  }

  // Leave channel
  async leaveChannel(channelId: string, userId: string) {
    const { error } = await supabaseAdmin
      .from('channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId)

    if (error) throw new Error(`Failed to leave channel: ${error.message}`)

    return { success: true }
  }

  // Helper: Verify channel access
  async verifyChannelAccess(userId: string, channelId: string, userSystemRole?: string): Promise<boolean> {
    // System admins and HR always have access
    if (userSystemRole && ['admin', 'hr'].includes(userSystemRole)) {
      return true
    }

    const { data: channel } = await supabaseAdmin
      .from('channels')
      .select('type, created_by')
      .eq('id', channelId)
      .maybeSingle()

    if (channel) {
      if (channel.type === 'public') return true
      if (String(channel.created_by) === String(userId)) return true
    }

    const { data } = await supabaseAdmin
      .from('channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .maybeSingle()

    return !!data
  }

  // Helper: Verify channel admin
  async verifyChannelAdmin(userId: string, channelId: string, userSystemRole?: string): Promise<boolean> {
    // System admins and HR always have channel admin privileges
    if (userSystemRole && ['admin', 'hr'].includes(userSystemRole)) {
      return true
    }

    const { data: channel } = await supabaseAdmin
      .from('channels')
      .select('created_by')
      .eq('id', channelId)
      .maybeSingle()

    if (channel && String(channel.created_by) === String(userId)) {
      return true
    }

    const { data } = await supabaseAdmin
      .from('channel_members')
      .select('role')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .in('role', ['owner', 'admin'])
      .maybeSingle()

    return !!data
  }

  // Get channel members
  async getMembers(channelId: string) {
    const { data: members, error } = await supabaseAdmin
      .from('channel_members')
      .select(`
        role,
        joined_at,
        users:user_id (
          id,
          name,
          email
        )
      `)
      .eq('channel_id', channelId)

    if (error) throw new Error(`Failed to fetch channel members: ${error.message}`)

    return (members || [])
      .map((m: any) => {
        const u = Array.isArray(m.users) ? m.users[0] : m.users
        if (!u) return null
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: m.role || 'member',
          joined_at: m.joined_at || new Date().toISOString()
        }
      })
      .filter((m): m is any => m !== null)
  }

  // Delete channel
  async deleteChannel(channelId: string) {
    await supabaseAdmin
      .from('messages')
      .delete()
      .eq('channel_id', channelId)

    await supabaseAdmin
      .from('channel_members')
      .delete()
      .eq('channel_id', channelId)

    const { error } = await supabaseAdmin
      .from('channels')
      .delete()
      .eq('id', channelId)

    if (error) throw new Error(`Failed to delete channel: ${error.message}`)
    return { success: true }
  }
}
