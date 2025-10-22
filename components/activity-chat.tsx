"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Send, Loader2, Check, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { getRecentMessages, type ChatMessage } from "@/lib/message-service-client"
import { createClient } from "@/lib/supabase/client"
import { useClientOnly } from "@/lib/hooks/use-client-only"

// Helper function to get current user ID
async function getCurrentUserId(): Promise<string> {
  // Prevent server-side execution
  if (typeof window === 'undefined') {
    throw new Error("Cannot get user ID on server side")
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error("User not authenticated")
  }
  
  return user.id
}

interface ActivityChatProps {
  onActivityChange?: () => void
}

export function ActivityChat({ onActivityChange }: ActivityChatProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    messageId: string
    action: string
    data: any
  } | null>(null)
  const isClient = useClientOnly()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load recent messages on component mount
  useEffect(() => {
    if (!isClient) return
    
    const loadMessages = async () => {
      try {
        const recentMessages = await getRecentMessages(20)
        setMessages(recentMessages)
      } catch (error) {
        console.error("Error loading messages:", error)
      }
    }
    loadMessages()
  }, [isClient])

  // Poll for new messages every 3 seconds to get n8n responses
  useEffect(() => {
    if (!isClient) return
    
    const interval = setInterval(async () => {
      try {
        const recentMessages = await getRecentMessages(20)
        setMessages(recentMessages)
      } catch (error) {
        console.error("Error polling messages:", error)
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
  }, [isClient])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    // Trigger refresh when messages change
    if (messages.length > 0) {
      onActivityChange?.()
    }
  }, [messages.length, onActivityChange])

  // Check for confirmation requests when messages change
  useEffect(() => {
    if (!isClient || messages.length === 0) return

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role === "assistant" && lastMessage.metadata?.action) {
      const action = lastMessage.metadata.action
      if ((action === "edit_activities" || action === "delete_activities") && 
          lastMessage.content.includes("Would you like to")) {
        setPendingConfirmation({
          messageId: lastMessage.id,
          action: action,
          data: lastMessage.metadata
        })
      }
    }
  }, [messages, isClient])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setIsLoading(true)

    // Add user message to local state immediately
    const newUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
      source: "chat"
    }
    setMessages(prev => [...prev, newUserMessage])

    try {
      // Get current user ID (you'll need to implement this)
      const userId = await getCurrentUserId()
      
      // Send message to local AI chat
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          message: userMessage,
          user_id: userId
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      // Reload messages to get AI responses
      const recentMessages = await getRecentMessages(20)
      setMessages(recentMessages)
    } catch (error) {
      console.error("Error sending message:", error)
      // Remove the temporary user message on error
      setMessages(prev => prev.filter(msg => msg.id !== newUserMessage.id))
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmation = async (confirmed: boolean) => {
    if (!pendingConfirmation) return

    setIsLoading(true)
    setPendingConfirmation(null)

    try {
      const userId = await getCurrentUserId()
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          message: confirmed ? "yes" : "no",
          user_id: userId
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send confirmation")
      }

      // Reload messages to get AI responses
      const recentMessages = await getRecentMessages(20)
      setMessages(recentMessages)
    } catch (error) {
      console.error("Error sending confirmation:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Don't render until client-side to prevent hydration issues
  if (!isClient) {
    return (
      <div className="flex flex-col h-[500px]">
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground text-sm">
                Type a message to start tracking your activities
              </p>
              <p className="text-center text-muted-foreground text-xs mt-2">
                Try: "I'm working" or "stop" or "start coding"
              </p>
            </CardContent>
          </Card>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === "user" 
                  ? "bg-primary text-primary-foreground" 
                  : message.source === "n8n"
                  ? "bg-blue-100 text-blue-900 border border-blue-200"
                  : "bg-muted"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">
                {message.content}
              </p>
              {(message.source === "n8n" || message.metadata?.from_ai) && (
                <div className="text-xs text-blue-600 mt-1">
                  <p>{message.metadata?.from_ai ? "from AI" : "from n8n"}</p>
                  {message.metadata?.action && (
                    <p className="text-blue-500">Action: {message.metadata.action}</p>
                  )}
                </div>
              )}
              
              {/* Show confirmation buttons for edit/delete operations */}
              {pendingConfirmation && 
               pendingConfirmation.messageId === message.id && 
               (message.metadata?.action === "edit_activities" || message.metadata?.action === "delete_activities") && (
                <div className="flex gap-2 mt-3">
                  <Button 
                    size="sm" 
                    onClick={() => handleConfirmation(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Yes
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleConfirmation(false)}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <X className="h-3 w-3 mr-1" />
                    No
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your activity..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
