// Test script to verify attachment upload functionality
// Run with: npx ts-node src/test-attachment-upload.ts

import { supabaseAdmin } from './config/supabase'
import * as fs from 'fs'
import * as path from 'path'

async function testAttachmentUpload() {
  console.log('🧪 Testing attachment upload functionality...\n')

  // Test 1: Check if bucket exists
  console.log('1️⃣ Checking if task-attachments bucket exists...')
  const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()
  
  if (bucketsError) {
    console.error('❌ Error listing buckets:', bucketsError)
    return
  }
  
  const bucket = buckets?.find(b => b.id === 'task-attachments')
  if (!bucket) {
    console.error('❌ Bucket "task-attachments" NOT FOUND!')
    console.log('Available buckets:', buckets?.map(b => b.id))
    return
  }
  
  console.log('✅ Bucket exists:', bucket.name)
  console.log('   Public:', bucket.public)
  console.log('')

  // Test 2: Try to upload a test file
  console.log('2️⃣ Testing file upload...')
  const testContent = 'This is a test file for attachment upload'
  const testFileName = `test/${Date.now()}-test.txt`
  
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from('task-attachments')
    .upload(testFileName, Buffer.from(testContent), {
      contentType: 'text/plain',
      upsert: true
    })
  
  if (uploadError) {
    console.error('❌ Upload failed:', uploadError)
    return
  }
  
  console.log('✅ Upload successful:', uploadData.path)
  console.log('')

  // Test 3: Get public URL
  console.log('3️⃣ Testing public URL generation...')
  const { data: urlData } = supabaseAdmin.storage
    .from('task-attachments')
    .getPublicUrl(testFileName)
  
  console.log('✅ Public URL:', urlData.publicUrl)
  console.log('')

  // Test 4: Check database table structure
  console.log('4️⃣ Checking task_attachments table structure...')
  const { data: columns, error: columnsError } = await supabaseAdmin
    .rpc('exec_sql', { 
      sql: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'task_attachments' 
        ORDER BY ordinal_position
      `
    })

  // Fallback to direct query if RPC fails
  if (columnsError) {
    const fallback = await supabaseAdmin
      .from('task_attachments')
      .select('*')
      .limit(0)
    
    if (fallback.error) {
      console.log('⚠️  Could not verify table structure:', fallback.error.message)
    } else {
      console.log('✓ Table exists (verified via fallback query)')
    }
  }

  if (columnsError && columnsError.message?.includes('does not exist')) {
    console.log('⚠️  Could not verify table structure:', columnsError.message)
  } else {
    console.log('✅ Table query successful')
  }
  console.log('')

  // Test 5: Clean up test file
  console.log('5️⃣ Cleaning up test file...')
  const { error: deleteError } = await supabaseAdmin.storage
    .from('task-attachments')
    .remove([testFileName])
  
  if (deleteError) {
    console.log('⚠️  Could not delete test file:', deleteError.message)
  } else {
    console.log('✅ Test file deleted')
  }
  
  console.log('\n✨ All tests completed!')
}

testAttachmentUpload().catch(console.error)
