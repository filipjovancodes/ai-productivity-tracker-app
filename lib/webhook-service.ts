"use server"

import { createClient } from "@/lib/supabase/server"
import type { Activity } from "@/lib/types"

interface WebhookPayload {
  event: 'activity_started' | 'activity_stopped'
  activity: {
    id: string
    name: string
    user_id: string
  }
  chat_message: string
  user: {
    id: string
    email?: string
  }
}

export async function triggerActivityWebhook(
  event: 'activity_started' | 'activity_stopped',
  activity: Activity,
  chatMessage: string
): Promise<void> {
  try {
    // Get user information
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error("No authenticated user found for webhook")
      return
    }

    const payload: WebhookPayload = {
      event,
      activity: {
        id: activity.id,
        name: activity.activity_name,
        user_id: activity.user_id,
      },
      chat_message: chatMessage,
      user: {
        id: user.id,
        email: user.email,
      }
    }

    // Call our internal webhook endpoint
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/n8n`
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error(`Webhook failed: ${response.status} ${response.statusText}`)
    } else {
      console.log(`Successfully triggered ${event} webhook for activity: ${activity.activity_name}`)
    }
  } catch (error) {
    console.error('Error triggering webhook:', error)
  }
}
