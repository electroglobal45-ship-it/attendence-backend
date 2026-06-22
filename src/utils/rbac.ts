import { supabaseAdmin } from '../config/supabase'

/**
 * Resolves a listId to its corresponding boardId.
 */
export async function getBoardIdFromListId(listId: string): Promise<string | null> {
  if (!listId) return null
  try {
    const { data: list, error } = await supabaseAdmin
      .from('project_lists')
      .select('board_id')
      .eq('id', listId)
      .single()
    return list?.board_id || null
  } catch (err) {
    return null
  }
}

/**
 * Checks if a user has permission to manage/assign tasks on a board.
 * Returns true if the user is an admin or the designated team leader of the board.
 */
export async function canUserManageBoard(userId: string, userRole: string, boardId: string): Promise<boolean> {
  if (userRole === 'admin') return true
  if (userRole !== 'team leader') return false
  if (!boardId) return false

  try {
    const { data: board, error } = await supabaseAdmin
      .from('boards')
      .select('team_leader_id')
      .eq('id', boardId)
      .single()

    if (error || !board) return false
    return board.team_leader_id === userId
  } catch (err) {
    console.error('Error in canUserManageBoard:', err)
    return false
  }
}

/**
 * Checks if a user has permission to manage/assign tasks inside a list.
 * Returns true if the user is an admin or the designated team leader of the list's board.
 */
export async function canUserManageList(userId: string, userRole: string, listId: string): Promise<boolean> {
  if (userRole === 'admin') return true
  if (userRole !== 'team leader') return false
  const boardId = await getBoardIdFromListId(listId)
  if (!boardId) return false
  return canUserManageBoard(userId, userRole, boardId)
}

/**
 * Checks if a user has permission to manage/assign a specific task.
 * Returns true if the user is an admin or the designated team leader of the task's board.
 */
export async function canUserManageTask(userId: string, userRole: string, taskId: string): Promise<boolean> {
  if (userRole === 'admin') return true
  if (userRole !== 'team leader') return false
  if (!taskId) return false

  try {
    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .select('board_id')
      .eq('id', taskId)
      .single()

    if (error || !task || !task.board_id) return false
    return canUserManageBoard(userId, userRole, task.board_id)
  } catch (err) {
    console.error('Error in canUserManageTask:', err)
    return false
  }
}
