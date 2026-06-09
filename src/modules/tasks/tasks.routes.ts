import { Router } from 'express'
import multer from 'multer'
import { TasksController } from './tasks.controller'
import { authenticate, requireAdmin, requireEmployee } from '../../middleware/auth.middleware'

// Memory storage so we can pipe bytes to Supabase Storage
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const router = Router()
const tasksController = new TasksController()

// All routes require authentication
router.use(authenticate)

// Get all tasks (admin only)
router.get('/all', requireAdmin, (req, res) => tasksController.getAllTasks(req, res))

// Get user's tasks
router.get('/my-tasks', requireEmployee, (req, res) => tasksController.getUserTasks(req, res))

// Create task (admin only)
router.post('/create', requireAdmin, (req, res) => tasksController.createTask(req, res))

// Quick create task for Kanban (employee can create)
router.post('/quick-create', requireEmployee, (req, res) => tasksController.quickCreateTask(req, res))

// Update task status (drag and drop)
router.put('/:taskId/status', requireEmployee, (req, res) => tasksController.updateTaskStatus(req, res))

// Update task details
router.put('/:taskId', requireEmployee, (req, res) => tasksController.updateTask(req, res))

// Move task between lists (drag and drop)
router.post('/move', requireEmployee, (req, res) => tasksController.moveTask(req, res))

// Delete task (admin or employee)
router.delete('/:taskId', requireEmployee, (req, res) => tasksController.deleteTask(req, res))

// Task comments
router.get('/:taskId/comments', requireEmployee, (req, res) => tasksController.getTaskComments(req, res))
router.post('/:taskId/comments', requireEmployee, (req, res) => tasksController.addTaskComment(req, res))

// Task attachments
router.get('/:taskId/attachments', requireEmployee, (req, res) => tasksController.getTaskAttachments(req, res))
router.post('/:taskId/attachments', requireEmployee, upload.single('file'), (req, res) => tasksController.uploadTaskAttachment(req, res))
router.delete('/:taskId/attachments/:attachmentId', requireEmployee, (req, res) => tasksController.deleteTaskAttachment(req, res))

// Task comment delete
router.delete('/:taskId/comments/:commentId', requireEmployee, (req, res) => tasksController.deleteTaskComment(req, res))

// Task activities
router.get('/:taskId/activities', requireEmployee, (req, res) => tasksController.getTaskActivities(req, res))

// Task members
router.get('/:taskId/members', requireEmployee, (req, res) => tasksController.getTaskMembers(req, res))
router.post('/:taskId/members', requireAdmin, (req, res) => tasksController.addTaskMember(req, res))
router.delete('/:taskId/members/:userId', requireAdmin, (req, res) => tasksController.removeTaskMember(req, res))

// Task checklist
router.get('/:taskId/checklist', requireEmployee, (req, res) => tasksController.getTaskChecklist(req, res))
router.post('/:taskId/checklist', requireEmployee, (req, res) => tasksController.addChecklistItem(req, res))
router.put('/:taskId/checklist/:itemId', requireEmployee, (req, res) => tasksController.updateChecklistItem(req, res))
router.delete('/:taskId/checklist/:itemId', requireEmployee, (req, res) => tasksController.deleteChecklistItem(req, res))

export default router
