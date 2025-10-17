import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Validate required fields
    const { text } = body
    
    if (!text) {
      return NextResponse.json({ 
        error: "Missing required field: text" 
      }, { status: 400 })
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: "Unauthorized" 
      }, { status: 401 })
    }

    // Get the n8n webhook URL from environment variables
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL
    
    if (!n8nWebhookUrl) {
      console.error("N8N_WEBHOOK_URL environment variable is not set")
      return NextResponse.json({ error: "Webhook URL not configured" }, { status: 500 })
    }

    // Create simplified payload for n8n
    const payload = {
      id: crypto.randomUUID(), // Generate a unique ID for this message
      user_id: user.id,
      text: text
    }

    // Send to n8n webhook
    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error(`Failed to send message to n8n: ${response.status} ${response.statusText}`)
      return NextResponse.json({ error: "Failed to send message to n8n" }, { status: 500 })
    }

    // Store the user message in our database for chat history
    const { error: insertError } = await supabase
      .from("messages")
      .insert({
        user_id: user.id,
        role: "user",
        content: text,
        source: "chat",
        metadata: {
          n8n_message_id: payload.id,
          timestamp: new Date().toISOString(),
        }
      })

    if (insertError) {
      console.error("Error storing user message:", insertError)
      // Don't fail the request if message storage fails
    }

    return NextResponse.json({ 
      success: true, 
      message_id: payload.id,
      message: "Message sent to n8n successfully"
    })
  } catch (error) {
    console.error("Error in n8n send message endpoint:", error)
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
}
