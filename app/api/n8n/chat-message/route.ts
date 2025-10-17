import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Validate required fields
    const { user_id, message, message_id } = body
    
    if (!user_id || !message) {
      return NextResponse.json({ 
        error: "Missing required fields: user_id and message" 
      }, { status: 400 })
    }

    // Verify the user exists and is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user || user.id !== user_id) {
      return NextResponse.json({ 
        error: "Unauthorized" 
      }, { status: 401 })
    }

    // Store the n8n message in the database
    const { data: messageData, error: insertError } = await supabase
      .from("messages")
      .insert({
        user_id: user_id,
        role: "assistant",
        content: message,
        source: "n8n",
        metadata: {
          from_n8n: true,
          original_message_id: message_id || null,
          timestamp: new Date().toISOString(),
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error storing n8n message:", insertError)
      return NextResponse.json({ 
        error: "Failed to store message" 
      }, { status: 500 })
    }
    
    const response = {
      success: true,
      message: {
        id: messageData.id,
        role: messageData.role,
        content: messageData.content,
        timestamp: messageData.created_at,
        source: messageData.source,
        message_id: messageData.metadata?.original_message_id,
      }
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error("Error in n8n chat message endpoint:", error)
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 })
  }
}
