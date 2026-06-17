import { Router } from 'express'
import { VaultController } from './vault.controller'
import { authenticate, requireAdmin, requireEmployee } from '../../middleware/auth.middleware'

const router = Router()
const vaultController = new VaultController()

// All routes require a valid token
router.use(authenticate)

// Create a vault entry (admin only)
router.post('/', requireAdmin, (req, res) => vaultController.createEntry(req, res))

// List vault entries (admin sees all, employee sees own)
router.get('/', requireEmployee, (req, res) => vaultController.listEntries(req, res))

// One-time reveal (employee only — access control enforced in service)
router.post('/:id/reveal', requireEmployee, (req, res) => vaultController.revealPassword(req, res))

// Delete vault entry (admin only)
router.delete('/:id', requireAdmin, (req, res) => vaultController.deleteEntry(req, res))

// Reset reveal status so employee can view once more (admin only)
router.post('/:id/reset', requireAdmin, (req, res) => vaultController.resetReveal(req, res))

// Assign employees to existing entry (admin only)
router.post('/:id/assign', requireAdmin, (req, res) => vaultController.addAssignments(req, res))

export default router
