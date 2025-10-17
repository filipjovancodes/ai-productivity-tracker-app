"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Send, Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { getRecentMessages, type ChatMessage } from "@/lib/message-service-client"

interface ActivityChatProps {
  onActivityChange?: () => void
}

export function ActivityChat({ onActivityChange }: ActivityChatProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load recent messages on component mount
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const recentMessages = await getRecentMessages(20)
        setMessages(recentMessages)
      } catch (error) {
        console.error("Error loading messages:", error)
      }
    }
    loadMessages()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    // Trigger refresh when messages change
    if (messages.length > 0) {
      onActivityChange?.()
    }
  }, [messages.length, onActivityChange])

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
      // Send message to n8n via our API
      const response = await fetch("/api/n8n/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: userMessage }),
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      // Reload messages to get any n8n responses
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
              {message.source === "n8n" && (
                <p className="text-xs text-blue-600 mt-1">from n8n</p>
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
