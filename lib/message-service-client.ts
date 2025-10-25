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

    // Get all messages, then take the last 'limit' messages sorted by timestamp
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching messages:", error)
      return []
    }

    // Take only the last 'limit' messages (most recent)
    const allMessages = data || []
    return allMessages.slice(-limit)
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
