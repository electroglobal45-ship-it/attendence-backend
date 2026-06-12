import { Request, Response } from 'express'
import { DriveService } from './drive.service'
import { AuthRequest } from '../../middleware/auth.middleware'
import { successResponse, errorResponse, createdResponse } from '../../utils/response'
import multer from 'multer'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }) // 100MB limit
const driveService = new DriveService()

export class DriveController {
  // ═══════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════

  async getAuthUrl(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const authUrl = driveService.getAuthUrl(userId)
      return successResponse(res, { authUrl }, 'Auth URL generated')
    } catch (error: any) {
      console.error('Get auth URL error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async handleCallback(req: AuthRequest, res: Response) {
    try {
      const { code, state } = req.query
      const userId = state as string || req.user?.id

      if (!code || !userId) {
        return errorResponse(res, 'Missing authorization code or user ID', 400)
      }

      const result = await driveService.handleCallback(userId, code as string)
      
      // Redirect to drive page in frontend
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/drive?connected=true`)
    } catch (error: any) {
      console.error('OAuth callback error:', error)
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/drive?error=connection_failed`)
    }
  }

  async getConnectionStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const status = await driveService.getConnectionStatus(userId)
      return successResponse(res, status, 'Connection status retrieved')
    } catch (error: any) {
      console.error('Get connection status error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async disconnect(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      await driveService.disconnect(userId)
      return successResponse(res, null, 'Google Drive disconnected successfully')
    } catch (error: any) {
      console.error('Disconnect error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // FILE OPERATIONS
  // ═══════════════════════════════════════════════════════════

  async listFiles(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const { folderId, pageSize } = req.query
      const files = await driveService.listFiles(
        userId,
        folderId as string,
        pageSize ? parseInt(pageSize as string) : 50
      )

      return successResponse(res, { files }, 'Files retrieved successfully')
    } catch (error: any) {
      console.error('List files error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async getFile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const fileId = req.params.fileId as string
      const file = await driveService.getFile(userId, fileId)

      return successResponse(res, { file }, 'File retrieved successfully')
    } catch (error: any) {
      console.error('Get file error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async uploadFile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      // Use multer middleware
      upload.single('file')(req, res, async (err) => {
        if (err) {
          return errorResponse(res, `Upload error: ${err.message}`, 400)
        }

        const file = (req as any).file
        if (!file) {
          return errorResponse(res, 'No file uploaded', 400)
        }

        const { folderId } = req.body

        try {
          const uploadedFile = await driveService.uploadFile(userId, file, folderId)
          return createdResponse(res, { file: uploadedFile }, 'File uploaded successfully')
        } catch (uploadError: any) {
          return errorResponse(res, uploadError.message, 500)
        }
      })
    } catch (error: any) {
      console.error('Upload file error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async createFolder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const { folderName, parentFolderId } = req.body

      if (!folderName) {
        return errorResponse(res, 'Folder name is required', 400)
      }

      const folder = await driveService.createFolder(userId, folderName, parentFolderId)
      return createdResponse(res, { folder }, 'Folder created successfully')
    } catch (error: any) {
      console.error('Create folder error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async deleteFile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const fileId = req.params.fileId as string
      await driveService.deleteFile(userId, fileId)

      return successResponse(res, null, 'File deleted successfully')
    } catch (error: any) {
      console.error('Delete file error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async renameFile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const fileId = req.params.fileId as string
      const { name } = req.body

      if (!name) {
        return errorResponse(res, 'New name is required', 400)
      }

      const file = await driveService.renameFile(userId, fileId, name)
      return successResponse(res, { file }, 'File renamed successfully')
    } catch (error: any) {
      console.error('Rename file error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async downloadFile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const fileId = req.params.fileId as string
      const fileStream = await driveService.downloadFile(userId, fileId)

      // Pipe the stream to response
      fileStream.pipe(res)
    } catch (error: any) {
      console.error('Download file error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async searchFiles(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const { q } = req.query
      if (!q) {
        return errorResponse(res, 'Search query is required', 400)
      }

      const files = await driveService.searchFiles(userId, q as string)
      return successResponse(res, { files }, 'Search completed successfully')
    } catch (error: any) {
      console.error('Search files error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async getFolderContents(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const folderId = req.params.folderId as string
      const files = await driveService.listFiles(userId, folderId)

      return successResponse(res, { files }, 'Folder contents retrieved successfully')
    } catch (error: any) {
      console.error('Get folder contents error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SHARING
  // ═══════════════════════════════════════════════════════════

  async shareFile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const { fileId, shareWith, permission, message } = req.body

      if (!fileId || !shareWith || !Array.isArray(shareWith) || shareWith.length === 0) {
        return errorResponse(res, 'File ID and recipients are required', 400)
      }

      const shares = await driveService.shareFile(
        userId,
        fileId,
        shareWith,
        permission || 'reader',
        message
      )

      return createdResponse(res, { shares }, 'File shared successfully')
    } catch (error: any) {
      console.error('Share file error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async getSharedByMe(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const shares = await driveService.getSharedByMe(userId)
      return successResponse(res, { shares }, 'Shared files retrieved successfully')
    } catch (error: any) {
      console.error('Get shared by me error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async getSharedWithMe(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const shares = await driveService.getSharedWithMe(userId)
      return successResponse(res, { shares }, 'Shared files retrieved successfully')
    } catch (error: any) {
      console.error('Get shared with me error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async revokeShare(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const shareId = req.params.shareId as string
      await driveService.revokeShare(userId, shareId)

      return successResponse(res, null, 'Share revoked successfully')
    } catch (error: any) {
      console.error('Revoke share error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  async markAsViewed(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return errorResponse(res, 'Unauthorized', 401)

      const shareId = req.params.shareId as string
      await driveService.markAsViewed(shareId, userId)

      return successResponse(res, null, 'Marked as viewed')
    } catch (error: any) {
      console.error('Mark as viewed error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
