import { supabaseAdmin } from '../../config/supabase'

export class ConversationsService {
  // Get all conversations for a user
  async getUserConversations(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('conversation_participants')
      .select(`
        conversation_id,
        conversations:conversation_id (
          id,
          type,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)

    if (error) throw new Error(`Failed to fetch conversations: ${error.message}`)

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
  }) {
    const { type, participant_ids, created_by } = data

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
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .insert({ type })
      .select()
      .single()

    if (convError) throw new Error(`Failed to create conversation: ${convError.message}`)

    // Add all participants
    const allParticipants = [created_by, ...participant_ids]
    const participantsToInsert = allParticipants.map(userId => ({
      conversation_id: conversation.id,
      user_id: userId
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

    // Get participants
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('conversation_participants')
      .select(`
        user_id,
        users:user_id (
          id,
          name,
          email,
          role
        )
      `)
      .eq('conversation_id', conversationId)

    if (participantsError) throw new Error(`Failed to fetch participants: ${participantsError.message}`)

    const participantsList = participants.map(p => Array.isArray(p.users) ? p.users[0] : p.users)
    const otherUser = conversation.type === 'direct'
      ? participantsList.find(p => p.id !== userId)
      : null

    return {
      ...conversation,
      participants: participantsList,
      other_user: otherUser
    }
  }
}
