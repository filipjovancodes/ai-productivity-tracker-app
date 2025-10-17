"use server"

import { createClient } from "@/lib/supabase/server"
import type { Activity, ActivityStats } from "@/lib/types"
// import { triggerActivityWebhook } from "@/lib/webhook-service" // Commented out - n8n handles activity management

export async function getCurrentActivity(): Promise<Activity | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data
}

export async function startActivity(activityName: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: "Not authenticated" }

  // Stop any current activity first
  await stopCurrentActivity()

  const { error } = await supabase.from("activities").insert({
    user_id: user.id,
    activity_name: activityName,
    started_at: new Date().toISOString(),
  })

  if (error) return { success: false, error: error.message }
  
  // Note: Activity management is now handled by n8n workflow
  // No webhook triggers needed here
  
  return { success: true }
}

export async function stopCurrentActivity(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: "Not authenticated" }

  const currentActivity = await getCurrentActivity()
  if (!currentActivity) return { success: true }

  const endedAt = new Date()
  const startedAt = new Date(currentActivity.started_at)
  const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)

  const { error } = await supabase
    .from("activities")
    .update({
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
    })
    .eq("id", currentActivity.id)

  if (error) return { success: false, error: error.message }
  
  // Note: Activity management is now handled by n8n workflow
  // No webhook triggers needed here
  
  return { success: true }
}

export async function getRecentActivities(limit = 10): Promise<Activity[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(limit)

  if (error) return []
  return data || []
}

export async function getActivityStats(days = 7): Promise<ActivityStats[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from("activities")
    .select("activity_name, duration_minutes")
    .eq("user_id", user.id)
    .gte("started_at", startDate.toISOString())
    .not("duration_minutes", "is", null)

  if (error || !data) return []

  // Aggregate by activity name
  const statsMap = new Map<string, { total_minutes: number; session_count: number }>()

  data.forEach((activity) => {
    const existing = statsMap.get(activity.activity_name) || { total_minutes: 0, session_count: 0 }
    statsMap.set(activity.activity_name, {
      total_minutes: existing.total_minutes + (activity.duration_minutes || 0),
      session_count: existing.session_count + 1,
    })
  })

  return Array.from(statsMap.entries())
    .map(([activity_name, stats]) => ({
      activity_name,
      ...stats,
    }))
    .sort((a, b) => b.total_minutes - a.total_minutes)
}

export async function getTopActivities(limit = 5): Promise<string[]> {
  const stats = await getActivityStats(30)
  return stats.slice(0, limit).map((s) => s.activity_name)
}
