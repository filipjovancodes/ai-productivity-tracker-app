"use server"

import { createClient } from "@/lib/supabase/server"
import type { Activity } from "@/lib/types"

export interface ActivityEditData {
  activity_name?: string
  started_at?: string
  ended_at?: string
  duration_minutes?: number
}

export async function getActivityDetails(activityId: string): Promise<{ success: boolean; error?: string; activity?: Activity }> {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .rpc('get_n8n_activity', { p_activity_id: activityId })
      .single()

    if (error) {
      console.error("Error fetching activity details:", error)
      return { success: false, error: error.message }
    }
    return { success: true, activity: data as Activity }
  } catch (error) {
    console.error("Error in getActivityDetails:", error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function updateActivity(
  activityId: string,
  updateData: ActivityEditData
): Promise<{ success: boolean; error?: string; activityId?: string }> {
  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase
      .rpc('edit_n8n_activity', {
        p_activity_id: activityId,
        p_activity_name: updateData.activity_name,
        p_started_at: updateData.started_at,
        p_ended_at: updateData.ended_at,
        p_duration_minutes: updateData.duration_minutes
      })

    if (error) {
      console.error("Error updating activity:", error)
      return { success: false, error: error.message }
    }
    return { success: true, activityId: activityId }
  } catch (error) {
    console.error("Error in updateActivity:", error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function deleteActivity(activityId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .rpc('delete_n8n_activity', { p_activity_id: activityId })

    if (error) {
      console.error("Error deleting activity:", error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (error) {
    console.error("Error in deleteActivity:", error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getRecentActivities(limit: number = 10): Promise<Activity[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching recent activities:", error)
    return []
  }
  return data || []
}

export async function queryActivities(criteria: {
  activity_name?: string
  date_range?: string
  status?: string
}): Promise<{ success: boolean; activities: Activity[]; activityList: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, activities: [], activityList: '' }

  // Get all activities first, then filter based on criteria
  const allActivities = await getRecentActivities(50)
  
  let filteredActivities = allActivities

  // Filter by activity name
  if (criteria.activity_name) {
    filteredActivities = filteredActivities.filter(activity => 
      activity.activity_name.toLowerCase().includes(criteria.activity_name!.toLowerCase())
    )
  }

  // Filter by date range
  if (criteria.date_range) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    if (criteria.date_range === 'today') {
      filteredActivities = filteredActivities.filter(activity => 
        new Date(activity.started_at) >= today
      )
    } else if (criteria.date_range === 'yesterday') {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const endOfYesterday = new Date(yesterday)
      endOfYesterday.setDate(endOfYesterday.getDate() + 1)
      
      filteredActivities = filteredActivities.filter(activity => {
        const activityDate = new Date(activity.started_at)
        return activityDate >= yesterday && activityDate < endOfYesterday
      })
    } else if (criteria.date_range === 'this_week') {
      const startOfWeek = new Date(today)
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      
      filteredActivities = filteredActivities.filter(activity => 
        new Date(activity.started_at) >= startOfWeek
      )
    }
  }

  // Filter by status
  if (criteria.status) {
    if (criteria.status === 'completed') {
      filteredActivities = filteredActivities.filter(activity => activity.ended_at !== null)
    } else if (criteria.status === 'active') {
      filteredActivities = filteredActivities.filter(activity => activity.ended_at === null)
    }
  }

  // Format activities for display
  const activityList = filteredActivities.map((activity, index) => {
    const startDate = new Date(activity.started_at)
    const endDate = activity.ended_at ? new Date(activity.ended_at) : null
    const startStr = startDate.toLocaleDateString() + ' ' + startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    const endStr = endDate ? endDate.toLocaleDateString() + ' ' + endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Ongoing'
    return `${index + 1}. ${activity.activity_name} ${startStr} - ${endStr}`
  }).join('\n')
  
  return { 
    success: true, 
    activities: filteredActivities,
    activityList: activityList
  }
}
