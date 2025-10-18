import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"

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

    // Call AI to parse the message
    const aiResponse = await callAIForProductivityParsing(message)
    console.log("AI Response:", aiResponse)

    // Process the AI response
    const result = await processAIResponse(supabase, user_id, aiResponse)

    // Store AI response message
    const { data: aiMessageId, error: aiMessageError } = await supabase
      .rpc('insert_n8n_message', {
        p_user_id: user_id,
        p_content: aiResponse.outputMessage,
        p_activity_id: result.activityId || null,
        p_role: 'assistant',
        p_source: 'ai',
        p_metadata: {
          from_ai: true,
          action: aiResponse.action,
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

async function callAIForProductivityParsing(userMessage: string) {
  const systemPrompt = `You are a productivity tracking assistant. Parse user input and respond with JSON.

Current time: ${new Date().toISOString()}

For realtime tracking: {"action": "start_activity", "activity": "Work", "timestamp": "${new Date().toISOString()}", "outputMessage":<Generate your own/>}
For stopping realtime tracking: {"action": "stop_activity", "outputMessage":<Generate your own/>}
For past events: {"action": "log_past", "entries": [{"activity": "Transit", "start": "2024-01-15T08:00:00Z", "end": "2024-01-15T09:00:00Z"}], "outputMessage":<Generate your own/>}
If you are unsure: {"action": "unsure", "outputMessage":<Generate your own/>}

Parse this user input: "${userMessage}"`

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

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 500,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: `${systemPrompt}\n\nUser input: ${userMessage}`
        }
      ]
    }

    const command = new InvokeModelCommand({
      modelId: modelId,
      body: JSON.stringify(payload),
      contentType: 'application/json',
    })

    const response = await client.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))
    const aiResponse = responseBody.content[0].text

    // Parse the JSON response from AI
    const parsedResponse = JSON.parse(aiResponse)
    return parsedResponse

  } catch (error) {
    console.error("❌ Error calling AI:", error)
    // Fallback response
    return {
      action: "unsure",
      outputMessage: "I'm having trouble understanding. Could you please clarify what you'd like to track?"
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