import { Router } from 'express'
import { MeetingsController } from './meetings.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()
const meetingsController = new MeetingsController()

// All routes require authentication
router.use(authenticate)

router.get('/', (req, res) => meetingsController.listMeetings(req, res))
router.post('/', (req, res) => meetingsController.createMeeting(req, res))
router.delete('/:id', (req, res) => meetingsController.deleteMeeting(req, res))
router.post('/:id/start', (req, res) => meetingsController.startMeeting(req, res))
router.post('/:id/end', (req, res) => meetingsController.endMeeting(req, res))
router.post('/:id/ping', (req, res) => meetingsController.pingMeeting(req, res))
router.post('/:id/daily-room', (req, res) => meetingsController.getDailyRoom(req, res))

export default router
