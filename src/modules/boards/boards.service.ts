import { supabaseAdmin } from '../../config/supabase'

export class BoardsService {
  // Get all boards for a project
  async getProjectBoards(projectId: string) {
    const { data: boards, error } = await supabaseAdmin
      .from('boards')
      .select(`
        *,
        project:projects(id, name, description)
      `)
      .eq('project_id', projectId)
      .eq('is_archived', false)
      .order('position', { ascending: true })

    if (error) throw new Error(`Failed to fetch boards: ${error.message}`)

    return boards || []
  }

  // Get single board with all related data
  async getBoardWithDetails(boardId: string, userId?: string, userRole?: string) {
    // Get board
    const { data: board, error: boardError } = await supabaseAdmin
      .from('boards')
      .select(`
        *,
        project:projects(id, name, description, background_type, background_value)
      `)
      .eq('id', boardId)
      .single()

    if (boardError) throw new Error(`Failed to fetch board: ${boardError.message}`)

    // Get board members
    const { data: members, error: membersError} = await supabaseAdmin
      .from('board_members')
      .select(`
        *,
        user:users(id, name, email, role)
      `)
      .eq('board_id', boardId)

    if (membersError) throw new Error(`Failed to fetch board members: ${membersError.message}`)

    // Get lists
    const { data: lists, error: listsError } = await supabaseAdmin
      .from('project_lists')
      .select('*')
      .eq('board_id', boardId)
      .eq('type', 'active')
      .order('position', { ascending: true })

    if (listsError) throw new Error(`Failed to fetch lists: ${listsError.message}`)

    // Get labels
    const { data: labels, error: labelsError } = await supabaseAdmin
      .from('board_labels')
      .select('*')
      .eq('board_id', boardId)
      .order('position', { ascending: true })

    if (labelsError) throw new Error(`Failed to fetch labels: ${labelsError.message}`)

    // Get tasks/cards
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select(`
        *,
        assigned_to_user:users!tasks_assigned_to_fkey(id, name, email),
        creator:users!tasks_created_by_fkey(id, name, email)
      `)
      .eq('board_id', boardId)
      .eq('is_closed', false)
      .order('position', { ascending: true })

    if (tasksError) throw new Error(`Failed to fetch tasks: ${tasksError.message}`)

    // Map tasks to include title field from name
    let formattedTasks = tasks?.map(task => ({
      ...task,
      title: task.name, // Map name to title for frontend compatibility
      public_id: task.id // Use id as public_id if not exists
    })) || []

    // Get task members for all tasks
    const taskIds = formattedTasks?.map(t => t.id) || []
    let taskMembers: any[] = []
    if (taskIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('task_members')
        .select(`
          *,
          user:users(id, name, email)
        `)
        .in('task_id', taskIds)

      if (!error) taskMembers = data || []
    }

    // Get task labels
    let taskLabels: any[] = []
    if (taskIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('task_board_labels')
        .select('*')
        .in('task_id', taskIds)

      if (!error) taskLabels = data || []
    }

    // Map tasks to include labels and assigned_user
    formattedTasks = formattedTasks.map(task => {
      const associatedLabelIds = taskLabels
        .filter(tl => tl.task_id === task.id)
        .map(tl => tl.board_label_id)

      const associatedLabels = labels
        .filter(l => associatedLabelIds.includes(l.id))
        .map(l => ({
          id: l.id,
          colorId: l.id,
          name: l.name,
          color: l.color
        }))

      const associatedMembers = taskMembers
        .filter(tm => tm.task_id === task.id)
        .map(tm => tm.user)

      return {
        ...task,
        assigned_user: task.assigned_to_user || null,
        labels: associatedLabels,
        members: associatedMembers
      }
    })

    return {
      board,
      members: members || [],
      lists: lists || [],
      labels: labels || [],
      tasks: formattedTasks,
      taskMembers: taskMembers,
      taskLabels: taskLabels
    }
  }

  // Create board
  async createBoard(data: {
    project_id: string
    name: string
    description?: string
    position?: number
  }) {
    // Calculate position if not provided
    if (!data.position) {
      const { data: boards } = await supabaseAdmin
        .from('boards')
        .select('position')
        .eq('project_id', data.project_id)
        .order('position', { ascending: false })
        .limit(1)

      data.position = boards && boards.length > 0 ? boards[0].position + 65536 : 65536
    }

    const { data: board, error } = await supabaseAdmin
      .from('boards')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(`Failed to create board: ${error.message}`)

    // Create default lists (To Do, In Progress, Review, Done)
    const defaultLists = [
      { name: 'To Do', position: 65536 },
      { name: 'In Progress', position: 131072 },
      { name: 'Review', position: 196608 },
      { name: 'Done', position: 262144 }
    ]

    for (const list of defaultLists) {
      await supabaseAdmin
        .from('project_lists')
        .insert({
          project_id: data.project_id,
          board_id: board.id,
          name: list.name,
          position: list.position,
          type: 'active'
        })
    }

    // Create archive and trash lists
    await supabaseAdmin
      .from('project_lists')
      .insert([
        {
          project_id: data.project_id,
          board_id: board.id,
          name: 'Archive',
          position: null,
          type: 'archive'
        },
        {
          project_id: data.project_id,
          board_id: board.id,
          name: 'Trash',
          position: null,
          type: 'trash'
        }
      ])

    // Add all users as board members
    try {
      const { data: allUsers } = await supabaseAdmin.from('users').select('id')
      if (allUsers && allUsers.length > 0) {
        const membersToInsert = allUsers.map(u => ({
          board_id: board.id,
          user_id: u.id,
          role: 'editor',
          can_edit: true,
          can_comment: true
        }))
        await supabaseAdmin.from('board_members').insert(membersToInsert)
      }
    } catch (memberErr) {
      console.error('Failed to add all users to board members:', memberErr)
    }

    return board
  }

  // Update board
  async updateBoard(boardId: string, updates: {
    name?: string
    description?: string
    position?: number
    default_view?: string
    show_card_numbers?: boolean
    show_card_ages?: boolean
    show_card_creators?: boolean
    is_archived?: boolean
  }) {
    const { data: board, error } = await supabaseAdmin
      .from('boards')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', boardId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update board: ${error.message}`)

    return board
  }

  // Delete board
  async deleteBoard(boardId: string) {
    const { error } = await supabaseAdmin
      .from('boards')
      .delete()
      .eq('id', boardId)

    if (error) throw new Error(`Failed to delete board: ${error.message}`)

    return { success: true }
  }

  // Add member to board
  async addBoardMember(data: {
    board_id: string
    user_id: string
    role?: 'admin' | 'editor' | 'viewer'
    can_edit?: boolean
    can_comment?: boolean
  }) {
    const { data: member, error } = await supabaseAdmin
      .from('board_members')
      .insert({
        board_id: data.board_id,
        user_id: data.user_id,
        role: data.role || 'editor',
        can_edit: data.can_edit ?? true,
        can_comment: data.can_comment ?? true
      })
      .select(`
        *,
        user:users(id, name, email, role)
      `)
      .single()

    if (error) throw new Error(`Failed to add board member: ${error.message}`)

    return member
  }

  // Update board member
  async updateBoardMember(memberId: string, updates: {
    role?: string
    can_edit?: boolean
    can_comment?: boolean
  }) {
    const { data: member, error } = await supabaseAdmin
      .from('board_members')
      .update(updates)
      .eq('id', memberId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update board member: ${error.message}`)

    return member
  }

  // Remove board member
  async removeBoardMember(memberId: string) {
    const { error } = await supabaseAdmin
      .from('board_members')
      .delete()
      .eq('id', memberId)

    if (error) throw new Error(`Failed to remove board member: ${error.message}`)

    return { success: true }
  }

  // Toggle board favorite
  async toggleFavorite(boardId: string, userId: string) {
    // Check if already favorited
    const { data: existing } = await supabaseAdmin
      .from('board_favorites')
      .select('id')
      .eq('board_id', boardId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      // Remove favorite
      const { error } = await supabaseAdmin
        .from('board_favorites')
        .delete()
        .eq('id', existing.id)

      if (error) throw new Error(`Failed to remove favorite: ${error.message}`)

      return { isFavorite: false }
    } else {
      // Add favorite
      const { error } = await supabaseAdmin
        .from('board_favorites')
        .insert({ board_id: boardId, user_id: userId })

      if (error) throw new Error(`Failed to add favorite: ${error.message}`)

      return { isFavorite: true }
    }
  }

  // Get user's favorite boards
  async getUserFavoriteBoards(userId: string) {
    const { data: favorites, error} = await supabaseAdmin
      .from('board_favorites')
      .select(`
        *,
        board:boards(
          *,
          project:projects(id, name)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch favorites: ${error.message}`)

    return favorites || []
  }
}
