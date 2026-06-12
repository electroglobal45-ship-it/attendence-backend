import { google } from 'googleapis'
import { supabaseAdmin } from '../../config/supabase'
import { Readable } from 'stream'

export class DriveService {
  private oauth2Client: any

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
  }

  // ═══════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════

  getAuthUrl(userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'openid'
    ]

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass user ID to identify after callback
      prompt: 'consent' // Force consent to get refresh token
    })
  }

  async handleCallback(userId: string, code: string) {
    try {
      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code)
      
      // Check if user actually granted the requested Drive scopes
      const grantedScopes = tokens.scope || ''
      if (!grantedScopes.includes('drive')) {
        throw new Error('You must check the box to grant Google Drive permissions during login.')
      }

      this.oauth2Client.setCredentials(tokens)

      // Get user's email
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client })
      const { data } = await oauth2.userinfo.get()

      // Calculate token expiry - tokens.expiry_date is milliseconds timestamp
      const expiryDate = tokens.expiry_date 
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000) // Default 1 hour

      // Save to database
      const { data: savedToken, error } = await supabaseAdmin
        .from('google_drive_tokens')
        .upsert({
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: expiryDate.toISOString(),
          google_email: data.email,
          scope: tokens.scope,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) throw error

      return { success: true, email: data.email }
    } catch (error: any) {
      console.error('OAuth callback error:', error)
      throw new Error(`Failed to connect Google Drive: ${error.message}`)
    }
  }

  async getConnectionStatus(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('google_drive_tokens')
      .select('google_email, connected_at, token_expiry')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return { connected: false }
    }

    // Check if token is expired
    const isExpired = new Date(data.token_expiry) < new Date()
    
    // We have a refresh token, so if the row exists, the user is connected.
    return {
      connected: true,
      email: data.google_email,
      connectedAt: data.connected_at,
      needsRefresh: isExpired
    }
  }

  async disconnect(userId: string) {
    // Revoke token with Google
    try {
      const token = await this.getValidToken(userId)
      if (token) {
        await this.oauth2Client.revokeToken(token)
      }
    } catch (error) {
      console.warn('Failed to revoke token with Google:', error)
    }

    // Delete from database
    const { error } = await supabaseAdmin
      .from('google_drive_tokens')
      .delete()
      .eq('user_id', userId)

    if (error) throw error

    return { success: true }
  }

  // ═══════════════════════════════════════════════════════════
  // TOKEN MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  async getValidToken(userId: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
      .from('google_drive_tokens')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) return null

    // Check if token needs refresh
    const expiryDate = new Date(data.token_expiry)
    const now = new Date()

    if (expiryDate <= now) {
      // Token expired, refresh it
      return await this.refreshToken(userId, data.refresh_token)
    }

    return data.access_token
  }

  async refreshToken(userId: string, refreshToken: string): Promise<string> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken })
      const { credentials } = await this.oauth2Client.refreshAccessToken()

      // Calculate new expiry
      const expiryDate = credentials.expiry_date 
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3600 * 1000)

      // Update database
      await supabaseAdmin
        .from('google_drive_tokens')
        .update({
          access_token: credentials.access_token,
          token_expiry: expiryDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      return credentials.access_token!
    } catch (error: any) {
      console.error('Token refresh error:', error)
      throw new Error('Failed to refresh access token')
    }
  }

  async getDriveClient(userId: string) {
    const accessToken = await this.getValidToken(userId)
    if (!accessToken) {
      throw new Error('Google Drive not connected')
    }

    this.oauth2Client.setCredentials({ access_token: accessToken })
    return google.drive({ version: 'v3', auth: this.oauth2Client })
  }

  // ═══════════════════════════════════════════════════════════
  // FILE OPERATIONS
  // ═══════════════════════════════════════════════════════════

  async listFiles(userId: string, folderId?: string, pageSize: number = 50) {
    const drive = await this.getDriveClient(userId)

    let query = "trashed=false"
    if (folderId) {
      query += ` and '${folderId}' in parents`
    } else {
      query += " and 'root' in parents"
    }

    const response = await drive.files.list({
      q: query,
      pageSize,
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, iconLink, thumbnailLink, owners, shared)',
      orderBy: 'folder,modifiedTime desc'
    })

    return response.data.files || []
  }

  async getFile(userId: string, fileId: string) {
    const drive = await this.getDriveClient(userId)

    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, iconLink, thumbnailLink, owners, parents, shared, description'
    })

    return response.data
  }

  async uploadFile(userId: string, file: any, folderId?: string) {
    const drive = await this.getDriveClient(userId)

    const fileMetadata: any = {
      name: file.originalname,
    }

    if (folderId) {
      fileMetadata.parents = [folderId]
    }

    const media = {
      mimeType: file.mimetype,
      body: Readable.from(file.buffer)
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, mimeType, size, webViewLink, iconLink, thumbnailLink'
    })

    // Log activity
    await this.logActivity(userId, 'upload', response.data.id!, response.data.name!)

    return response.data
  }

  async createFolder(userId: string, folderName: string, parentFolderId?: string) {
    const drive = await this.getDriveClient(userId)

    const fileMetadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    }

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId]
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, mimeType, webViewLink'
    })

    await this.logActivity(userId, 'create_folder', response.data.id!, response.data.name!)

    return response.data
  }

  async deleteFile(userId: string, fileId: string) {
    const drive = await this.getDriveClient(userId)

    await drive.files.delete({ fileId })

    await this.logActivity(userId, 'delete', fileId, 'Deleted file')

    return { success: true }
  }

  async renameFile(userId: string, fileId: string, newName: string) {
    const drive = await this.getDriveClient(userId)

    const response = await drive.files.update({
      fileId,
      requestBody: { name: newName },
      fields: 'id, name, mimeType, modifiedTime'
    })

    await this.logActivity(userId, 'rename', fileId, newName)

    return response.data
  }

  async downloadFile(userId: string, fileId: string) {
    const drive = await this.getDriveClient(userId)

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    )

    await this.logActivity(userId, 'download', fileId, 'Downloaded file')

    return response.data
  }

  async searchFiles(userId: string, searchQuery: string) {
    const drive = await this.getDriveClient(userId)

    const query = `trashed=false and (name contains '${searchQuery}' or fullText contains '${searchQuery}')`

    const response = await drive.files.list({
      q: query,
      pageSize: 50,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink, thumbnailLink)',
      orderBy: 'modifiedTime desc'
    })

    return response.data.files || []
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE SHARING (Only sender & receiver can see)
  // ═══════════════════════════════════════════════════════════

  async shareFile(
    userId: string,
    fileId: string,
    shareWithUserIds: string[],
    permission: 'reader' | 'commenter' | 'writer',
    message?: string
  ) {
    const drive = await this.getDriveClient(userId)

    // Get file details
    const file = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, webViewLink, thumbnailLink'
    })

    // Get emails of users to share with
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .in('id', shareWithUserIds)

    if (error || !users) throw new Error('Failed to fetch users')

    const shares = []

    for (const user of users) {
      // Add permission in Google Drive
      await drive.permissions.create({
        fileId,
        requestBody: {
          type: 'user',
          role: permission,
          emailAddress: user.email
        },
        sendNotificationEmail: true,
        emailMessage: message || `${file.data.name} has been shared with you`
      })

      // Record share in our database (private - only these two can see)
      const { data: share, error: shareError } = await supabaseAdmin
        .from('drive_shares')
        .insert({
          file_id: fileId,
          file_name: file.data.name,
          file_type: file.data.mimeType,
          file_size: file.data.size ? parseInt(file.data.size) : null,
          file_url: file.data.webViewLink,
          thumbnail_url: file.data.thumbnailLink,
          shared_by: userId,
          shared_with: user.id,
          permission,
          message,
          is_folder: file.data.mimeType === 'application/vnd.google-apps.folder'
        })
        .select()
        .single()

      if (!shareError && share) {
        shares.push(share)
      }

      // Log activity
      await this.logActivity(userId, 'share', fileId, `Shared with ${user.email}`)
    }

    return shares
  }

  async getSharedByMe(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('drive_shares')
      .select(`
        *,
        shared_with_user:users!drive_shares_shared_with_fkey(id, name, email)
      `)
      .eq('shared_by', userId)
      .order('shared_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async getSharedWithMe(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('drive_shares')
      .select(`
        *,
        shared_by_user:users!drive_shares_shared_by_fkey(id, name, email)
      `)
      .eq('shared_with', userId)
      .order('shared_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async revokeShare(userId: string, shareId: string) {
    // Get share details
    const { data: share, error: fetchError } = await supabaseAdmin
      .from('drive_shares')
      .select('*')
      .eq('id', shareId)
      .eq('shared_by', userId) // Only owner can revoke
      .single()

    if (fetchError || !share) {
      throw new Error('Share not found or unauthorized')
    }

    // Get the email of the user we're revoking from
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', share.shared_with)
      .single()

    if (user) {
      try {
        const drive = await this.getDriveClient(userId)
        
        // Find and delete the permission in Google Drive
        const permissions = await drive.permissions.list({ fileId: share.file_id })
        const permission = permissions.data.permissions?.find((p: any) => p.emailAddress === user.email)
        
        if (permission) {
          await drive.permissions.delete({
            fileId: share.file_id,
            permissionId: permission.id!
          })
        }
      } catch (error) {
        console.warn('Failed to revoke Google Drive permission:', error)
      }
    }

    // Delete from our database
    const { error: deleteError } = await supabaseAdmin
      .from('drive_shares')
      .delete()
      .eq('id', shareId)

    if (deleteError) throw deleteError

    await this.logActivity(userId, 'revoke_share', share.file_id, share.file_name)

    return { success: true }
  }

  async markAsViewed(shareId: string, userId: string) {
    const { error } = await supabaseAdmin
      .from('drive_shares')
      .update({
        viewed: true,
        viewed_at: new Date().toISOString(),
        last_accessed: new Date().toISOString()
      })
      .eq('id', shareId)
      .eq('shared_with', userId)

    if (error) throw error
    return { success: true }
  }

  // ═══════════════════════════════════════════════════════════
  // ACTIVITY LOGGING
  // ═══════════════════════════════════════════════════════════

  private async logActivity(
    userId: string,
    action: string,
    fileId: string,
    fileName: string,
    details?: any
  ) {
    try {
      await supabaseAdmin.from('drive_activity').insert({
        user_id: userId,
        action,
        file_id: fileId,
        file_name: fileName,
        details: details ? JSON.stringify(details) : null
      })
    } catch (error) {
      console.warn('Failed to log activity:', error)
    }
  }
}
