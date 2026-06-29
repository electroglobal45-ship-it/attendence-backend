import { supabaseAdmin } from '../../config/supabase'

export class ConversationsService {
  // Get all conversations for a user
  async getUserConversations(userId: string) {
    const { data: convData, error } = await supabaseAdmin
      .from('conversation_participants')
      .select(`
        conversation_id,
        conversations:conversation_id (
          id,
          type,
          name,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)

    if (error) throw new Error(`Failed to fetch conversations: ${error.message}`)
    const data = convData || []

    // Get all conversation IDs
    const conversationIds = data.map(d => d.conversation_id)

    if (conversationIds.length === 0) {
      return []
    }

    // Get other participants for each conversation
    const { data: allParticipants, error: participantsError } = await supabaseAdmin
      .from('conversation_participants')
      .select(`
        conversation_id,
        user_id,
        users:user_id (
          id,
          name,
          email,
          role
        )
      `)
      .in('conversation_id', conversationIds)

    if (participantsError) throw new Error(`Failed to fetch participants: ${participantsError.message}`)

    // Build conversations with participants
    const conversations = data.map(item => {
      const conversation = Array.isArray(item.conversations) ? item.conversations[0] : item.conversations
      const participants = allParticipants
        .filter(p => p.conversation_id === conversation.id)
        .map(p => Array.isArray(p.users) ? p.users[0] : p.users)
      
      // For direct messages, find the other user
      const otherUser = conversation.type === 'direct' 
        ? participants.find(p => p.id !== userId)
        : null

      return {
        ...conversation,
        participants,
        other_user: otherUser
      }
    })

    return conversations
  }

  // Create a new conversation
  async createConversation(data: {
    type: 'direct' | 'group'
    participant_ids: string[]
    created_by: string
    name?: string
  }) {
    const { type, participant_ids, created_by, name } = data

    // Check if direct conversation already exists
    if (type === 'direct' && participant_ids.length === 1) {
      const otherUserId = participant_ids[0]
      
      // Find existing direct conversation between these two users
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id, conversations:conversation_id(id, type)')
        .eq('user_id', created_by)

      if (!existingError && existing) {
        for (const item of existing) {
          const conversation = Array.isArray(item.conversations) ? item.conversations[0] : item.conversations
          if (conversation.type === 'direct') {
            // Check if other user is in this conversation
            const { data: otherParticipant } = await supabaseAdmin
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', conversation.id)
              .eq('user_id', otherUserId)
              .single()

            if (otherParticipant) {
              // Conversation already exists, return it
              return await this.getConversationById(conversation.id, created_by)
            }
          }
        }
      }
    }

    // Create new conversation
    // Create new conversation
    let conversation;
    try {
      const { data: newConv, error: convError } = await supabaseAdmin
        .from('conversations')
        .insert({ type, name, created_by })
        .select()
        .single()
        
      if (convError) throw convError
      conversation = newConv
    } catch (err: any) {
      // Fallback: If columns are not added or mismatch, fallback inserting without name/created_by
      const { data: newConv, error: convError } = await supabaseAdmin
        .from('conversations')
        .insert({ type })
        .select()
        .single()
        
      if (convError) throw new Error(`Failed to create conversation: ${convError.message}`)
      conversation = newConv
    }

    // Add all participants (ensure unique IDs)
    const allParticipants = Array.from(new Set([created_by, ...participant_ids]))
    const participantsToInsert = allParticipants.map(userId => ({
      conversation_id: conversation.id,
      user_id: userId,
      role: type === 'group' ? (userId === created_by ? 'admin' : 'member') : 'member'
    }))

    const { error: participantsError } = await supabaseAdmin
      .from('conversation_participants')
      .insert(participantsToInsert)

    if (participantsError) throw new Error(`Failed to add participants: ${participantsError.message}`)

    return await this.getConversationById(conversation.id, created_by)
  }

  // Get conversation by ID
  async getConversationById(conversationId: string, userId: string) {
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (error) throw new Error(`Failed to fetch conversation: ${error.message}`)

    // Get participants with their role inside the conversation
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('conversation_participants')
      .select(`
        user_id,
        role,
        users:user_id (
          id,
          name,
          email,
          role
        )
      `)
      .eq('conversation_id', conversationId)

    if (participantsError) throw new Error(`Failed to fetch participants: ${participantsError.message}`)

    const participantsList = participants.map(p => {
      const u = Array.isArray(p.users) ? p.users[0] : p.users
      return {
        ...u,
        group_role: p.role || 'member'
      }
    })
    const otherUser = conversation.type === 'direct'
      ? participantsList.find(p => p.id !== userId)
      : null

    return {
      ...conversation,
      participants: participantsList,
      other_user: otherUser
    }
  }

  // Get conversation members
  async getConversationMembers(conversationId: string) {
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('conversation_participants')
      .select(`
        user_id,
        role,
        joined_at,
        users:user_id (
          id,
          name,
          email,
          role
        )
      `)
      .eq('conversation_id', conversationId)

    if (participantsError) throw new Error(`Failed to fetch participants: ${participantsError.message}`)

    return participants.map(p => {
      const u = Array.isArray(p.users) ? p.users[0] : p.users
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: p.role || 'member', // this returns the group role ('admin', 'sub_admin', 'member')
        system_role: u.role || 'employee',
        joined_at: p.joined_at || new Date().toISOString()
      }
    })
  }

  // Verify if a user is group admin or sub_admin
  async verifyGroupAdmin(userId: string, conversationId: string): Promise<boolean> {
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('type, created_by')
      .eq('id', conversationId)
      .single()

    if (!conversation || conversation.type !== 'group') return true // Direct messages allow additions/removals

    const { data: participant } = await supabaseAdmin
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle()

    return participant?.role === 'admin' || participant?.role === 'sub_admin'
  }

  // Add conversation member
  async addConversationMember(conversationId: string, userId: string, requesterId: string) {
    const isAuthorized = await this.verifyGroupAdmin(requesterId, conversationId)
    if (!isAuthorized) {
      throw new Error('Only group admins or sub-admins can add members')
    }

    const { error } = await supabaseAdmin
      .from('conversation_participants')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'member'
      })

    if (error) throw new Error(`Failed to add participant: ${error.message}`)
    return { success: true }
  }

  // Remove conversation member
  async removeConversationMember(conversationId: string, userId: string, requesterId: string) {
    const isAuthorized = await this.verifyGroupAdmin(requesterId, conversationId)
    if (!isAuthorized) {
      throw new Error('Only group admins or sub-admins can remove members')
    }

    // A sub_admin cannot remove another admin or sub_admin
    const { data: requesterParticipant } = await supabaseAdmin
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', requesterId)
      .maybeSingle()

    const { data: targetParticipant } = await supabaseAdmin
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle()

    if (requesterParticipant?.role === 'sub_admin' && (targetParticipant?.role === 'admin' || targetParticipant?.role === 'sub_admin')) {
      throw new Error('Sub-admins cannot remove other admins or sub-admins')
    }

    const { error } = await supabaseAdmin
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)

    if (error) throw new Error(`Failed to remove participant: ${error.message}`)
    return { success: true }
  }

  // Promote a member to sub-admin
  async promoteMember(conversationId: string, userId: string, requesterId: string) {
    // Only the group creator/admin can promote to sub-admin
    const { data: requesterParticipant } = await supabaseAdmin
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', requesterId)
      .maybeSingle()

    if (requesterParticipant?.role !== 'admin') {
      throw new Error('Only group admins can promote members')
    }

    const { error } = await supabaseAdmin
      .from('conversation_participants')
      .update({ role: 'sub_admin' })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)

    if (error) throw new Error(`Failed to promote member: ${error.message}`)
    return { success: true }
  }

  // Demote a sub-admin to member
  async demoteMember(conversationId: string, userId: string, requesterId: string) {
    // Only the group creator/admin can demote sub-admins
    const { data: requesterParticipant } = await supabaseAdmin
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', requesterId)
      .maybeSingle()

    if (requesterParticipant?.role !== 'admin') {
      throw new Error('Only group admins can demote members')
    }

    const { error } = await supabaseAdmin
      .from('conversation_participants')
      .update({ role: 'member' })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)

    if (error) throw new Error(`Failed to demote member: ${error.message}`)
    return { success: true }
  }

  // Helper: Verify conversation access
  async verifyConversationAccess(userId: string, conversationId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle()
    return !!data
  }

  // Delete conversation
  async deleteConversation(conversationId: string) {
    // Delete associated messages first
    await supabaseAdmin
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId)

    // Delete participants
    await supabaseAdmin
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)

    // Delete conversation record
    const { error } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('id', conversationId)

    if (error) throw new Error(`Failed to delete conversation: ${error.message}`)
    return { success: true }
  }
}
