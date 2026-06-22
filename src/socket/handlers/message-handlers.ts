import { Server as SocketIOServer } from 'socket.io'
import { AuthenticatedSocket } from '../socket-server'

module.exports = (io: SocketIOServer, socket: AuthenticatedSocket) => {
  
  // Send a new message
  socket.on('send_message', async (data: {
    channelId?: string
    conversationId?: string
    content: string
    parentMessageId?: string
    tempId?: string
  }) => {
    try {
      const { channelId, conversationId, content, parentMessageId, tempId } = data

      if (!content?.trim()) {
        socket.emit('error', { message: 'Message content is required' })
        return
      }

      // Save message to database
      const message = await createMessage({
        content: content.trim(),
        channelId,
        conversationId,
        senderId: socket.userId!,
        parentMessageId
      })

      // Prepare message with sender info
      const messageWithSender = {
        ...message,
        sender: {
          id: socket.userId,
          name: socket.userName,
          email: socket.userEmail
        },
        tempId
      }

      // Broadcast to channel or conversation
      if (channelId) {
        io.to(`channel:${channelId}`).emit('new_message', {
          message: messageWithSender,
          channelId,
          tempId
        })
      } else if (conversationId) {
        io.to(`conversation:${conversationId}`).emit('new_message', {
          message: messageWithSender,
          conversationId,
          tempId
        })
      }

      // If it's a thread reply, also emit to thread room
      if (parentMessageId) {
        io.to(`thread:${parentMessageId}`).emit('thread_reply', {
          messageId: message.id,
          parentMessageId,
          sender: socket.userName
        })
      }

      // Extract and handle mentions
      await handleMentions(message.id, content, channelId, conversationId, io)

    } catch (error) {
      console.error('Error sending message:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  })

  // Edit a message
  socket.on('edit_message', async (data: {
    messageId: string
    newContent: string
  }) => {
    try {
      const { messageId, newContent } = data

      // Update message in database
      const updated = await updateMessage(messageId, socket.userId!, newContent)

      if (!updated) {
        socket.emit('error', { message: 'Failed to edit message' })
        return
      }

      // Broadcast to relevant room
      const room = updated.channelId 
        ? `channel:${updated.channelId}` 
        : `conversation:${updated.conversationId}`

      io.to(room).emit('message_edited', {
        messageId,
        newContent,
        editedAt: new Date().toISOString()
      })

    } catch (error) {
      console.error('Error editing message:', error)
      socket.emit('error', { message: 'Failed to edit message' })
    }
  })

  // Delete a message
  socket.on('delete_message', async (data: { messageId: string }) => {
    try {
      const { messageId } = data

      // Soft delete message
      const deleted = await deleteMessage(messageId, socket.userId!)

      if (!deleted) {
        socket.emit('error', { message: 'Failed to delete message' })
        return
      }

      // Broadcast to relevant room
      const room = deleted.channelId 
        ? `channel:${deleted.channelId}` 
        : `conversation:${deleted.conversationId}`

      io.to(room).emit('message_deleted', {
        messageId,
        deletedAt: new Date().toISOString()
      })

    } catch (error) {
      console.error('Error deleting message:', error)
      socket.emit('error', { message: 'Failed to delete message' })
    }
  })

  // Add reaction to message
  socket.on('add_reaction', async (data: {
    messageId: string
    emoji: string
  }) => {
    try {
      const { messageId, emoji } = data

      const reaction = await addReaction(messageId, socket.userId!, emoji)

      // Get the room for this message
      const message = await getMessage(messageId)
      const room = message.channelId 
        ? `channel:${message.channelId}` 
        : `conversation:${message.conversationId}`

      io.to(room).emit('reaction_added', {
        messageId,
        reactionId: reaction.id,
        emoji,
        userId: socket.userId,
        userName: socket.userName
      })

    } catch (error) {
      console.error('Error adding reaction:', error)
      socket.emit('error', { message: 'Failed to add reaction' })
    }
  })

  // Remove reaction
  socket.on('remove_reaction', async (data: {
    messageId: string
    reactionId: string
  }) => {
    try {
      const { messageId, reactionId } = data

      await removeReaction(reactionId, socket.userId!)

      const message = await getMessage(messageId)
      const room = message.channelId 
        ? `channel:${message.channelId}` 
        : `conversation:${message.conversationId}`

      io.to(room).emit('reaction_removed', {
        messageId,
        reactionId
      })

    } catch (error) {
      console.error('Error removing reaction:', error)
    }
  })
}

// Helper functions
async function createMessage(data: any) {
  const { supabaseAdmin } = require('../../config/supabase')
  
  const { data: message, error } = await supabaseAdmin
    .from('messages')
    .insert({
      content: data.content,
      channel_id: data.channelId || null,
      conversation_id: data.conversationId || null,
      sender_id: data.senderId,
      parent_message_id: data.parentMessageId || null,
      message_type: 'text'
    })
    .select()
    .single()

  if (error) throw error
  return message
}

async function updateMessage(messageId: string, userId: string, newContent: string) {
  const { supabaseAdmin } = require('../../config/supabase')
  
  const { data, error } = await supabaseAdmin
    .from('messages')
    .update({
      content: newContent,
      edited_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .eq('sender_id', userId)
    .select('channel_id, conversation_id')
    .single()

  if (error) return null
  return { channelId: data.channel_id, conversationId: data.conversation_id }
}

async function deleteMessage(messageId: string, userId: string) {
  const { supabaseAdmin } = require('../../config/supabase')
  
  const { data, error } = await supabaseAdmin
    .from('messages')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .eq('sender_id', userId)
    .select('channel_id, conversation_id')
    .single()

  if (error) return null
  return { channelId: data.channel_id, conversationId: data.conversation_id }
}

async function getMessage(messageId: string) {
  const { supabaseAdmin } = require('../../config/supabase')
  
  const { data } = await supabaseAdmin
    .from('messages')
    .select('channel_id, conversation_id')
    .eq('id', messageId)
    .single()

  return { channelId: data.channel_id, conversationId: data.conversation_id }
}

async function addReaction(messageId: string, userId: string, emoji: string) {
  const { supabaseAdmin } = require('../../config/supabase')
  
  const { data, error } = await supabaseAdmin
    .from('message_reactions')
    .insert({
      message_id: messageId,
      user_id: userId,
      emoji
    })
    .select()
    .single()

  if (error) throw error
  return data
}

async function removeReaction(reactionId: string, userId: string) {
  const { supabaseAdmin } = require('../../config/supabase')
  
  await supabaseAdmin
    .from('message_reactions')
    .delete()
    .eq('id', reactionId)
    .eq('user_id', userId)
}

async function handleMentions(messageId: string, content: string, channelId: string | undefined, conversationId: string | undefined, io: any) {
  // Extract @mentions from content
  const mentionRegex = /@(\w+)/g
  const mentions = content.match(mentionRegex)

  if (!mentions) return

  const { supabaseAdmin } = require('../../config/supabase')

  for (const mention of mentions) {
    const username = mention.substring(1)
    
    // Find user by name
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('name', username)
      .single()

    if (user) {
      // Create mention record
      await supabaseAdmin
        .from('message_mentions')
        .insert({
          message_id: messageId,
          mentioned_user_id: user.id
        })

      // Send notification to mentioned user
      io.to(`user:${user.id}`).emit('new_mention', {
        messageId,
        channelId,
        conversationId,
        mentionedBy: username
      })
    }
  }
}
