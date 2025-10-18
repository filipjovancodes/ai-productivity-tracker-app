import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  console.log("🔥🔥🔥 n8n webhook endpoint called 🔥🔥🔥")
  console.log("Request method:", req.method)
  console.log("Request URL:", req.url)
  console.log("Request headers:", Object.fromEntries(req.headers.entries()))
  
  try {
    const body = await req.json()
    console.log("Request body received:", JSON.stringify(body, null, 2))
    
    // Validate required fields
    const { user_id, message, message_id } = body
    console.log("Extracted fields:", { user_id, message, message_id })
    
    if (!user_id || !message) {
      console.log("❌ Validation failed - missing required fields")
      return NextResponse.json({ 
        error: "Missing required fields: user_id and message" 
      }, { status: 400 })
    }
    console.log("✅ Validation passed")

    // Create supabase client for database operations
    console.log("Creating Supabase client...")
    const supabase = await createClient()
    console.log("✅ Supabase client created")
    
    // Note: n8n requests don't have user authentication, so we trust the user_id from n8n
    // In production, you might want to add API key authentication here

    // Store the n8n message in the database using secure function
    console.log("Attempting to insert message into database...")
    const { data: messageId, error: insertError } = await supabase
      .rpc('insert_n8n_message', {
        p_user_id: user_id,
        p_content: message,
        p_activity_id: null,
        p_metadata: {
          from_n8n: true,
          original_message_id: message_id || null,
          timestamp: new Date().toISOString(),
        }
      })

    if (insertError) {
      console.error("❌ Error storing n8n message:", insertError)
      console.error("Error details:", JSON.stringify(insertError, null, 2))
      return NextResponse.json({ 
        error: "Failed to store message",
        details: insertError.message 
      }, { status: 500 })
    }
    console.log("✅ Message stored successfully:", messageId)
    
    const response = {
      success: true,
      message: {
        id: messageId,
        role: "assistant",
        content: message,
        timestamp: new Date().toISOString(),
        source: "n8n",
        message_id: message_id,
      }
    }
    
    console.log("✅ Sending success response:", JSON.stringify(response, null, 2))
    return NextResponse.json(response)
  } catch (error) {
    console.error("❌ Error in n8n chat message endpoint:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
