import { supabaseAdmin } from '../../config/supabase'

export class MessagesService {
  // Get messages in a channel (paginated)
  async getChannelMessages(channelId: string, userId: string, limit: number = 50, before?: string) {
    // Verify access
    const hasAccess = await this.verifyChannelAccess(userId, channelId)
    if (!hasAccess) {
      throw new Error('Access denied to this channel')
    }

    let query = supabaseAdmin
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, name, email),
        reactions:message_reactions(id, emoji, user_id, user:users(name)),
        attachments:message_attachments(*)
      `)
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data: messages, error } = await query

    if (error) throw new Error(`Failed to fetch messages: ${error.message}`)

    // Reverse to get chronological order
    return messages?.reverse() || []
  }

  // Get messages in a conversation
  async getConversationMessages(conversationId: string, userId: string, limit: number = 50, before?: string) {
    // Verify participant
    const isParticipant = await this.verifyConversationParticipant(userId, conversationId)
    if (!isParticipant) {
      throw new Error('Access denied to this conversation')
    }

    let query = supabaseAdmin
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, name, email),
        reactions:message_reactions(id, emoji, user_id, user:users(name)),
        attachments:message_attachments(*)
      `)
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data: messages, error } = await query

    if (error) throw new Error(`Failed to fetch messages: ${error.message}`)

    return messages?.reverse() || []
  }

  // Get thread replies
  async getThreadReplies(parentMessageId: string, userId: string) {
    // Get parent message to determine access
    const { data: parent } = await supabaseAdmin
      .from('messages')
      .select('channel_id, conversation_id')
      .eq('id', parentMessageId)
      .single()

    if (!parent) {
      throw new Error('Parent message not found')
    }

    // Verify access
    if (parent.channel_id) {
      const hasAccess = await this.verifyChannelAccess(userId, parent.channel_id)
      if (!hasAccess) throw new Error('Access denied')
    } else if (parent.conversation_id) {
      const isParticipant = await this.verifyConversationParticipant(userId, parent.conversation_id)
      if (!isParticipant) throw new Error('Access denied')
    }

    const { data: replies, error } = await supabaseAdmin
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, name, email),
        reactions:message_reactions(id, emoji, user_id, user:users(name))
      `)
      .eq('parent_message_id', parentMessageId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })

    if (error) throw new Error(`Failed to fetch thread replies: ${error.message}`)

    return replies || []
  }

  // Search messages
  async searchMessages(userId: string, query: string, channelId?: string, fromUserId?: string) {
    let dbQuery = supabaseAdmin
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, name, email),
        channel:channels(id, name),
        conversation:conversations(id, type)
      `)
      .eq('is_deleted', false)
      .textSearch('content', query, { type: 'websearch' })
      .limit(50)

    if (channelId) {
      dbQuery = dbQuery.eq('channel_id', channelId)
    }

    if (fromUserId) {
      dbQuery = dbQuery.eq('sender_id', fromUserId)
    }

    const { data: messages, error } = await dbQuery

    if (error) throw new Error(`Search failed: ${error.message}`)

    // Filter by access (user must be member of channel or conversation)
    const accessibleMessages = []
    for (const message of messages || []) {
      if (message.channel_id) {
        const hasAccess = await this.verifyChannelAccess(userId, message.channel_id)
        if (hasAccess) accessibleMessages.push(message)
      } else if (message.conversation_id) {
        const isParticipant = await this.verifyConversationParticipant(userId, message.conversation_id)
        if (isParticipant) accessibleMessages.push(message)
      }
    }

    return accessibleMessages
  }

  // Get unread mentions for user
  async getUnreadMentions(userId: string) {
    const { data: mentions, error } = await supabaseAdmin
      .from('message_mentions')
      .select(`
        *,
        message:messages(
          *,
          sender:users!messages_sender_id_fkey(id, name, email),
          channel:channels(id, name),
          conversation:conversations(id, type)
        )
      `)
      .eq('mentioned_user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch mentions: ${error.message}`)

    return mentions || []
  }

  // Mark mention as read
  async markMentionRead(mentionId: string, userId: string) {
    const { error } = await supabaseAdmin
      .from('message_mentions')
      .update({ is_read: true })
      .eq('id', mentionId)
      .eq('mentioned_user_id', userId)

    if (error) throw new Error(`Failed to mark mention as read: ${error.message}`)

    return { success: true }
  }

  // Helper: Verify channel access
  async verifyChannelAccess(userId: string, channelId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .single()

    return !!data
  }

  // Helper: Verify conversation participant
  async verifyConversationParticipant(userId: string, conversationId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single()

    return !!data
  }
}
