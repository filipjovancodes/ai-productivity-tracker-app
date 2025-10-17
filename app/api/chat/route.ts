/*
// COMMENTED OUT - AI Chat functionality replaced with direct n8n integration
// This code is preserved for reference

import { convertToModelMessages, streamText, tool, type UIMessage } from "ai"
import { z } from "zod"
import { startActivity, stopCurrentActivity, getCurrentActivity } from "@/lib/activity-service"

export const maxDuration = 30

const activityTools = {
  startActivity: tool({
    description: "Start tracking a new activity. This will stop any currently running activity.",
    inputSchema: z.object({
      activityName: z.string().describe("The name of the activity to start tracking"),
    }),
    execute: async ({ activityName }, { messages }) => {
      const lastMessage = messages[messages.length - 1]
      const lastUserMessage = typeof lastMessage?.content === 'string' ? lastMessage.content : ""
      const result = await startActivity(activityName, lastUserMessage)
      if (result.success) {
        return { success: true, message: `Started tracking "${activityName}"` }
      }
      return { success: false, message: result.error || "Failed to start activity" }
    },
  }),
  stopActivity: tool({
    description: "Stop the currently running activity",
    inputSchema: z.object({}),
    execute: async (_, { messages }) => {
      const current = await getCurrentActivity()
      if (!current) {
        return { success: false, message: "No activity is currently running" }
      }
      const lastMessage = messages[messages.length - 1]
      const lastUserMessage = typeof lastMessage?.content === 'string' ? lastMessage.content : ""
      const result = await stopCurrentActivity(lastUserMessage)
      if (result.success) {
        return { success: true, message: `Stopped tracking "${current.activity_name}"` }
      }
      return { success: false, message: result.error || "Failed to stop activity" }
    },
  }),
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const systemPrompt = `You are a helpful productivity tracking assistant. Your job is to help users track their activities.

When a user says things like:
- "I'm working" or "start working" → use startActivity with "Working"
- "I'm coding" or "start coding" → use startActivity with "Coding"
- "stop" or "done" or "finished" → use stopActivity
- "I'm taking a break" → use startActivity with "Break"

Be conversational and friendly. Acknowledge when activities are started or stopped. If the user's intent is unclear, ask for clarification.

Common activities include: Working, Coding, Meeting, Break, Exercise, Reading, Learning, etc.`

  const prompt = convertToModelMessages([
    { role: "system", parts: [{ type: "text", text: systemPrompt }] },
    ...messages,
  ])

  const result = streamText({
    model: "openai/gpt-5-mini",
    messages: prompt,
    tools: activityTools,
  })

  return result.toUIMessageStreamResponse()
}
*/

// This endpoint is now disabled - frontend calls n8n directly
export async function POST(req: Request) {
  return new Response(JSON.stringify({ 
    error: "This endpoint is disabled. Frontend now calls n8n directly." 
  }), {
    status: 410, // Gone
    headers: { 'Content-Type': 'application/json' }
  })
}
