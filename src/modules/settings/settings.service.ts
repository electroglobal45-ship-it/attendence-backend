import { supabaseAdmin } from '../../config/supabase'

export class SettingsService {
  // Get office locations
  async getOfficeLocations() {
    const { data: locations, error } = await supabaseAdmin
      .from('office_locations')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) throw new Error(`Failed to fetch office locations: ${error.message}`)

    return locations || []
  }

  // Create office location
  async createOfficeLocation(data: {
    name: string
    latitude: number
    longitude: number
    radius_meters?: number
  }) {
    const { data: location, error } = await supabaseAdmin
      .from('office_locations')
      .insert({
        ...data,
        radius_meters: data.radius_meters || 100
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create office location: ${error.message}`)

    return location
  }

  // Update office location
  async updateOfficeLocation(id: string, updates: any) {
    const { data: location, error } = await supabaseAdmin
      .from('office_locations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update office location: ${error.message}`)

    return location
  }

  // Delete office location
  async deleteOfficeLocation(id: string) {
    const { error } = await supabaseAdmin
      .from('office_locations')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete office location: ${error.message}`)

    return { success: true }
  }
}
