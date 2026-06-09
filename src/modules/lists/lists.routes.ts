import { Router } from 'express'
import { ListsController } from './lists.controller'
import { authenticate, requireEmployee } from '../../middleware/auth.middleware'

const router = Router()
const listsController = new ListsController()

router.use(authenticate)

router.post('/', requireEmployee, (req, res) => listsController.createList(req, res))
router.put('/:listId', requireEmployee, (req, res) => listsController.updateList(req, res))
router.patch('/:listId', requireEmployee, (req, res) => listsController.updateList(req, res))
router.delete('/:listId', requireEmployee, (req, res) => listsController.deleteList(req, res))
router.post('/:listId/move-cards', requireEmployee, (req, res) => listsController.moveCards(req, res))
router.post('/:listId/sort', requireEmployee, (req, res) => listsController.sortCards(req, res))

export default router
