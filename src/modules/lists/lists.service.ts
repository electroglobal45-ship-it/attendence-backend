import { supabaseAdmin } from '../../config/supabase'

export class ListsService {
  // Create list
  async createList(data: {
    project_id: string
    board_id: string
    name: string
    position?: number
    color?: string
  }) {
    // Calculate position if not provided
    if (!data.position) {
      const { data: lists } = await supabaseAdmin
        .from('project_lists')
        .select('position')
        .eq('board_id', data.board_id)
        .eq('type', 'active')
        .order('position', { ascending: false })
        .limit(1)

      data.position = lists && lists.length > 0 ? lists[0].position + 65536 : 65536
    }

    const { data: list, error } = await supabaseAdmin
      .from('project_lists')
      .insert({ ...data, type: 'active' })
      .select()
      .single()

    if (error) throw new Error(`Failed to create list: ${error.message}`)

    return list
  }

  // Update list
  async updateList(listId: string, updates: {
    name?: string
    position?: number
    color?: string
  }) {
    const { data: list, error } = await supabaseAdmin
      .from('project_lists')
      .update(updates)
      .eq('id', listId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update list: ${error.message}`)

    return list
  }

  // Delete list (moves cards to trash)
  async deleteList(listId: string) {
    // Get trash list for this board
    const { data: currentList } = await supabaseAdmin
      .from('project_lists')
      .select('board_id')
      .eq('id', listId)
      .single()

    if (currentList) {
      const { data: trashList } = await supabaseAdmin
        .from('project_lists')
        .select('id')
        .eq('board_id', currentList.board_id)
        .eq('type', 'trash')
        .single()

      if (trashList) {
        // Move cards to trash
        await supabaseAdmin
          .from('tasks')
          .update({ list_id: trashList.id, position: null })
          .eq('list_id', listId)
      }
    }

    // Delete list
    const { error } = await supabaseAdmin
      .from('project_lists')
      .delete()
      .eq('id', listId)

    if (error) throw new Error(`Failed to delete list: ${error.message}`)

    return { success: true }
  }

  // Move cards between lists
  async moveCards(sourceListId: string, targetListId: string) {
    const { data: tasks, error } = await supabaseAdmin
      .from('tasks')
      .update({ list_id: targetListId, list_changed_at: new Date().toISOString() })
      .eq('list_id', sourceListId)
      .select()

    if (error) throw new Error(`Failed to move cards: ${error.message}`)

    return tasks || []
  }

  // Sort cards in list
  async sortCards(listId: string, sortBy: 'name' | 'due_date' | 'created_at', order: 'asc' | 'desc' = 'asc') {
    const { data: tasks, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('list_id', listId)
      .order(sortBy, { ascending: order === 'asc' })

    if (error) throw new Error(`Failed to sort cards: ${error.message}`)

    // Update positions
    for (let i = 0; i < (tasks?.length || 0); i++) {
      await supabaseAdmin
        .from('tasks')
        .update({ position: (i + 1) * 65536 })
        .eq('id', tasks![i].id)
    }

    return tasks || []
  }
}
