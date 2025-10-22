import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime"
import { queryActivities, updateActivity, deleteActivity } from "@/lib/activity-edit-service"

export const maxDuration = 30

export async function POST(req: NextRequest) {
  console.log("🔥🔥🔥 Local AI chat endpoint called 🔥🔥🔥")
  
  try {
    const body = await req.json()
    console.log("Request body received:", JSON.stringify(body, null, 2))
    
    const { message, user_id } = body
    
    if (!message || !user_id) {
      return NextResponse.json({ 
        error: "Missing required fields: message and user_id" 
      }, { status: 400 })
    }

    // Create supabase client
    const supabase = await createClient()

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
    } else {
      // Call AI to parse the message
      aiResponse = await callAIForProductivityParsing(message, user_id)
      console.log("AI Response:", aiResponse)
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

async function callAIForProductivityParsing(userMessage: string, userId: string) {
  const systemPrompt = `You are a productivity tracking assistant.

MOST IMPORTANT RULE: Parse user input and ALWAYS respond with JSON.

Current time: ${new Date().toISOString()}

For realtime tracking: {"action": "start_activity", "activity": "Work", "timestamp": "${new Date().toISOString()}", "outputMessage":<Generate your own/>}
For stopping realtime tracking: {"action": "stop_activity", "outputMessage":<Generate your own/>}
For adding past events: {"action": "log_past", "entries": [{"activity": "Transit", "start": "2024-01-15T08:00:00Z", "end": "2024-01-15T09:00:00Z"}], "outputMessage":<Generate your own/>}
If you are unsure: {"action": "unsure", "outputMessage":<Generate your own/>}

For the edit and delete activities you should first use the get_many_rows tool and evaluate from the results which items the user would like to edit or delete. This is a confirmation. The user will only see outputMessage so put your answer there.

IMPORTANT: When editing activities, you MUST parse the user's requested times and convert them to proper ISO timestamps. Do NOT use the original database times - use the NEW times the user requested.

Time parsing examples:
- "8pm to 9pm" → started_at: "2025-01-18T20:00:00Z", ended_at: "2025-01-18T21:00:00Z"
- "2pm to 3pm" → started_at: "2025-01-18T14:00:00Z", ended_at: "2025-01-18T15:00:00Z"
- "10am to 11am" → started_at: "2025-01-18T10:00:00Z", ended_at: "2025-01-18T11:00:00Z"

{"action": "edit_activities", "updates": [{"activity_id": <id from db>, "activity_name": <activity_name from db>, "started_at": <NEW start time as ISO string>, "ended_at": <NEW end time as ISO string>}], "outputMessage": "From your request, I found the <activity_name from db> session from <started_at from db> to <ended_at from db>. Would you like to update this to <from user input> until <from user input>?"}

{"action": "delete_activities", "activity_ids": [<matched id1 from db>, <matched_id2 from db>], "outputMessage": "From your request, I found the <matched activity_name from db> sessions starting at <matched started_at1>, <matched started_at2>, ... Would you like to delete these?"}

Parse this user input: "${userMessage}"`

  try {
    // AWS Bedrock configuration
    const region = process.env.AWS_REGION || 'us-east-1'
    const modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
    
    const client = new BedrockRuntimeClient({
      region: region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    })

    console.log("🤖 Calling Bedrock Converse API with get_many_rows tool...")
    
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
          }
        ]
      }
    })

    const response = await client.send(command)
    console.log("🔍 Bedrock Converse Response:", JSON.stringify(response, null, 2))

    // Process the response
    let finalMessage = ""
    let action = "unsure"
    let activityId = null
    let aiJsonData = null

    // Handle text content
    if (response.output?.message?.content) {
      for (const content of response.output.message.content) {
        if (content.text) {
          finalMessage += content.text
        }
      }
    }

    // Handle tool use
    if (response.output?.message?.content) {
      for (const content of response.output.message.content) {
        if (content.toolUse) {
          console.log("🔧 Tool use detected:", content.toolUse)
          const toolResult = await handleGetManyRowsTool(content.toolUse, userId)
          if (toolResult) {
            // Make a second Converse call with the tool result
            const secondCommand = new ConverseCommand({
              modelId: modelId,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      text: `${systemPrompt}\n\nUser input: ${userMessage}`
                    }
                  ]
                },
                {
                  role: "assistant",
                  content: [
                    {
                      toolUse: content.toolUse
                    }
                  ]
                },
                {
                  role: "user",
                  content: [
                    {
                      toolResult: {
                        toolUseId: content.toolUse.toolUseId,
                        content: [
                          {
                            text: JSON.stringify(toolResult)
                          }
                        ]
                      }
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
                  }
                ]
              }
            })

            const secondResponse = await client.send(secondCommand)
            console.log("🔍 Second Converse Response:", JSON.stringify(secondResponse, null, 2))

            // Parse the final JSON response
            if (secondResponse.output?.message?.content) {
              for (const content of secondResponse.output.message.content) {
                if (content.text) {
                  try {
                    const parsedJson = JSON.parse(content.text)
                    aiJsonData = parsedJson
                    action = parsedJson.action
                    finalMessage = parsedJson.outputMessage || content.text
                  } catch (e) {
                    finalMessage = content.text
                  }
                }
              }
            }
          }
        }
      }
    }

    // If no tool was used, try to parse JSON from the first response
    if (!aiJsonData && finalMessage) {
      try {
        const parsedJson = JSON.parse(finalMessage)
        aiJsonData = parsedJson
        action = parsedJson.action
        finalMessage = parsedJson.outputMessage || finalMessage
      } catch (e) {
        // Not JSON, use the text as is
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
    return {
      action: "unsure",
      outputMessage: "I'm having trouble understanding. Could you please clarify what you'd like to track?",
      aiJsonData: null
    }
  }
}


async function processAIResponse(supabase: any, user_id: string, aiResponse: any) {
  const { action } = aiResponse

  switch (action) {
    case "start_activity":
      return await handleStartActivity(supabase, user_id, aiResponse)
    case "stop_activity":
      return await handleStopActivity(supabase, user_id)
    case "log_past":
      return await handleLogPast(supabase, user_id, aiResponse)
    case "edit_activities":
      return await handleEditActivities(supabase, user_id, aiResponse)
    case "delete_activities":
      return await handleDeleteActivities(supabase, user_id, aiResponse)
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
        p_started_at: startTime.toISOString(),
        p_ended_at: endTime.toISOString(),
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
