import { supabaseAdmin } from '../../config/supabase'

export class BoardsService {
  // Get all boards for a project
  async getProjectBoards(projectId: string, userId?: string, userRole?: string) {
    if (userRole === 'employee' && userId) {
      const { data: boards, error } = await supabaseAdmin
        .from('boards')
        .select(`
          *,
          project:projects(id, name, description),
          board_members!inner(user_id)
        `)
        .eq('project_id', projectId)
        .eq('is_archived', false)
        .eq('board_members.user_id', userId)
        .order('position', { ascending: true })

      if (error) throw new Error(`Failed to fetch boards: ${error.message}`)
      return boards || []
    }

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
    if (userRole === 'employee' && userId) {
      const { data: member, error: memberError } = await supabaseAdmin
        .from('board_members')
        .select('id')
        .eq('board_id', boardId)
        .eq('user_id', userId)
        .maybeSingle()

      if (memberError || !member) {
        throw new Error('Access denied: You are not assigned to this board.')
      }
    }

    // Single optimized query with all relations
    const { data: boardData, error: boardError } = await supabaseAdmin
      .from('boards')
      .select(`
        *,
        project:projects!inner(
          id, name, description, background_type, background_value
        )
      `)
      .eq('id', boardId)
      .single()

    if (boardError) throw new Error(`Failed to fetch board: ${boardError.message}`)

    // Fetch all board data in parallel (not sequential!)
    const [
      { data: members },
      { data: lists },
      { data: labels },
      { data: tasks }
    ] = await Promise.all([
      // Members
      supabaseAdmin
        .from('board_members')
        .select('*, user:users!inner(id, name, email, role)')
        .eq('board_id', boardId),
      
      // Lists
      supabaseAdmin
        .from('project_lists')
        .select('*')
        .eq('board_id', boardId)
        .eq('type', 'active')
        .order('position'),
      
      // Labels
      supabaseAdmin
        .from('board_labels')
        .select('*')
        .eq('board_id', boardId)
        .order('position'),
      
      // Tasks with ALL relations in ONE query
      supabaseAdmin
        .from('tasks')
        .select(`
          *,
          assigned_to_user:users!tasks_assigned_to_fkey(id, name, email),
          creator:users!tasks_created_by_fkey(id, name, email),
          task_members(
            user:users(id, name, email)
          ),
          task_board_labels(
            board_label:board_labels(id, name, color)
          )
        `)
        .eq('board_id', boardId)
        .eq('is_closed', false)
        .order('position')
    ])

    // Format tasks (all data already loaded!)
    const formattedTasks = tasks?.map(task => ({
      ...task,
      title: task.name,
      public_id: task.id,
      assigned_user: task.assigned_to_user,
      labels: task.task_board_labels?.map((tbl: any) => ({
        id: tbl.board_label.id,
        colorId: tbl.board_label.id,
        name: tbl.board_label.name,
        color: tbl.board_label.color
      })) || [],
      members: task.task_members?.map((tm: any) => tm.user) || []
    })) || []

    return {
      board: boardData,
      members: members || [],
      lists: lists || [],
      labels: labels || [],
      tasks: formattedTasks
    }
  }

  // Create board
  async createBoard(data: {
    project_id: string
    name: string
    description?: string
    team_leader_id?: string | null
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

    // Add only the assigned Team Leader to board members by default (if provided)
    if (data.team_leader_id) {
      try {
        await supabaseAdmin.from('board_members').insert({
          board_id: board.id,
          user_id: data.team_leader_id,
          role: 'admin',
          can_edit: true,
          can_comment: true
        })
      } catch (memberErr) {
        console.error('Failed to add team leader to board members:', memberErr)
      }
    }

    return board
  }

  // Update board
  async updateBoard(boardId: string, updates: {
    name?: string
    description?: string
    team_leader_id?: string | null
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
