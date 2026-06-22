import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { ChannelsController } from './channels.controller'

const router = Router()
const channelsController = new ChannelsController()

// All routes require authentication
router.use(authenticate)

// Get all channels for current user
router.get('/', channelsController.getUserChannels.bind(channelsController))

// Create new channel
router.post('/', channelsController.createChannel.bind(channelsController))

// Get channel by ID
router.get('/:channelId', channelsController.getChannelById.bind(channelsController))

// Update channel
router.put('/:channelId', channelsController.updateChannel.bind(channelsController))

// Archive channel
router.delete('/:channelId', channelsController.archiveChannel.bind(channelsController))

// Add member to channel
router.post('/:channelId/members', channelsController.addMember.bind(channelsController))

// Remove member from channel
router.delete('/:channelId/members/:userId', channelsController.removeMember.bind(channelsController))

// Join public channel
router.post('/:channelId/join', channelsController.joinChannel.bind(channelsController))

// Leave channel
router.post('/:channelId/leave', channelsController.leaveChannel.bind(channelsController))

export default router
