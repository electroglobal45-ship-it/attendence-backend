import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { ChannelsService } from './channels.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'

const channelsService = new ChannelsService()

export class ChannelsController {
  // Get all channels for current user
  async getUserChannels(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      const channels = await channelsService.getUserChannels(userId)
      return successResponse(res, { channels }, 'Channels fetched successfully')
    } catch (error: any) {
      console.error('Get channels error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get channel by ID
  async getChannelById(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      // Ensure channelId is a string
      const channelIdStr = Array.isArray(channelId) ? channelId[0] : channelId

      const channel = await channelsService.getChannelById(channelIdStr, userId)
      return successResponse(res, { channel }, 'Channel fetched successfully')
    } catch (error: any) {
      console.error('Get channel error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Create new channel
  async createChannel(req: AuthRequest, res: Response) {
    try {
      const { name, description, type, topic, purpose, members } = req.body
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      if (!name || !type) {
        return errorResponse(res, 'Name and type are required', 400)
      }

      if (!['public', 'private'].includes(type)) {
        return errorResponse(res, 'Type must be public or private', 400)
      }

      const channel = await channelsService.createChannel({
        name,
        description,
        type,
        topic,
        purpose,
        createdBy: userId,
        members
      })

      // Emit socket event
      const io = req.app.get('io')
      io.emit('channel_created', { channel })

      return createdResponse(res, { channel }, 'Channel created successfully')
    } catch (error: any) {
      console.error('Create channel error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Update channel
  async updateChannel(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params
      const { name, description, topic, purpose } = req.body
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      // Ensure channelId is a string
      const channelIdStr = Array.isArray(channelId) ? channelId[0] : channelId

      const channel = await channelsService.updateChannel(channelIdStr, userId, {
        name,
        description,
        topic,
        purpose
      })

      // Emit socket event
      const io = req.app.get('io')
      io.to(`channel:${channelIdStr}`).emit('channel_updated', {
        channelId: channelIdStr,
        updates: { name, description, topic, purpose }
      })

      return successResponse(res, { channel }, 'Channel updated successfully')
    } catch (error: any) {
      console.error('Update channel error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Archive channel
  async archiveChannel(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      // Ensure channelId is a string
      const channelIdStr = Array.isArray(channelId) ? channelId[0] : channelId

      await channelsService.archiveChannel(channelIdStr, userId)

      // Emit socket event
      const io = req.app.get('io')
      io.to(`channel:${channelIdStr}`).emit('channel_archived', { channelId: channelIdStr })

      return successResponse(res, null, 'Channel archived successfully')
    } catch (error: any) {
      console.error('Archive channel error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Add member to channel
  async addMember(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params
      const { userId: memberUserId, role } = req.body
      const currentUserId = req.user?.id

      if (!currentUserId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      if (!memberUserId) {
        return errorResponse(res, 'User ID is required', 400)
      }

      // Ensure channelId is a string
      const channelIdStr = Array.isArray(channelId) ? channelId[0] : channelId

      const member = await channelsService.addMember(
        channelIdStr,
        currentUserId,
        memberUserId,
        role
      )

      // Emit socket event
      const io = req.app.get('io')
      io.to(`channel:${channelIdStr}`).emit('member_added', {
        channelId: channelIdStr,
        member
      })

      return successResponse(res, { member }, 'Member added successfully')
    } catch (error: any) {
      console.error('Add member error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Remove member from channel
  async removeMember(req: AuthRequest, res: Response) {
    try {
      const { channelId, userId: memberUserId } = req.params
      const currentUserId = req.user?.id

      if (!currentUserId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      // Ensure channelId and memberUserId are strings
      const channelIdStr = Array.isArray(channelId) ? channelId[0] : channelId
      const memberUserIdStr = Array.isArray(memberUserId) ? memberUserId[0] : memberUserId

      await channelsService.removeMember(channelIdStr, currentUserId, memberUserIdStr)

      // Emit socket event
      const io = req.app.get('io')
      io.to(`channel:${channelIdStr}`).emit('member_removed', {
        channelId: channelIdStr,
        userId: memberUserIdStr
      })

      return successResponse(res, null, 'Member removed successfully')
    } catch (error: any) {
      console.error('Remove member error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Join public channel
  async joinChannel(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      // Ensure channelId is a string
      const channelIdStr = Array.isArray(channelId) ? channelId[0] : channelId

      const member = await channelsService.joinChannel(channelIdStr, userId)

      // Emit socket event
      const io = req.app.get('io')
      io.to(`channel:${channelIdStr}`).emit('member_joined', {
        channelId: channelIdStr,
        userId,
        userName: req.user?.name
      })

      return successResponse(res, { member }, 'Joined channel successfully')
    } catch (error: any) {
      console.error('Join channel error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Leave channel
  async leaveChannel(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      // Ensure channelId is a string
      const channelIdStr = Array.isArray(channelId) ? channelId[0] : channelId

      await channelsService.leaveChannel(channelIdStr, userId)

      // Emit socket event
      const io = req.app.get('io')
      io.to(`channel:${channelIdStr}`).emit('member_left', {
        channelId: channelIdStr,
        userId
      })

      return successResponse(res, null, 'Left channel successfully')
    } catch (error: any) {
      console.error('Leave channel error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get channel members
  async getMembers(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      // Ensure channelId is a string
      const channelIdStr = Array.isArray(channelId) ? channelId[0] : channelId

      // Verify access
      const hasAccess = await channelsService.verifyChannelAccess(userId, channelIdStr)
      if (!hasAccess) {
        return errorResponse(res, 'Access denied', 403)
      }

      const members = await channelsService.getMembers(channelIdStr)
      return successResponse(res, { members }, 'Members fetched successfully')
    } catch (error: any) {
      console.error('Get channel members error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
