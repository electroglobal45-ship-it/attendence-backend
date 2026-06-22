import * as dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from './config/supabase';

async function main() {
  console.log("Checking Supabase password_vault table...");
  try {
    const { data: testSelect, error: selectError } = await supabaseAdmin
      .from('password_vault')
      .select('site_url' as any)
      .limit(1);
    
    if (selectError) {
      console.log("site_url column does NOT exist:", selectError.message);
    } else {
      console.log("site_url column EXISTS!");
    }
  } catch (err) {
    console.error("Failed to run test:", err);
  }
}

main();
