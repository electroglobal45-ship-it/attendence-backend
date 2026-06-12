import { supabaseAdmin } from '../../config/supabase'
import { uploadTaskAttachment as uploadToStorage, deleteFile } from '../../utils/storage'

export class TasksService {
  // Get all tasks with employee names
  async getAllTasks() {
    const { data: tasks, error } = await supabaseAdmin
      .from('tasks')
      .select(`
        *,
        assigned_to_user:users!tasks_assigned_to_fkey(id, name, email),
        board:boards(id, name),
        task_board_labels(
          board_label:board_labels(id, name, color)
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`)

    // Format the response with labels already loaded
    const formattedTasks = tasks?.map(task => ({
      ...task,
      title: task.name || '',
      assigned_to_name: task.assigned_to_user?.name || null,
      assigned_to_email: task.assigned_to_user?.email || null,
      assigned_user: task.assigned_to_user,
      board: task.board || null,
      labels: task.task_board_labels?.map((tbl: any) => ({
        id: tbl.board_label.id,
        colorId: tbl.board_label.id,
        name: tbl.board_label.name,
        color: tbl.board_label.color
      }))?.slice(0, 1) || [] // Single label enforcement
    })) || []

    return formattedTasks
  }

  // Get tasks for a specific user
  async getUserTasks(userId: string) {
    // 1. Get all task IDs where this user is a member
    const { data: memberTasks } = await supabaseAdmin
      .from('task_members')
      .select('task_id')
      .eq('user_id', userId)

    const memberTaskIds = memberTasks?.map(mt => mt.task_id) || []

    // 2. Fetch tasks where user is assignee or member with labels
    let query = supabaseAdmin
      .from('tasks')
      .select(`
        *,
        assigned_to_user:users!tasks_assigned_to_fkey(id, name, email),
        board:boards(id, name),
        task_board_labels(
          board_label:board_labels(id, name, color)
        )
      `)

    if (memberTaskIds.length > 0) {
      query = query.or(`assigned_to.eq.${userId},id.in.(${memberTaskIds.join(',')})`)
    } else {
      query = query.eq('assigned_to', userId)
    }

    const { data: tasks, error } = await query.order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch user tasks: ${error.message}`)

    const formattedTasks = tasks?.map(task => ({
      ...task,
      title: task.name || '',
      assigned_to_name: task.assigned_to_user?.name || null,
      assigned_to_email: task.assigned_to_user?.email || null,
      assigned_user: task.assigned_to_user,
      board: task.board || null,
      labels: task.task_board_labels?.map((tbl: any) => ({
        id: tbl.board_label.id,
        colorId: tbl.board_label.id,
        name: tbl.board_label.name,
        color: tbl.board_label.color
      }))?.slice(0, 1) || []
    })) || []

    return formattedTasks
  }

  // Create a new task
  async createTask(data: {
    title: string
    description?: string
    assigned_to: string
    due_date?: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    status?: 'todo' | 'in_progress' | 'review' | 'done'
    project_id?: string
    list_id?: string
  }) {
    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        name: data.title, // Map title to name for database
        description: data.description,
        assigned_to: data.assigned_to,
        due_date: data.due_date,
        priority: data.priority,
        status: data.status || 'todo',
        project_id: data.project_id,
        list_id: data.list_id,
      })
      .select(`
        *,
        assigned_to_user:users!tasks_assigned_to_fkey(id, name, email)
      `)
      .single()

    if (error) throw new Error(`Failed to create task: ${error.message}`)

    return {
      ...task,
      title: task.name, // Map name back to title
      assigned_to_name: task.assigned_to_user?.name || null,
      assigned_to_email: task.assigned_to_user?.email || null,
      assigned_to_user: undefined
    }
  }

  // Quick create task for Kanban
  async quickCreateTask(data: {
    title: string
    list_id: string
    project_id?: string
    board_id?: string
    position?: number
    created_by: string
    assigned_to: string
  }) {
    // Get project_id from board if not provided
    let projectId = data.project_id
    if (!projectId && data.board_id) {
      const { data: board } = await supabaseAdmin
        .from('boards')
        .select('project_id')
        .eq('id', data.board_id)
        .single()
      
      if (board) projectId = board.project_id
    }

    // If still no project_id, get from list
    if (!projectId && data.list_id) {
      const { data: list } = await supabaseAdmin
        .from('project_lists')
        .select('project_id')
        .eq('id', data.list_id)
        .single()
      
      if (list) projectId = list.project_id
    }

    // Calculate position if not provided
    let position = data.position || 65536
    if (!data.position && data.list_id) {
      const { data: existingTasks } = await supabaseAdmin
        .from('tasks')
        .select('position')
        .eq('list_id', data.list_id)
        .order('position', { ascending: false })
        .limit(1)

      if (existingTasks && existingTasks.length > 0) {
        position = (existingTasks[0].position || 0) + 65536
      }
    }

    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        name: data.title,
        list_id: data.list_id,
        project_id: projectId,
        board_id: data.board_id,
        position,
        created_by: data.created_by,
        assigned_to: data.assigned_to,
        priority: 'medium',
        status: 'todo',
        is_closed: false
      })
      .select(`
        *,
        assigned_to_user:users!tasks_assigned_to_fkey(id, name, email)
      `)
      .single()

    if (error) throw new Error(`Failed to create task: ${error.message}`)

    return {
      ...task,
      title: task.name,
      public_id: task.id,
      assigned_to_name: task.assigned_to_user?.name || null,
      assigned_to_email: task.assigned_to_user?.email || null,
      assigned_user: task.assigned_to_user
    }
  }

  // Update task status (for drag and drop)
  async updateTaskStatus(taskId: string, status: string) {
    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update task status: ${error.message}`)

    // Log activity
    await this.logTaskActivity(taskId, `moved task to ${status}`, true)

    return task
  }

  // Move task between lists
  async moveTask(taskId: string, destinationListId: string, position: number) {
    // Calculate position if needed
    const newPosition = (position + 1) * 65536

    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .update({ 
        list_id: destinationListId, 
        position: newPosition,
        list_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', taskId)
      .select(`
        *,
        assigned_to_user:users!tasks_assigned_to_fkey(id, name, email)
      `)
      .single()

    if (error) throw new Error(`Failed to move task: ${error.message}`)

    // Log activity
    await this.logTaskActivity(taskId, 'moved task to another list', true)

    return {
      ...task,
      title: task.name,
      public_id: task.id,
      assigned_user: task.assigned_to_user
    }
  }

  // Update task details
  async updateTask(taskId: string, updates: {
    title?: string
    name?: string
    description?: string
    due_date?: string
    priority?: string
    assigned_to?: string | null
    color_label?: string
    labels?: any[]
  }, userId?: string) {
    // Sync labels if they are passed in updates
    if (updates.labels) {
      await this.syncTaskLabels(taskId, updates.labels)
    }

    // Map title to name for database
    const dbUpdates: any = { ...updates, updated_at: new Date().toISOString() }
    if (updates.title) {
      dbUpdates.name = updates.title
      delete dbUpdates.title
    }

    // Strip labels from dbUpdates so it doesn't try to save to non-existent column
    delete dbUpdates.labels

    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .update(dbUpdates)
      .eq('id', taskId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update task: ${error.message}`)

    // Log activity for each changed field
    const activityLog: string[] = []
    if (updates.description !== undefined) activityLog.push('updated the description')
    if (updates.priority) activityLog.push(`changed priority to ${updates.priority}`)
    if (updates.due_date !== undefined) activityLog.push('changed the due date')
    if (updates.labels && updates.labels.length > 0) activityLog.push(`changed label to ${updates.labels[0]?.name || updates.labels[0]?.id || ''}`)
    if (updates.assigned_to !== undefined) activityLog.push('changed assignment')
    if (updates.title || updates.name) activityLog.push('renamed the task')

    for (const activity of activityLog) {
      await this.logTaskActivity(taskId, activity, false, userId)
    }

    const mergedList = await this.mergeTaskLabels([task])
    const mergedTask = mergedList[0]

    return {
      ...mergedTask,
      title: mergedTask.name // Map name back to title for frontend
    }
  }

  // Delete task
  async deleteTask(taskId: string) {
    const { error } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (error) throw new Error(`Failed to delete task: ${error.message}`)

    return { success: true }
  }

  // Get task comments
  async getTaskComments(taskId: string) {
    const { data: comments, error } = await supabaseAdmin
      .from('task_comments')
      .select(`
        *,
        users:user_id(id, name, email)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(`Failed to fetch comments: ${error.message}`)

    return comments || []
  }

  // Add task comment
  async addTaskComment(taskId: string, userId: string, comment: string, attachments?: any[]) {
    const { data, error } = await supabaseAdmin
      .from('task_comments')
      .insert({
        task_id: taskId,
        user_id: userId,
        content: comment,
        attachments: attachments || []
      })
      .select(`
        *,
        users:user_id(id, name, email)
      `)
      .single()

    if (error) throw new Error(`Failed to add comment: ${error.message}`)

    // Log activity
    await this.logTaskActivity(taskId, `commented on this task`, false, userId)

    return data
  }

  // Delete task comment
  async deleteTaskComment(commentId: string, userId: string) {
    const { error } = await supabaseAdmin
      .from('task_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId) // Only delete own comments

    if (error) throw new Error(`Failed to delete comment: ${error.message}`)
    return { success: true }
  }

  // Get task attachments
  async getTaskAttachments(taskId: string) {
    const { data: attachments, error } = await supabaseAdmin
      .from('task_attachments')
      .select(`
        *,
        user:uploaded_by(id, name, email)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch attachments: ${error.message}`)

    const formattedAttachments = attachments?.map(att => ({
      ...att,
      user_name: att.user?.name || 'Unknown',
      user: undefined
    }))

    return formattedAttachments || []
  }

  // Upload task attachment
  async uploadTaskAttachment(taskId: string, userId: string, file: Express.Multer.File) {
    // 1. Upload file to Supabase Storage
    const { url: fileUrl, path: filePath } = await uploadToStorage(taskId, file.originalname, file.buffer, file.mimetype)

    // 2. Save metadata to task_attachments table
    const { data: attachment, error } = await supabaseAdmin
      .from('task_attachments')
      .insert({
        task_id: taskId,
        uploaded_by: userId,  // Changed from user_id to uploaded_by
        file_name: file.originalname,
        file_url: fileUrl,
        file_path: filePath,
        file_size: file.size,
        file_type: file.mimetype,
      })
      .select(`
        *,
        user:uploaded_by(id, name, email)
      `)
      .single()

    if (error) throw new Error(`Failed to save attachment: ${error.message}`)

    // Log activity
    await this.logTaskActivity(taskId, `attached "${file.originalname}"`, false, userId)

    return {
      ...attachment,
      user_name: (attachment as any).user?.name || 'Unknown',
      user: undefined
    }
  }

  // Delete task attachment
  async deleteTaskAttachment(attachmentId: string) {
    // Get file path first
    const { data: att, error: fetchErr } = await supabaseAdmin
      .from('task_attachments')
      .select('file_url, task_id')
      .eq('id', attachmentId)
      .single()

    if (fetchErr || !att) throw new Error('Attachment not found')

    // Delete from storage (extract path from URL)
    try {
      const url = att.file_url as string
      const pathStart = url.indexOf('/task-attachments/') + '/task-attachments/'.length
      const storagePath = url.substring(pathStart)
      await deleteFile('task-attachments', storagePath)
    } catch (storageErr) {
      console.error('Storage delete error (continuing):', storageErr)
    }

    // Delete from DB
    const { error } = await supabaseAdmin
      .from('task_attachments')
      .delete()
      .eq('id', attachmentId)

    if (error) throw new Error(`Failed to delete attachment: ${error.message}`)
    return { success: true }
  }

  // Log task activity
  async logTaskActivity(taskId: string, activity: string, isSystem: boolean = true, userId?: string) {
    const { error } = await supabaseAdmin
      .from('task_activities')
      .insert({
        task_id: taskId,
        activity,
        is_system: isSystem,
        user_id: userId || null
      })

    if (error) {
      console.error('Failed to log activity:', error.message)
    }
  }

  // Get task activities
  async getTaskActivities(taskId: string) {
    const { data: activities, error } = await supabaseAdmin
      .from('task_activities')
      .select(`
        *,
        users:user_id (
          id,
          name,
          email
        )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw new Error(`Failed to fetch activities: ${error.message}`)

    return activities || []
  }

  // Get task members
  async getTaskMembers(taskId: string) {
    const { data: members, error } = await supabaseAdmin
      .from('task_members')
      .select(`
        *,
        user:users(id, name, email, role)
      `)
      .eq('task_id', taskId)

    if (error) throw new Error(`Failed to fetch task members: ${error.message}`)

    const formattedMembers = members?.map(member => ({
      id: member.user?.id,
      name: member.user?.name,
      email: member.user?.email,
      role: member.user?.role
    }))

    return formattedMembers || []
  }

  // Add task member
  async addTaskMember(taskId: string, userId: string) {
    const { data: member, error } = await supabaseAdmin
      .from('task_members')
      .insert({ task_id: taskId, user_id: userId })
      .select(`
        *,
        user:users(id, name, email, role)
      `)
      .single()

    if (error) {
      // Check if it's a duplicate error
      if (error.code === '23505') {
        throw new Error('User is already a member of this task')
      }
      throw new Error(`Failed to add task member: ${error.message}`)
    }

    return {
      id: member.user?.id,
      name: member.user?.name,
      email: member.user?.email,
      role: member.user?.role
    }
  }

  // Remove task member
  async removeTaskMember(taskId: string, userId: string) {
    const { error } = await supabaseAdmin
      .from('task_members')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', userId)

    if (error) throw new Error(`Failed to remove task member: ${error.message}`)

    return { success: true }
  }

  // Get task checklist
  async getTaskChecklist(taskId: string) {
    const { data: items, error } = await supabaseAdmin
      .from('task_checklist')
      .select('*')
      .eq('task_id', taskId)
      .order('position', { ascending: true })

    if (error) throw new Error(`Failed to fetch checklist: ${error.message}`)

    return items || []
  }

  // Add checklist item
  async addChecklistItem(taskId: string, text: string) {
    // Get current max position
    const { data: existing } = await supabaseAdmin
      .from('task_checklist')
      .select('position')
      .eq('task_id', taskId)
      .order('position', { ascending: false })
      .limit(1)

    const position = existing && existing.length > 0 ? existing[0].position + 1 : 0

    const { data: item, error } = await supabaseAdmin
      .from('task_checklist')
      .insert({
        task_id: taskId,
        text,
        checked: false,
        position
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to add checklist item: ${error.message}`)

    return item
  }

  // Update checklist item
  async updateChecklistItem(itemId: string, updates: { text?: string; checked?: boolean }) {
    const { data: item, error } = await supabaseAdmin
      .from('task_checklist')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update checklist item: ${error.message}`)

    return item
  }

  // Delete checklist item
  async deleteChecklistItem(itemId: string) {
    const { error } = await supabaseAdmin
      .from('task_checklist')
      .delete()
      .eq('id', itemId)

    if (error) throw new Error(`Failed to delete checklist item: ${error.message}`)

    return { success: true }
  }

  // Helper to sync labels for a task to task_board_labels table (SINGLE LABEL ONLY - DYNAMIC)
  async syncTaskLabels(taskId: string, labelsInput: any[]) {
    try {
      console.log('syncTaskLabels called with:', { taskId, labelsInput })

      // 1. Get task details to know board_id
      const { data: task, error: taskError } = await supabaseAdmin
        .from('tasks')
        .select('board_id')
        .eq('id', taskId)
        .single()

      if (taskError || !task || !task.board_id) {
        console.error('Task not found or no board_id:', taskError)
        return
      }
      
      const boardId = task.board_id

      // 2. Only use the FIRST label (single label enforcement)
      if (!labelsInput || labelsInput.length === 0) {
        console.log('No labels provided, deleting all labels for task:', taskId)
        await supabaseAdmin
          .from('task_board_labels')
          .delete()
          .eq('task_id', taskId)
        return
      }

      const label = labelsInput[0] // ONLY TAKE THE FIRST LABEL
      
      // Extract the label ID - support multiple input formats
      let boardLabelId = ''
      
      if (typeof label === 'string') {
        // Direct label ID
        boardLabelId = label
      } else if (label.id) {
        // Label object with id
        boardLabelId = label.id
      } else {
        console.error('Invalid label format:', label)
        return
      }
      
      console.log('Syncing task to label:', { taskId, boardLabelId })

      // 3. Verify the label exists and belongs to the correct board
      const { data: existingLabel, error: labelError } = await supabaseAdmin
        .from('board_labels')
        .select('id, name, color')
        .eq('id', boardLabelId)
        .eq('board_id', boardId)
        .single()

      if (labelError || !existingLabel) {
        console.error('Label not found or does not belong to this board:', { boardLabelId, boardId, labelError })
        return
      }

      console.log('Label verified:', existingLabel)

      // 4. Delete ALL existing labels for this task
      await supabaseAdmin
        .from('task_board_labels')
        .delete()
        .eq('task_id', taskId)

      // 5. Insert the single new label
      const { error: insertError } = await supabaseAdmin
        .from('task_board_labels')
        .insert({
          task_id: taskId,
          board_label_id: boardLabelId
        })
      
      if (insertError) {
        console.error('Error inserting task label:', insertError)
      } else {
        console.log('Successfully linked task to label:', existingLabel.name)
      }
    } catch (err) {
      console.error('Error syncing task labels:', err)
    }
  }

  // Helper to fetch and merge task labels from relational tables (SINGLE LABEL ONLY)
  async mergeTaskLabels(tasks: any[]) {
    if (!tasks || tasks.length === 0) return [];

    const taskIds = tasks.map(t => t.id);

    // Fetch task-label relations
    const { data: taskLabels, error: tlError } = await supabaseAdmin
      .from('task_board_labels')
      .select('task_id, board_label_id')
      .in('task_id', taskIds);

    if (tlError || !taskLabels || taskLabels.length === 0) {
      return tasks.map(t => ({ ...t, labels: [] }));
    }

    const labelIds = Array.from(new Set(taskLabels.map(tl => tl.board_label_id)));

    // Fetch label definitions
    const { data: labels, error: lError } = await supabaseAdmin
      .from('board_labels')
      .select('id, name, color')
      .in('id', labelIds);

    if (lError || !labels) {
      return tasks.map(t => ({ ...t, labels: [] }));
    }

    return tasks.map(task => {
      const associatedLabelIds = taskLabels
        .filter(tl => tl.task_id === task.id)
        .map(tl => tl.board_label_id);

      // ONLY RETURN THE FIRST LABEL (single label enforcement)
      const associatedLabels = labels
        .filter(l => associatedLabelIds.includes(l.id))
        .slice(0, 1) // Only take the first label
        .map(l => ({
          id: l.id,
          colorId: l.id,
          name: l.name,
          color: l.color
        }));

      return {
        ...task,
        labels: associatedLabels
      };
    });
  }

  // Reorder tasks (batch update positions)
  async reorderTasks(tasks: Array<{ id: string; position: number }>) {
    try {
      // Update each task's position
      const updates = tasks.map(({ id, position }) =>
        supabaseAdmin
          .from('tasks')
          .update({ position, updated_at: new Date().toISOString() })
          .eq('id', id)
      )

      // Execute all updates in parallel
      await Promise.all(updates)

      return { success: true }
    } catch (error) {
      console.error('Error reordering tasks:', error)
      throw new Error('Failed to reorder tasks')
    }
  }
}
