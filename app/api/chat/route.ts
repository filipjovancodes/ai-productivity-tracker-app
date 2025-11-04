import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime"
import { queryActivities, updateActivity, deleteActivity } from "@/lib/activity-edit-service"
import { convertAIResponseTimesToUTC, convertToLocalTime } from "@/lib/timezone-utils"

export const maxDuration = 30

export async function POST(req: NextRequest) {
  console.log("🔥🔥🔥 Local AI chat endpoint called 🔥🔥🔥")
  
  try {
    const body = await req.json()
    console.log("Request body received:", JSON.stringify(body, null, 2))
    
    const { message, user_id, timezone: userTimezone } = body
    
    if (!message || !user_id) {
      return NextResponse.json({ 
        error: "Missing required fields: message and user_id" 
      }, { status: 400 })
    }

    // Create supabase client
    const supabase = await createClient()

    // Check if user can make AI request (usage limit)
    const { data: canMakeRequest, error: usageError } = await supabase
      .rpc('can_make_ai_request', {
        p_user_id: user_id
      })

    if (usageError) {
      console.error("❌ Error checking usage limit:", usageError)
      return NextResponse.json({ 
        error: "Failed to check usage limit" 
      }, { status: 500 })
    }

    if (!canMakeRequest) {
      // Get user's current usage for the error message
      const { data: currentUsage } = await supabase
        .rpc('get_user_monthly_usage', {
          p_user_id: user_id,
          p_usage_type: 'ai_message'
        })

      return NextResponse.json({ 
        error: "Usage limit exceeded",
        details: "You've reached your monthly limit of AI messages. Please upgrade your plan to continue.",
        current_usage: currentUsage,
        upgrade_url: "/subscription"
      }, { status: 429 })
    }

    // Check if this is a confirmation request
    const { messageId, isConfirmationRequest } = body
    
    if (isConfirmationRequest && messageId) {
      // Handle confirmation - retrieve stored data and execute
      // Do NOT store a user message for confirmation
      const aiResponse = await handleConfirmation(messageId, message, user_id, userTimezone)
      
      // Return the result - frontend will update the message in place
      return NextResponse.json({
        success: true,
        action: aiResponse.action,
        message: aiResponse.outputMessage,
        activityId: aiResponse.activityId,
        activityIds: aiResponse.activityIds
      })
    }

    // Regular chat flow - store user message
    const { data: userMessageId, error: userMessageError } = await supabase
      .rpc('insert_n8n_message', {
        p_user_id: user_id,
        p_content: message,
        p_activity_id: null,
        p_role: 'user',
        p_source: 'chat',
        p_metadata: {
          from_user: true,
          timestamp: new Date().toISOString(),
        }
      })

    if (userMessageError) {
      console.error("❌ Error storing user message:", userMessageError)
    }

    // Call AI to parse the user message
    let aiResponse = await callAIForProductivityParsing(message, user_id, userTimezone)
    console.log("🤖 AI Response (raw):", JSON.stringify(aiResponse, null, 2))

    // Process the AI response
    let result
    // For log_past, DON'T convert yet - store LOCAL times for confirmation
    // For other actions, convert times to UTC BEFORE processing
    if (aiResponse.action === 'log_past') {
      // Keep LOCAL times - conversion happens on confirmation
      result = await processAIResponse(supabase, user_id, aiResponse, userTimezone)
    } else if (aiResponse.action !== 'start_activity' && aiResponse.action !== 'stop_activity' && aiResponse.action !== 'unsure') {
      // Convert times to UTC for other actions (edit, delete, etc)
      console.log('🔄 Converting times to UTC...')
      console.log('Before conversion:', JSON.stringify(aiResponse, null, 2))
      aiResponse = convertAIResponseTimesToUTC(aiResponse, userTimezone)
      console.log('After conversion:', JSON.stringify(aiResponse, null, 2))
      result = await processAIResponse(supabase, user_id, aiResponse, userTimezone)
    } else {
      // start_activity, stop_activity, unsure - no conversion needed
      result = await processAIResponse(supabase, user_id, aiResponse, userTimezone)
    }

    // Check if confirmation is required
    if ('requiresConfirmation' in result && result.requiresConfirmation) {
      // Store LOCAL times (aiResponse still has LOCAL times, not converted)
      // Conversion will happen when user confirms
      const { data: aiMessageId, error: aiMessageError } = await supabase
        .rpc('insert_n8n_message', {
          p_user_id: user_id,
          p_content: 'message' in result ? result.message : '',
          p_activity_id: null,
          p_role: 'assistant',
          p_source: 'ai',
          p_metadata: {
            from_ai: true,
            action: aiResponse.action,
            aiJsonData: aiResponse.aiJsonData, // Store LOCAL times (not converted yet)
            userTimezone: userTimezone, // Store timezone for later conversion
            timestamp: new Date().toISOString(),
          },
          p_confirmation_state: 'pending' // Set state to pending for confirmation messages
        })

      if (aiMessageError) {
        console.error("❌ Error storing confirmation message:", aiMessageError)
      }

      return NextResponse.json({
        success: true,
        message: 'message' in result ? result.message : '',
        requiresConfirmation: true,
        action: aiResponse.action
      })
    }

    // Store AI response message for non-confirmation actions
    let activityId: string | null = null
    if ('activityId' in result && result.activityId) {
      activityId = result.activityId
    } else if ('activityIds' in result && Array.isArray(result.activityIds) && result.activityIds.length > 0) {
      activityId = result.activityIds[0]
    }
    
    const { data: aiMessageId, error: aiMessageError } = await supabase
      .rpc('insert_n8n_message', {
        p_user_id: user_id,
        p_content: aiResponse.outputMessage,
        p_activity_id: activityId,
        p_role: 'assistant',
        p_source: 'ai',
        p_metadata: {
          from_ai: true,
          action: aiResponse.action,
          aiJsonData: (aiResponse as any).aiJsonData || null,
          timestamp: new Date().toISOString(),
        }
      })

    if (aiMessageError) {
      console.error("❌ Error storing AI message:", aiMessageError)
    }

    // Track usage after successful AI response
    const { error: trackError } = await supabase
      .rpc('track_usage', {
        p_user_id: user_id,
        p_usage_type: 'ai_message',
        p_count: 1
      })

    if (trackError) {
      console.error("❌ Error tracking usage:", trackError)
    }

    return NextResponse.json({
      success: true,
      action: aiResponse.action,
      message: aiResponse.outputMessage,
      result: result
    })

  } catch (error) {
    console.error("❌ Error in local AI chat endpoint:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function callAIForProductivityParsing(userMessage: string, userId: string, timezone?: string): Promise<{
  action: string;
  outputMessage: string;
  activityId: string | null;
  aiJsonData: any;
}> {
  const userTimezone = timezone || 'UTC'
  const currentTime = new Date().toISOString()
  
  const systemPrompt = `You are an AI time tracking assistant.

MOST IMPORTANT RULE: Parse user input and ALWAYS respond with JSON. No extra text or markdown.

User ID: ${userId}
Current time: ${currentTime}

<Rules>
- For start: return JSON with current timestamp (use ${currentTime})
- For stop: respond directly with JSON
- For log_past: interpret user times as absolute times and create ISO timestamps
- All timestamps should be in ISO format (e.g., "2024-10-20T09:00:00")
</>

For realtime tracking: {"action": "start_activity", "activity": "Work", "timestamp": "${currentTime}", "outputMessage": "Started tracking Work"}

For stopping: {"action": "stop_activity", "outputMessage": "Stopped activity"}

For past events:
When user says "9am to 5pm", create absolute timestamps:
{"action": "log_past", "entries": [{"activity": "Work", "start": "2024-10-20T09:00:00", "end": "2024-10-20T17:00:00"}], "outputMessage": "Logged Work from 9am to 5pm"}

If unsure: {"action": "unsure", "outputMessage": "Can you clarify..."}
`

  try {
    // AWS Bedrock configuration
    const region = process.env.AWS_REGION || 'us-east-1'
    const modelId = 'anthropic.claude-3-haiku-20240307-v1:0'
    
    const client = new BedrockRuntimeClient({
      region: region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    })

    console.log("🤖 Calling Bedrock Converse API...")
    
    const command = new ConverseCommand({
      modelId: modelId,
      messages: [
        {
          role: "user",
          content: [
            {
              text: `${systemPrompt}\n\nUser input: ${userMessage}`
            }
          ]
        }
      ],
      system: [
        {
          text: systemPrompt
        }
      ]
    })

    let response = await client.send(command)
    console.log("🔍 Bedrock Converse Response:", JSON.stringify(response, null, 2))

    // Process the response directly since no tools are used

    // Process the final response
    let finalMessage = ""
    let action = "unsure"
    let activityId = null
    let aiJsonData = null

    // Extract text content from final response
    if (response.output?.message?.content) {
      for (const content of response.output.message.content) {
        if (content.text) {
          finalMessage += content.text
        }
      }
    }

    // Try to parse JSON from the final response
    if (finalMessage) {
      try {
        let cleanedMessage = finalMessage.trim()
        
        // Try multiple extraction methods
        // 1. Check if wrapped in markdown code blocks
        const codeBlockMatch = cleanedMessage.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
        if (codeBlockMatch) {
          cleanedMessage = codeBlockMatch[1].trim()
        }
        
        // 2. Try to find JSON object in the text (starts with { and ends with })
        const jsonMatch = cleanedMessage.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          cleanedMessage = jsonMatch[0]
        }
        
        const parsedJson = JSON.parse(cleanedMessage)
        aiJsonData = parsedJson
        action = parsedJson.action
        finalMessage = parsedJson.outputMessage || finalMessage
      } catch (e) {
        // Not JSON, use the text as is
        console.warn("Failed to parse AI response as JSON:", e)
      }
    }

    return {
      action: action,
      outputMessage: finalMessage || "I'm not sure what you'd like to do. You can ask me to start/stop activities, edit past sessions, or delete activities.",
      activityId: activityId,
      aiJsonData: aiJsonData
    }

  } catch (error) {
    console.error("❌ Error calling Bedrock Converse API:", error)

    // Handle throttling with retry logic
    if (error instanceof Error && error.message.includes('ThrottlingException')) {
      console.log("🔄 Throttling detected, retrying with backoff...")
      return await retryWithBackoff(() => callAIForProductivityParsing(userMessage, userId, timezone), 3)
    }

    return {
      action: "unsure",
      outputMessage: "I'm having trouble understanding. Could you please clarify what you'd like to track?",
      activityId: null,
      aiJsonData: null
    }
  }
}


async function processAIResponse(supabase: any, user_id: string, aiResponse: any, userTimezone: string) {
  const { action, aiJsonData } = aiResponse
  
  // Always use aiJsonData - never fall back to aiResponse
  if (!aiJsonData) {
    console.error("❌ aiJsonData is missing for action:", action)
    return { success: false, error: `Missing aiJsonData for action: ${action}` }
  }

  switch (action) {
    case "start_activity":
      return await handleStartActivity(supabase, user_id, aiJsonData)
    case "stop_activity":
      return await handleStopActivity(supabase, user_id)
    case "log_past":
      return await handleLogPast(supabase, user_id, aiJsonData, userTimezone)
    case "edit_activities":
      return await handleEditActivities(supabase, user_id, aiJsonData)
    case "delete_activities":
      return await handleDeleteActivities(supabase, user_id, aiJsonData)
    case "unsure":
      return { success: true, message: "No action taken" }
    default:
      return { success: false, error: "Unknown action: " + action }
  }
}

async function handleStartActivity(supabase: any, user_id: string, aiResponse: any) {
  const { activity, timestamp } = aiResponse
  
  if (!activity) {
    return { success: false, error: "Missing activity name for start_activity" }
  }

  console.log("Starting activity:", { user_id, activity, timestamp })

  // Stop any current activity first
  const { data: stoppedActivityId, error: stopError } = await supabase
    .rpc('stop_current_n8n_activity', {
      p_user_id: user_id
    })

  if (stopError) {
    console.log("Warning - error stopping current activities:", stopError)
  }

  // Start new activity using secure function
  const { data: activityId, error } = await supabase
    .rpc('insert_n8n_activity', {
      p_user_id: user_id,
      p_activity_name: activity,
      p_started_at: timestamp || new Date().toISOString(),
    })

  if (error) {
    console.error("❌ Error starting activity:", error)
    return { success: false, error: error.message }
  }

  console.log("✅ Activity started successfully:", activityId)
  return { success: true, activityId: activityId }
}

async function handleStopActivity(supabase: any, user_id: string) {
  console.log("Stopping current activity for user:", user_id)

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
  return { success: true, activityId: stoppedActivityId }
}

async function handleLogPast(supabase: any, user_id: string, aiResponse: any, userTimezone: string) {
  const { entries } = aiResponse
  
  if (!entries || !Array.isArray(entries)) {
    return { success: false, error: "Missing or invalid entries array for log_past" }
  }

  console.log("Preparing to log past activities:", { user_id, entries })

  // Format the entries for display using the original AI timestamps (before UTC conversion)
  const formattedEntries = entries.map(entry => {
    const startTime = new Date(entry.start)
    let endTime = new Date(entry.end)
    
    // If end time is earlier than start time, it likely crosses midnight
    // Add 24 hours (1 day) to end time to account for this
    if (endTime.getTime() < startTime.getTime()) {
      endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000)
    }
    
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
    
    // Display the original times as-is (these are what the user specified)
    const startDisplay = startTime.toLocaleString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    const endDisplay = endTime.toLocaleString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    
    return {
      activity: entry.activity,
      start: startDisplay,
      end: endDisplay,
      duration: `${durationMinutes} minutes`
    }
  })

  // Create confirmation message with expected changes
  const confirmationMessage = `I found ${entries.length} past activit${entries.length > 1 ? 'ies' : 'y'} to log:\n\n` +
    formattedEntries.map(entry => 
      `• **${entry.activity}**: ${entry.start} to ${entry.end} (${entry.duration})`
    ).join('\n') +
    `\n\nWould you like me to log these activities?`

  return { 
    success: true, 
    requiresConfirmation: true,
    message: confirmationMessage,
    entries: entries // Keep original entries for actual logging
  }
}

async function handleLogPastExecution(supabase: any, user_id: string, aiJsonData: any) {
  console.log("🔍 Debug - handleLogPastExecution received:", JSON.stringify(aiJsonData, null, 2))
  
  // Always use aiJsonData - never fall back
  const entries = aiJsonData.entries
  
  if (!entries || !Array.isArray(entries)) {
    console.log("❌ Debug - Missing entries array. aiJsonData keys:", Object.keys(aiJsonData))
    return { success: false, error: "Missing or invalid entries array for log_past" }
  }

  console.log("Logging past activities:", { user_id, entries })

  const activityIds = []

  for (const entry of entries) {
    const startTime = new Date(entry.start)
    let endTime = new Date(entry.end)
    
    // If end time is earlier than start time, it likely crosses midnight
    // Add 24 hours (1 day) to end time to account for this
    if (endTime.getTime() < startTime.getTime()) {
      endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000)
    }
    
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
    
    // Update entry.end with the corrected time for database storage
    const correctedEndTime = endTime.toISOString()

    console.log(`🔍 Database insertion - Activity: ${entry.activity}, Start: ${entry.start}, End: ${entry.end}`)

    const { data: activityId, error } = await supabase
      .rpc('insert_n8n_activity', {
        p_user_id: user_id,
        p_activity_name: entry.activity,
        p_started_at: entry.start,
        p_ended_at: correctedEndTime,
        p_duration_minutes: durationMinutes,
      })

    if (error) {
      console.error("❌ Error logging past activity:", error)
      return { success: false, error: error.message }
    }

    activityIds.push(activityId)
  }

  console.log("✅ Past activities logged successfully:", activityIds)
  return { success: true, activityIds: activityIds }
}

async function handleEditActivities(supabase: any, user_id: string, aiResponse: any) {
  const { updates } = aiResponse
  
  if (!updates || !Array.isArray(updates)) {
    return { success: false, error: "Missing or invalid updates array for edit_activities" }
  }

  console.log("Editing activities:", { user_id, updates })

  const results = []
  for (const update of updates) {
    const { activity_id, activity_name, started_at, ended_at } = update
    
    // Calculate duration if both start and end times are provided
    let duration_minutes = null
    if (started_at && ended_at) {
      const startTime = new Date(started_at)
      const endTime = new Date(ended_at)
      duration_minutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
    }

    const result = await updateActivity(activity_id, {
      activity_name,
      started_at,
      ended_at,
      duration_minutes: duration_minutes || undefined
    })
    
    results.push(result)
  }

  const successCount = results.filter(r => r.success).length
  console.log(`✅ Successfully updated ${successCount} activities`)
  return { success: true, results, message: `Updated ${successCount} activities` }
}

async function handleDeleteActivities(supabase: any, user_id: string, aiResponse: any) {
  const { activity_ids } = aiResponse
  
  if (!activity_ids || !Array.isArray(activity_ids)) {
    return { success: false, error: "Missing or invalid activity_ids array for delete_activities" }
  }

  console.log("Deleting activities:", { user_id, activity_ids })

  const results = []
  for (const activityId of activity_ids) {
    const result = await deleteActivity(activityId)
    results.push(result)
  }

  const successCount = results.filter(r => r.success).length
  console.log(`✅ Successfully deleted ${successCount} activities`)
  return { success: true, results, message: `Deleted ${successCount} activities` }
}

// Handle get_many_rows tool call
async function handleGetManyRowsTool(toolUse: any, userId: string) {
  console.log("🔧 Handling get_many_rows tool call:", toolUse)
  
  const { input } = toolUse
  
  try {
    const { user_id, activity_name } = input
    
    // Query activities by user_id and activity_name
    const criteria = { activity_name }
    const queryResult = await queryActivities(criteria)
    
    if (queryResult.success) {
      return {
        success: true,
        activities: queryResult.activities,
        count: queryResult.activities.length
      }
    } else {
      return {
        success: false,
        error: "Failed to query activities"
      }
    }
  } catch (error) {
    console.error("❌ Error in get_many_rows tool:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}


// Handle get_user_time tool call
async function handleGetUserTimeTool(toolUse: any, timezone: string) {
  console.log("🔧 Handling get_user_time tool call:", toolUse)
  
  const { input } = toolUse
  
  try {
    const { timezone: requestedTimezone } = input
    
    const userTimezone = requestedTimezone || timezone || 'UTC'
    const now = new Date()
    
    // Format time in user's timezone
    const localTime = now.toLocaleString('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
    
    return {
      success: true,
      timezone: userTimezone,
      localTime: localTime,
      utcTime: now.toISOString()
    }
  } catch (error) {
    console.error("❌ Error in get_user_time tool:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timezone: timezone || 'UTC',
      localTime: new Date().toLocaleString(),
      utcTime: new Date().toISOString()
    }
  }
}

// Handle convert_to_local_time tool call
async function handleConvertToLocalTimeTool(toolUse: any, timezone: string) {
  console.log("🔧 Handling convert_to_local_time tool call:", toolUse)
  
  const { input } = toolUse
  
  try {
    const { timestamp, timezone: requestedTimezone } = input
    const userTimezone = requestedTimezone || timezone || 'UTC'
    
    const localTime = convertToLocalTime(timestamp, userTimezone)
    
    return {
      success: true,
      originalTimestamp: timestamp,
      localTime: localTime,
      timezone: userTimezone
    }
  } catch (error) {
    console.error("❌ Error in convert_to_local_time tool:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      originalTimestamp: input.timestamp,
      timezone: timezone || 'UTC'
    }
  }
}

// Handle confirmation responses
async function handleConfirmation(messageId: string, userMessage: string, userId: string, userTimezone: string) {
  console.log("✅ Handling confirmation:", userMessage, "for messageId:", messageId)
  
  const isYes = userMessage.toLowerCase().includes('yes') || userMessage.toLowerCase() === 'y' || userMessage.toLowerCase() === 'confirm'
  
  // Get the specific message by ID
  const supabase = await createClient()
  const { data: lastMessage, error } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .eq('user_id', userId)
    .eq('role', 'assistant')
    .single()
  
  if (error || !lastMessage) {
    return {
      action: "confirmation_error",
      outputMessage: "❌ Could not find the operation to confirm.",
      activityId: null,
      activityIds: undefined
    }
  }

  // Check if already confirmed or cancelled using confirmation_state column
  if (lastMessage.confirmation_state === 'confirmed' || lastMessage.confirmation_state === 'cancelled') {
    const statusMessage = lastMessage.confirmation_state === 'confirmed' 
      ? "✅ Operation confirmed." 
      : "❌ Operation cancelled."
    return {
      action: "confirmation_already_processed",
      outputMessage: statusMessage,
      activityId: null,
      activityIds: undefined
    }
  }
  
  // Check if not pending (should be pending for confirmation)
  if (lastMessage.confirmation_state !== 'pending') {
    return {
      action: "confirmation_error",
      outputMessage: "❌ This message is not in a pending state for confirmation.",
      activityId: null,
      activityIds: undefined
    }
  }

  const storedAiJsonData = lastMessage.metadata?.aiJsonData
  const storedTimezone = lastMessage.metadata?.userTimezone || userTimezone
  
  if (!storedAiJsonData) {
    return {
      action: "confirmation_error", 
      outputMessage: "❌ No operation data found to execute.",
      aiJsonData: null
    }
  }

  console.log("🔍 Stored aiJsonData (LOCAL times):", JSON.stringify(storedAiJsonData, null, 2))
  console.log("🕐 User timezone:", storedTimezone)

  // Convert LOCAL times to UTC BEFORE execution
  const aiJsonDataWithUTC = convertAIResponseTimesToUTC(storedAiJsonData, storedTimezone)
  console.log("🔄 Converted to UTC:", JSON.stringify(aiJsonDataWithUTC, null, 2))

  // Execute the operation
  let result
  if (storedAiJsonData.action === "log_past") {
    // For log_past, use the converted UTC times
    result = await handleLogPastExecution(supabase, userId, aiJsonDataWithUTC)
  } else {
    // For other actions, use processAIResponse
    result = await processAIResponse(supabase, userId, { 
      action: aiJsonDataWithUTC.action, 
      aiJsonData: aiJsonDataWithUTC 
    }, storedTimezone)
  }
  
  // Update message confirmation_state
  let outputMessage: string
  let confirmationState: string
  
  if (result.success) {
    // Extract activity IDs from result
    let activityId: string | null = null
    let activityIds: string[] | undefined = undefined
    
    if ('activityId' in result && result.activityId) {
      activityId = result.activityId
    } else if ('activityIds' in result && Array.isArray(result.activityIds) && result.activityIds.length > 0) {
      activityIds = result.activityIds
      activityId = result.activityIds[0]
    }
    
    outputMessage = "✅ Operation confirmed."
    confirmationState = "confirmed"
    
    // Update message in database with confirmation state
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        confirmation_state: confirmationState
      })
      .eq('id', messageId)
    
    if (updateError) {
      console.error("❌ Error updating message with confirmation state:", updateError)
    }
    
    return {
      action: "confirmation_accepted",
      outputMessage: outputMessage,
      activityId: activityId,
      activityIds: activityIds
    }
  } else {
    outputMessage = `❌ Operation failed: ${('error' in result ? result.error : 'Unknown error')}`
    confirmationState = "cancelled" // Use cancelled for errors
    
    // Update message in database with cancelled state
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        confirmation_state: confirmationState
      })
      .eq('id', messageId)
    
    if (updateError) {
      console.error("❌ Error updating message with cancelled state:", updateError)
    }
    
    return {
      action: "confirmation_error",
      outputMessage: outputMessage,
      activityId: null
    }
  }
}

// Retry function with exponential backoff for throttling
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      
      if (error instanceof Error && error.message.includes('ThrottlingException')) {
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries} after ${Math.round(delay)}ms delay`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw error
      }
    }
  }
  throw new Error('Max retries exceeded')
}
