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
    
    const { message, user_id, timezone } = body
    
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

    // Store user message
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

    // Check if this is a confirmation response
    const isConfirmation = message.toLowerCase().includes('yes') || message.toLowerCase().includes('no') || message.toLowerCase().includes('confirm')
    
    let aiResponse
    if (isConfirmation) {
    // Handle confirmation - this would need to be stored in session/database
    // For now, we'll simulate the confirmation flow
    aiResponse = await handleConfirmation(message, user_id)
    
    // Convert AI response times to UTC based on user timezone
    const userTimezone = timezone || 'UTC'
    aiResponse = convertAIResponseTimesToUTC(aiResponse, userTimezone)
    } else {
      // Let AI decide whether to use tools or not
      aiResponse = await callAIForProductivityParsing(message, user_id, timezone)
      console.log("AI Response:", aiResponse)
      
      // Convert AI response times to UTC based on user timezone
      const userTimezone = timezone || 'UTC'
      console.log('Before conversion:', aiResponse)
      aiResponse = convertAIResponseTimesToUTC(aiResponse, userTimezone)
      console.log('After conversion:', aiResponse)
    }

    // Process the AI response
    const result = await processAIResponse(supabase, user_id, aiResponse)

    // Store AI response message
    const activityId = 'activityId' in result ? result.activityId : 
                      'activityIds' in result ? result.activityIds?.[0] : null
    
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
  
  const systemPrompt = `You are a productivity tracking assistant.

MOST IMPORTANT RULE: Parse user input and ALWAYS respond with JSON. No extra text or markdown.

User ID: ${userId}
User timezone: ${userTimezone}
Current time (UTC): ${currentTime}

<Tools>
- convert_to_local_time: Converts any timestamp to user's local timezone. Pass timestamp and timezone. Returns local time as ISO string without 'Z'.
</>

<Rules>
- For start: return JSON with current UTC timestamp (use ${currentTime})
- For stop: respond directly with JSON - DO NOT use tools
- For log_past: use convert_to_local_time first to get current time in user's timezone, then interpret user's relative times (e.g., "7am to 8am") and return local timestamps
- All timestamps in JSON responses must be in UTC format WITH 'Z' suffix (e.g., "2024-01-15T19:30:00Z")
</>

For realtime tracking: {"action": "start_activity", "activity": "Work", "timestamp": "${currentTime}", "outputMessage": "Started tracking Work"}

For stopping: {"action": "stop_activity", "outputMessage": "Stopped activity"}

For past events:
1. Use convert_to_local_time with current UTC time (${currentTime}) and timezone (${userTimezone}) to get current local time
2. Interpret user's time references relative to that local time
3. Return: {"action": "log_past", "entries": [{"activity": "Transit", "start": "<local time ISO>", "end": "<local time ISO>"}], "outputMessage": "Logged Transit from X to Y"}

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
      ],
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: "get_many_rows",
              description: "Get activities from the database for a user by activity name",
              inputSchema: {
                json: {
                  type: "object",
                  properties: {
                    user_id: { type: "string", description: "User ID to query activities for" },
                    activity_name: { type: "string", description: "Name of the activity to search for" }
                  },
                  required: ["user_id", "activity_name"]
                }
              }
            }
          },
          {
            toolSpec: {
              name: "get_user_time",
              description: "Get current time in user's timezone for friendly display",
              inputSchema: {
                json: {
                  type: "object",
                  properties: {
                    timezone: { type: "string", description: "User's timezone (e.g., 'America/Vancouver')" }
                  },
                  required: ["timezone"]
                }
              }
            }
          },
          {
            toolSpec: {
              name: "convert_to_local_time",
              description: "Convert any timestamp (UTC or local) to user's local timezone as ISO string",
              inputSchema: {
                json: {
                  type: "object",
                  properties: {
                    timestamp: { type: "string", description: "Timestamp to convert (e.g., '2024-01-15T14:00:00Z' or '2024-01-15T19:30:00')" },
                    timezone: { type: "string", description: "User's timezone (e.g., 'America/Vancouver')" }
                  },
                  required: ["timestamp", "timezone"]
                }
              }
            }
          }
        ]
      }
    })

    let response = await client.send(command)
    console.log("🔍 Bedrock Converse Response:", JSON.stringify(response, null, 2))

    // Continue conversation until we get a final response (not tool_use)
    const conversationMessages: any[] = [
      {
        role: "user",
        content: [{ text: `${systemPrompt}\n\nUser input: ${userMessage}` }]
      }
    ]
    
    let maxIterations = 5
    let iterations = 0
    
    while (response.stopReason === 'tool_use' && iterations < maxIterations) {
      iterations++
      console.log(`🔄 Tool use iteration ${iterations}`)
      
      // Collect all tool uses and their results from this response
      const assistantContent: any[] = []
      const toolResults: any[] = []
      
      if (response.output?.message?.content) {
        for (const content of response.output.message.content) {
          assistantContent.push(content)
          
          if (content.toolUse) {
            console.log("🔧 Tool use detected:", content.toolUse)
            let toolResult = null
            
            if (content.toolUse.name === "get_many_rows") {
              toolResult = await handleGetManyRowsTool(content.toolUse, userId)
            } else if (content.toolUse.name === "get_user_time") {
              toolResult = await handleGetUserTimeTool(content.toolUse, timezone || 'UTC')
            } else if (content.toolUse.name === "convert_to_local_time") {
              toolResult = await handleConvertToLocalTimeTool(content.toolUse, timezone || 'UTC')
            }
            
            if (toolResult) {
              toolResults.push({
                toolResult: {
                  toolUseId: content.toolUse.toolUseId,
                  content: [{ text: JSON.stringify(toolResult) }]
                }
              })
            }
          }
        }
      }
      
      // Add assistant message with tool uses
      conversationMessages.push({
        role: "assistant",
        content: assistantContent
      })
      
      // Add user message with tool results
      conversationMessages.push({
        role: "user",
        content: toolResults
      })
      
      // Make next call with conversation history
      const nextCommand = new ConverseCommand({
        modelId: modelId,
        messages: conversationMessages,
        system: [{ text: systemPrompt }],
        toolConfig: {
          tools: [
            {
              toolSpec: {
                name: "get_many_rows",
                description: "Get activities from the database for a user by activity name",
                inputSchema: {
                  json: {
                    type: "object",
                    properties: {
                      user_id: { type: "string", description: "User ID to query activities for" },
                      activity_name: { type: "string", description: "Name of the activity to search for" }
                    },
                    required: ["user_id", "activity_name"]
                  }
                }
              }
            },
            {
              toolSpec: {
                name: "get_user_time",
                description: "Get current time in user's timezone for friendly display",
                inputSchema: {
                  json: {
                    type: "object",
                    properties: {
                      timezone: { type: "string", description: "User's timezone (e.g., 'America/Vancouver')" }
                    },
                    required: ["timezone"]
                  }
                }
              }
            }
          ]
        }
      })
      
      response = await client.send(nextCommand)
      console.log(`🔍 Iteration ${iterations} Response:`, JSON.stringify(response, null, 2))
    }

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


async function processAIResponse(supabase: any, user_id: string, aiResponse: any) {
  const { action, aiJsonData } = aiResponse
  
  // Use aiJsonData if available, otherwise fall back to aiResponse itself
  const dataToProcess = aiJsonData || aiResponse

  switch (action) {
    case "start_activity":
      return await handleStartActivity(supabase, user_id, dataToProcess)
    case "stop_activity":
      return await handleStopActivity(supabase, user_id)
    case "log_past":
      return await handleLogPast(supabase, user_id, dataToProcess)
    case "edit_activities":
      return await handleEditActivities(supabase, user_id, dataToProcess)
    case "delete_activities":
      return await handleDeleteActivities(supabase, user_id, dataToProcess)
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

async function handleLogPast(supabase: any, user_id: string, aiResponse: any) {
  const { entries } = aiResponse
  
  if (!entries || !Array.isArray(entries)) {
    return { success: false, error: "Missing or invalid entries array for log_past" }
  }

  console.log("Logging past activities:", { user_id, entries })

  const activityIds = []

  for (const entry of entries) {
    const startTime = new Date(entry.start)
    const endTime = new Date(entry.end)
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

    const { data: activityId, error } = await supabase
      .rpc('insert_n8n_activity', {
        p_user_id: user_id,
        p_activity_name: entry.activity,
        p_started_at: entry.start,
        p_ended_at: entry.end,
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
async function handleConfirmation(userMessage: string, userId: string) {
  console.log("✅ Handling confirmation:", userMessage)
  
  const isYes = userMessage.toLowerCase().includes('yes')
  
  if (isYes) {
    // Get the last assistant message with aiJsonData
    const supabase = await createClient()
    const { data: lastMessage, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !lastMessage) {
      return {
        action: "confirmation_error",
        outputMessage: "❌ Could not find the operation to confirm."
      }
    }

    const aiJsonData = lastMessage.metadata?.aiJsonData
    if (!aiJsonData) {
      return {
        action: "confirmation_error", 
        outputMessage: "❌ No operation data found to execute."
      }
    }

    // Execute the operation based on the stored AI JSON
    const result = await processAIResponse(supabase, userId, aiJsonData)
    
    if (result.success) {
      return {
        action: "confirmation_accepted",
        outputMessage: "✅ Operation completed successfully!"
      }
    } else {
      return {
        action: "confirmation_error",
        outputMessage: `❌ Operation failed: ${(result as any).error || 'Unknown error'}`
      }
    }
  } else {
    return {
      action: "confirmation_declined", 
      outputMessage: "❌ Operation cancelled."
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
