import * as dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from './config/supabase';

async function main() {
  console.log("Checking board_labels table...");
  try {
    const { data: boardLabels, error: error1 } = await supabaseAdmin
      .from('board_labels')
      .select('*')
      .limit(5);

    if (error1) {
      console.error("board_labels error:", error1);
    } else {
      console.log("board_labels data:", boardLabels);
    }

    console.log("Checking task_board_labels table...");
    const { data: taskBoardLabels, error: error2 } = await supabaseAdmin
      .from('task_board_labels')
      .select('*')
      .limit(5);

    if (error2) {
      console.error("task_board_labels error:", error2);
    } else {
      console.log("task_board_labels data:", taskBoardLabels);
    }
  } catch (err) {
    console.error("Error running test:", err);
  }
}

main();
