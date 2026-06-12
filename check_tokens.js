const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function check() {
  const { data, error } = await supabase.from('google_drive_tokens').select('*');
  console.log('Tokens:', data);
  if (error) console.error(error);
}

check();
