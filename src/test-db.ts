import * as dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from './config/supabase';

async function main() {
  console.log("Checking Supabase tasks table...");
  try {
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .limit(1);

    if (error) {
      console.error("Supabase query error:", error);
      return;
    }

    console.log("Supabase connection successful. Sample task data:", data);

    const { data: infoSchema, error: schemaError } = await supabaseAdmin
      .from('information_schema.columns' as any)
      .select('column_name, data_type')
      .eq('table_name', 'tasks');
    
    if (schemaError) {
      console.error("Schema error:", schemaError);
    } else {
      console.log("Columns in 'tasks' table:", infoSchema);
    }
  } catch (err) {
    console.error("Failed to run test:", err);
  }
}

main();
