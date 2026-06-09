import { Router } from 'express'
import { LabelsController } from './labels.controller'
import { authenticate, requireEmployee } from '../../middleware/auth.middleware'

const router = Router()
const labelsController = new LabelsController()

router.use(authenticate)

// Get all labels for a board
router.get('/boards/:boardId', requireEmployee, (req, res) => labelsController.getBoardLabels(req, res))

router.post('/', requireEmployee, (req, res) => labelsController.createLabel(req, res))
router.put('/:labelId', requireEmployee, (req, res) => labelsController.updateLabel(req, res))
router.delete('/:labelId', requireEmployee, (req, res) => labelsController.deleteLabel(req, res))
router.post('/tasks/:taskId/labels', requireEmployee, (req, res) => labelsController.addLabelToTask(req, res))
router.delete('/tasks/:taskId/labels/:labelId', requireEmployee, (req, res) => labelsController.removeLabelFromTask(req, res))

export default router
