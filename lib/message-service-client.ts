"use client"

import { createClient } from "@/lib/supabase/client"

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'n8n'
  content: string
  created_at: string
  source: string
  activity_id?: string
  metadata?: any
}

export async function getRecentMessages(limit = 50): Promise<ChatMessage[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching messages:", error)
    return []
  }

  return (data || []).reverse() // Reverse to show oldest first
}

export async function getMessagesForActivity(activityId: string): Promise<ChatMessage[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", user.id)
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching activity messages:", error)
    return []
  }

  return data || []
}
