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
  confirmation_state?: 'pending' | 'confirmed' | 'cancelled' | null
}

export async function getRecentMessages(limit = 50, beforeTimestamp?: string): Promise<ChatMessage[]> {
  // Prevent server-side execution
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return []

    let query = supabase
      .from("messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    // If beforeTimestamp is provided, get messages before that timestamp
    if (beforeTimestamp) {
      query = query.lt("created_at", beforeTimestamp)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching messages:", error)
      return []
    }

    // Return messages in chronological order (oldest first)
    return (data || []).reverse()
  } catch (error) {
    console.error("Error in getRecentMessages:", error)
    return []
  }
}

export async function getMessagesForActivity(activityId: string): Promise<ChatMessage[]> {
  // Prevent server-side execution
  if (typeof window === 'undefined') {
    return []
  }

  try {
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
  } catch (error) {
    console.error("Error in getMessagesForActivity:", error)
    return []
  }
}
