import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('Testing RPC exec_sql...')
  const { data, error } = await supabaseAdmin.rpc('exec_sql', {
    sql: 'ALTER TABLE boards ADD COLUMN IF NOT EXISTS team_leader_id UUID REFERENCES users(id) ON DELETE SET NULL;'
  })
  
  if (error) {
    console.log('exec_sql failed:', error.message)
    
    console.log('Testing RPC run_sql...')
    const { data: data2, error: error2 } = await supabaseAdmin.rpc('run_sql', {
      sql: 'ALTER TABLE boards ADD COLUMN IF NOT EXISTS team_leader_id UUID REFERENCES users(id) ON DELETE SET NULL;'
    })
    
    if (error2) {
      console.log('run_sql failed:', error2.message)
    } else {
      console.log('run_sql SUCCESS!', data2)
    }
  } else {
    console.log('exec_sql SUCCESS!', data)
  }
  
  // Verify columns of boards table
  const { data: boards, error: boardsErr } = await supabaseAdmin
    .from('boards')
    .select('*')
    .limit(1)
    
  if (boardsErr) {
    console.error('Error querying boards:', boardsErr.message)
  } else if (boards && boards.length > 0) {
    console.log('Current boards columns:', Object.keys(boards[0]))
  } else {
    console.log('No boards found to inspect.')
  }
}

run().catch(console.error)
