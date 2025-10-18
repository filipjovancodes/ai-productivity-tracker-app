"use server"

import { createClient } from "@/lib/supabase/server"
import type { Activity } from "@/lib/types"

export interface ActivityAction {
  action: "start_activity" | "stop_activity" | "log_past" | "unsure"
  activity?: string
  timestamp?: string
  entries?: Array<{
    activity: string
    start: string
    end: string
  }>
  outputMessage: string
}

export interface ActivityActionResult {
  success: boolean
  error?: string
  data?: any
}

export async function processActivityAction(
  user_id: string,
  actionData: ActivityAction
): Promise<ActivityActionResult> {
  const supabase = await createClient()

  try {
    switch (actionData.action) {
      case "start_activity":
        return await startActivity(supabase, user_id, actionData)
      case "stop_activity":
        return await stopActivity(supabase, user_id)
      case "log_past":
        return await logPastActivities(supabase, user_id, actionData)
      case "unsure":
        return { success: true, data: { message: "No action taken - input unclear" } }
      default:
        return { success: false, error: "Unknown action: " + actionData.action }
    }
  } catch (error) {
    console.error("Error processing activity action:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }
  }
}

async function startActivity(
  supabase: any,
  user_id: string,
  actionData: ActivityAction
): Promise<ActivityActionResult> {
  if (!actionData.activity) {
    return { success: false, error: "Activity name is required for start_activity" }
  }

  // Stop any current activity first
  await supabase
    .from("activities")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", user_id)
    .is("ended_at", null)

  // Start new activity
  const { data, error } = await supabase
    .from("activities")
    .insert({
      user_id: user_id,
      activity_name: actionData.activity,
      started_at: actionData.timestamp || new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data }
}

async function stopActivity(
  supabase: any,
  user_id: string
): Promise<ActivityActionResult> {
  // Get current activity
  const { data: currentActivity, error: fetchError } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", user_id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .single()

  if (fetchError || !currentActivity) {
    return { success: false, error: "No active activity found" }
  }

  // Calculate duration and stop activity
  const endedAt = new Date()
  const startedAt = new Date(currentActivity.started_at)
  const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)

  const { data, error } = await supabase
    .from("activities")
    .update({
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
    })
    .eq("id", currentActivity.id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data }
}

async function logPastActivities(
  supabase: any,
  user_id: string,
  actionData: ActivityAction
): Promise<ActivityActionResult> {
  if (!actionData.entries || !Array.isArray(actionData.entries)) {
    return { success: false, error: "Entries array is required for log_past" }
  }

  const activitiesToInsert = actionData.entries.map((entry) => {
    const startTime = new Date(entry.start)
    const endTime = new Date(entry.end)
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

    return {
      user_id: user_id,
      activity_name: entry.activity,
      started_at: entry.start,
      ended_at: entry.end,
      duration_minutes: durationMinutes,
    }
  })

  const { data, error } = await supabase
    .from("activities")
    .insert(activitiesToInsert)
    .select()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data }
}

// Helper function to get current activity for a user
export async function getCurrentActivityForUser(user_id: string): Promise<Activity | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", user_id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data
}

// Helper function to get recent activities for a user
export async function getRecentActivitiesForUser(
  user_id: string,
  limit = 10
): Promise<Activity[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", user_id)
    .order("started_at", { ascending: false })
    .limit(limit)

  if (error) return []
  return data || []
}
