import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  console.log("🔥🔥🔥 n8n webhook endpoint called 🔥🔥🔥")
  console.log("Request method:", req.method)
  console.log("Request URL:", req.url)
  
  try {
    const body = await req.json()
    console.log("Request body received:", JSON.stringify(body, null, 2))
    
    // Validate required fields
    const { user_id, message, action, outputMessage } = body
    
    if (!user_id || (!message && !outputMessage)) {
      console.log("❌ Validation failed - missing required fields")
      return NextResponse.json({ 
        error: "Missing required fields: user_id and (message or outputMessage)" 
      }, { status: 400 })
    }
    console.log("✅ Validation passed")

    // Create supabase client for database operations
    console.log("Creating Supabase client...")
    const supabase = await createClient()
    console.log("✅ Supabase client created")

    let result = { success: true }

    // Handle activity actions if action is provided
    if (action) {
      console.log("Processing action:", action)
      switch (action) {
        case "start_activity":
          console.log("🔄 Handling start_activity...")
          result = await handleStartActivity(supabase, body)
          break
        case "stop_activity":
          console.log("🔄 Handling stop_activity...")
          result = await handleStopActivity(supabase, body)
          break
        case "log_past":
          console.log("🔄 Handling log_past...")
          result = await handleLogPast(supabase, body)
          break
        case "unsure":
          console.log("🔄 Handling unsure...")
          result = await handleUnsure(supabase, body)
          break
        default:
          console.log("❌ Unknown action:", action)
          return NextResponse.json({ 
            error: "Unknown action: " + action 
          }, { status: 400 })
      }

      console.log("Action result:", result)

      if (!result.success) {
        console.log("❌ Action failed:", result.error)
        return NextResponse.json({ 
          error: result.error 
        }, { status: 500 })
      }
    } else {
      console.log("No action provided - treating as simple message")
    }

    // Store the n8n response message
    console.log("Storing n8n response message...")
    
    // Get current activity ID for linking
    let currentActivityId = null
    if (action === "start_activity" || action === "stop_activity") {
      const { data: currentActivity } = await supabase
        .from("activities")
        .select("id")
        .eq("user_id", user_id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .single()
      
      currentActivityId = currentActivity?.id || null
    }
    
    // Use the secure function to insert n8n messages
    const messageContent = outputMessage || message
    const { data: messageId, error: messageError } = await supabase
      .rpc('insert_n8n_message', {
        p_user_id: user_id,
        p_content: messageContent,
        p_activity_id: currentActivityId,
        p_metadata: {
          from_n8n: true,
          action: action || null,
          timestamp: new Date().toISOString(),
        }
      })

    if (messageError) {
      console.error("❌ Error storing n8n message:", messageError)
      // Don't fail the request if message storage fails
    } else {
      console.log("✅ n8n response message stored")
    }

    console.log("✅ Request completed successfully:", result)
    return NextResponse.json({ 
      success: true, 
      action: action || null,
      result: result,
      message: messageContent
    })

  } catch (error) {
    console.error("❌ Error in n8n activity actions endpoint:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleStartActivity(supabase: any, body: any) {
  const { user_id, activity, activity_name, timestamp } = body
  
  // Use activity_name if provided, otherwise fall back to activity
  const activityName = activity_name || activity
  
  if (!activityName) {
    return { success: false, error: "Missing activity name for start_activity" }
  }

  console.log("Starting activity:", { user_id, activity: activityName, timestamp })

  // Stop any current activity first
  console.log("Stopping any current activities...")
  const { data: stoppedActivityId, error: stopError } = await supabase
    .rpc('stop_current_n8n_activity', {
      p_user_id: user_id
    })

  if (stopError) {
    console.log("Warning - error stopping current activities:", stopError)
  } else {
    console.log("✅ Current activities stopped:", stoppedActivityId)
  }

  // Start new activity using secure function
  console.log("Inserting new activity...")
  const { data: activityId, error } = await supabase
    .rpc('insert_n8n_activity', {
      p_user_id: user_id,
      p_activity_name: activityName,
      p_started_at: timestamp || new Date().toISOString(),
    })

  if (error) {
    console.error("❌ Error starting activity:", error)
    console.error("Error details:", JSON.stringify(error, null, 2))
    return { success: false, error: error.message }
  }

  console.log("✅ Activity started successfully:", activityId)
  return { success: true, activity: { id: activityId, activity_name: activityName } }
}

async function handleStopActivity(supabase: any, body: any) {
  const { user_id } = body

  console.log("Stopping current activity for user:", user_id)

  // Use secure function to stop current activity
  const { data: stoppedActivityId, error } = await supabase
    .rpc('stop_current_n8n_activity', {
      p_user_id: user_id
    })

  if (error) {
    console.error("❌ Error stopping activity:", error)
    return { success: false, error: error.message }
  }

  if (!stoppedActivityId) {
    return { success: false, error: "No active activity found" }
  }

  console.log("✅ Activity stopped successfully:", stoppedActivityId)
  return { success: true, activity: { id: stoppedActivityId } }
}

async function handleLogPast(supabase: any, body: any) {
  const { user_id, entries } = body
  
  if (!entries || !Array.isArray(entries)) {
    return { success: false, error: "Missing or invalid entries array for log_past" }
  }

  console.log("Logging past activities:", { user_id, entries })

  const activitiesToInsert = entries.map((entry: any) => {
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
    console.error("❌ Error logging past activities:", error)
    return { success: false, error: error.message }
  }

  console.log("✅ Past activities logged successfully:", data)
  return { success: true, activities: data }
}

async function handleUnsure(supabase: any, body: any) {
  console.log("Handling unsure action - no database changes needed")
  return { success: true, message: "User input was unclear, no action taken" }
}
