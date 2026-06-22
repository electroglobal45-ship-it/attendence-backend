import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('Querying DB conversations table structure...')
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error('Error querying conversations:', error)
  } else if (data && data.length > 0) {
    console.log('Conversations columns:', Object.keys(data[0]))
    console.log('Conversations sample:', data[0])
  } else {
    console.log('No conversations found to inspect.')
  }
}

run().catch(console.error)
