import { Router } from 'express'
import { BoardsController } from './boards.controller'
import { authenticate, requireEmployee, requireAdmin, requireAdminOrTL } from '../../middleware/auth.middleware'

const router = Router()
const boardsController = new BoardsController()

// All routes require authentication
router.use(authenticate)

// Get boards for a project
router.get('/project/:projectId', requireEmployee, (req, res) => boardsController.getProjectBoards(req, res))

// Get board with all details (lists, cards, labels, members)
router.get('/:boardId', requireEmployee, (req, res) => boardsController.getBoardDetails(req, res))

// Create board
router.post('/', requireAdmin, (req, res) => boardsController.createBoard(req, res))

// Update board
router.put('/:boardId', requireEmployee, (req, res) => boardsController.updateBoard(req, res))

// Delete board
router.delete('/:boardId', requireEmployee, (req, res) => boardsController.deleteBoard(req, res))

// Board members
router.post('/:boardId/members', requireAdminOrTL, (req, res) => boardsController.addBoardMember(req, res))
router.put('/members/:memberId', requireAdminOrTL, (req, res) => boardsController.updateBoardMember(req, res))
router.delete('/members/:memberId', requireAdminOrTL, (req, res) => boardsController.removeBoardMember(req, res))

// Favorites
router.post('/:boardId/favorite', requireEmployee, (req, res) => boardsController.toggleFavorite(req, res))
router.get('/favorites/me', requireEmployee, (req, res) => boardsController.getUserFavorites(req, res))

export default router
