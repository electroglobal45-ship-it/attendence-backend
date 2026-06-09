import { supabaseAdmin } from '../../config/supabase'

export class LabelsService {
  // Get all labels for a board
  async getBoardLabels(boardId: string) {
    const { data: labels, error } = await supabaseAdmin
      .from('board_labels')
      .select('*')
      .eq('board_id', boardId)
      .order('position', { ascending: true })

    if (error) throw new Error(`Failed to fetch board labels: ${error.message}`)
    return labels || []
  }

  async createLabel(data: { board_id: string; name?: string; color: string; position?: number }) {
    if (!data.position) {
      const { data: labels } = await supabaseAdmin
        .from('board_labels')
        .select('position')
        .eq('board_id', data.board_id)
        .order('position', { ascending: false })
        .limit(1)

      data.position = labels && labels.length > 0 ? labels[0].position + 65536 : 65536
    }

    const { data: label, error } = await supabaseAdmin
      .from('board_labels')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(`Failed to create label: ${error.message}`)
    return label
  }

  async updateLabel(labelId: string, updates: { name?: string; color?: string; position?: number }) {
    const { data: label, error } = await supabaseAdmin
      .from('board_labels')
      .update(updates)
      .eq('id', labelId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update label: ${error.message}`)
    return label
  }

  async deleteLabel(labelId: string) {
    const { error } = await supabaseAdmin.from('board_labels').delete().eq('id', labelId)
    if (error) throw new Error(`Failed to delete label: ${error.message}`)
    return { success: true }
  }

  async addLabelToTask(taskId: string, labelId: string) {
    const { data, error } = await supabaseAdmin
      .from('task_board_labels')
      .insert({ task_id: taskId, board_label_id: labelId })
      .select()
      .single()

    if (error) throw new Error(`Failed to add label to task: ${error.message}`)
    return data
  }

  async removeLabelFromTask(taskId: string, labelId: string) {
    const { error } = await supabaseAdmin
      .from('task_board_labels')
      .delete()
      .eq('task_id', taskId)
      .eq('board_label_id', labelId)

    if (error) throw new Error(`Failed to remove label from task: ${error.message}`)
    return { success: true }
  }
}
