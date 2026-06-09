import { supabaseAdmin } from '../config/supabase'

// Upload file to Supabase Storage
export const uploadFile = async (
  bucket: string,
  path: string,
  fileBuffer: Buffer,
  contentType: string
) => {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, fileBuffer, { contentType, upsert: true })
  
  if (error) throw error
  return data
}

// Get public URL for uploaded file
export const getPublicUrl = (bucket: string, path: string): string => {
  const { data } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(path)
  return data.publicUrl
}

// Delete file from storage
export const deleteFile = async (bucket: string, path: string) => {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove([path])
  
  if (error) throw error
}

// Upload selfie from base64
export const uploadSelfieFromBase64 = async (
  employeeId: string,
  base64Data: string
): Promise<string> => {
  // Remove data:image/jpeg;base64, prefix if present
  const base64String = base64Data.includes(',') 
    ? base64Data.split(',')[1] 
    : base64Data
  
  const buffer = Buffer.from(base64String, 'base64')
  const fileName = `${employeeId}-${Date.now()}.jpg`
  const path = `selfies/${fileName}`
  
  await uploadFile('attendance-selfies', path, buffer, 'image/jpeg')
  return getPublicUrl('attendance-selfies', path)
}

// Upload task attachment
export const uploadTaskAttachment = async (
  taskId: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<{ url: string; path: string }> => {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  const path = `tasks/${taskId}/${Date.now()}-${sanitizedFileName}`
  
  await uploadFile('task-attachments', path, fileBuffer, contentType)
  const url = getPublicUrl('task-attachments', path)
  
  return { url, path }
}
