import * as dotenv from 'dotenv';
dotenv.config();

import { TasksService } from './modules/tasks/tasks.service';
import { supabaseAdmin } from './config/supabase';

async function main() {
  console.log("Testing task update with labels via TasksService...");
  const tasksService = new TasksService();
  try {
    const { data: task } = await supabaseAdmin.from('tasks').select('id').limit(1).single();
    if (!task) {
      console.log("No task found to update.");
      return;
    }
    console.log("Updating task ID:", task.id);
    const updated = await tasksService.updateTask(task.id, {
      priority: 'high',
      labels: [{ id: 'high', colorId: 'high', name: 'HIGH PRIORITY' }]
    });
    console.log("Update successful. Result:", updated);
  } catch (err) {
    console.error("Error during TasksService update:", err);
  }
}

main();
