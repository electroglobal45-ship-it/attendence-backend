import { Router } from 'express'
import { DriveController } from './drive.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()
const driveController = new DriveController()

// ═══════════════════════════════════════════════════════════
// AUTHENTICATION ROUTES
// ═══════════════════════════════════════════════════════════

// Get Google OAuth URL
router.get('/auth/url', authenticate, driveController.getAuthUrl.bind(driveController))

// OAuth callback (handle Google redirect)
router.get('/auth/callback', driveController.handleCallback.bind(driveController))

// Check connection status
router.get('/auth/status', authenticate, driveController.getConnectionStatus.bind(driveController))

// Disconnect Google Drive
router.post('/auth/disconnect', authenticate, driveController.disconnect.bind(driveController))

// ═══════════════════════════════════════════════════════════
// FILE MANAGEMENT ROUTES
// ═══════════════════════════════════════════════════════════

// List user's files
router.get('/files', authenticate, driveController.listFiles.bind(driveController))

// Get file details
router.get('/files/:fileId', authenticate, driveController.getFile.bind(driveController))

// Upload file
router.post('/upload', authenticate, driveController.uploadFile.bind(driveController))

// Create folder
router.post('/folders', authenticate, driveController.createFolder.bind(driveController))

// Delete file/folder
router.delete('/files/:fileId', authenticate, driveController.deleteFile.bind(driveController))

// Rename file/folder
router.patch('/files/:fileId', authenticate, driveController.renameFile.bind(driveController))

// Download file
router.get('/download/:fileId', authenticate, driveController.downloadFile.bind(driveController))

// ═══════════════════════════════════════════════════════════
// SHARING ROUTES (PRIVATE - only sender & receiver see)
// ═══════════════════════════════════════════════════════════

// Share file with specific employees
router.post('/share', authenticate, driveController.shareFile.bind(driveController))

// Get files shared BY me
router.get('/shared/by-me', authenticate, driveController.getSharedByMe.bind(driveController))

// Get files shared WITH me
router.get('/shared/with-me', authenticate, driveController.getSharedWithMe.bind(driveController))

// Revoke share
router.delete('/share/:shareId', authenticate, driveController.revokeShare.bind(driveController))

// Mark file as viewed
router.post('/share/:shareId/viewed', authenticate, driveController.markAsViewed.bind(driveController))

// ═══════════════════════════════════════════════════════════
// SEARCH & ORGANIZATION
// ═══════════════════════════════════════════════════════════

// Search files
router.get('/search', authenticate, driveController.searchFiles.bind(driveController))

// Get folder contents
router.get('/folders/:folderId/contents', authenticate, driveController.getFolderContents.bind(driveController))

export default router
