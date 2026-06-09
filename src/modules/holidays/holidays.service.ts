import { supabaseAdmin } from '../../config/supabase'

export class HolidaysService {
  // Get all holidays
  async getAllHolidays(year?: number) {
    let query = supabaseAdmin
      .from('holidays')
      .select('*')
      .order('date', { ascending: true })

    if (year) {
      query = query.gte('date', `${year}-01-01`)
                   .lte('date', `${year}-12-31`)
    }

    const { data: holidays, error } = await query

    if (error) throw new Error(`Failed to fetch holidays: ${error.message}`)

    return holidays || []
  }

  // Create holiday
  async createHoliday(data: {
    date: string
    name: string
    is_mandatory?: boolean
  }) {
    const { data: holiday, error } = await supabaseAdmin
      .from('holidays')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(`Failed to create holiday: ${error.message}`)

    return holiday
  }

  // Update holiday
  async updateHoliday(id: string, updates: {
    date?: string
    name?: string
    is_mandatory?: boolean
  }) {
    const { data: holiday, error } = await supabaseAdmin
      .from('holidays')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update holiday: ${error.message}`)

    return holiday
  }

  // Delete holiday
  async deleteHoliday(id: string) {
    const { error } = await supabaseAdmin
      .from('holidays')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete holiday: ${error.message}`)

    return { success: true }
  }
}
