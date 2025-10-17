import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Get the n8n webhook URL from environment variables
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL
    
    if (!n8nWebhookUrl) {
      console.error("N8N_WEBHOOK_URL environment variable is not set")
      return NextResponse.json({ error: "Webhook URL not configured" }, { status: 500 })
    }

    // Prepare the payload for n8n
    const payload = {
      timestamp: new Date().toISOString(),
      event: body.event, // 'activity_started' or 'activity_stopped'
      activity: {
        id: body.activity.id,
        name: body.activity.name,
        user_id: body.activity.user_id,
      },
      chat_message: body.chat_message,
      user: {
        id: body.user.id,
        email: body.user.email,
      }
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
      console.error(`Failed to send webhook to n8n: ${response.status} ${response.statusText}`)
      return NextResponse.json({ error: "Failed to send webhook" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in n8n webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
