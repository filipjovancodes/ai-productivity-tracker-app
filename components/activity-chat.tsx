"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Send, Loader2, Check, X, Mic, MicOff } from "lucide-react"
import { useEffect, useState, useRef, useCallback } from "react"
import { getRecentMessages, type ChatMessage } from "@/lib/message-service-client"
import { createClient } from "@/lib/supabase/client"
import { useClientOnly } from "@/lib/hooks/use-client-only"

// Helper function to get current user ID
async function getCurrentUserId(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Cannot get user ID on server side")
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not authenticated")
  }

  return user.id
}

interface ActivityChatProps {
  onActivityChange?: () => void
  initialMessages?: ChatMessage[]
}

export function ActivityChat({ onActivityChange, initialMessages }: ActivityChatProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    messageId: string
    action: string
    data: any
  } | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const [recognitionError, setRecognitionError] = useState<string | null>(null)
  const isClient = useClientOnly()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const lastMessageCountRef = useRef(0)
  const shouldScrollToBottomRef = useRef(true)
  const previousScrollHeightRef = useRef(0)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTranscriptRef = useRef<string>('')

  // Initialize messages on component mount
  useEffect(() => {
    const initializeChat = async () => {
      try {
        let initialMsgs: ChatMessage[] = []
        
        if (initialMessages && initialMessages.length > 0) {
          initialMsgs = initialMessages
          setHasMoreMessages(initialMessages.length === 6)
        } else {
          initialMsgs = await getRecentMessages(6)
          setHasMoreMessages(initialMsgs.length === 6)
        }
        
        setMessages(initialMsgs)
        lastMessageCountRef.current = initialMsgs.length
        
        // Scroll to bottom instantly, then mark as ready
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
          setTimeout(() => setIsReady(true), 50)
        }, 0)
      } catch (error) {
        console.error("Error loading messages:", error)
        setIsReady(true)
      }
    }

    initializeChat()
  }, []) // Only run once on mount

  // Load more messages when scrolling to top
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages || messages.length === 0) return
    
    const container = messagesContainerRef.current
    if (!container) return

    setIsLoadingMore(true)
    shouldScrollToBottomRef.current = false
    previousScrollHeightRef.current = container.scrollHeight

    try {
      const oldestMessage = messages[0]
      const olderMessages = await getRecentMessages(20, oldestMessage.created_at)
      
      if (olderMessages.length === 0) {
        setHasMoreMessages(false)
      } else {
        setMessages(prev => [...olderMessages, ...prev])
        
        // Restore scroll position after new messages are rendered
        requestAnimationFrame(() => {
          const newScrollHeight = container.scrollHeight
          const scrollDiff = newScrollHeight - previousScrollHeightRef.current
          container.scrollTop = scrollDiff
        })
      }
    } catch (error) {
      console.error("Error loading more messages:", error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMoreMessages, messages])

  // Handle scroll to load more messages
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !isReady) return

    const handleScroll = () => {
      if (container.scrollTop < 50 && hasMoreMessages && !isLoadingMore) {
        loadMoreMessages()
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [hasMoreMessages, isLoadingMore, loadMoreMessages, isReady])

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!isReady) return

    const interval = setInterval(async () => {
      try {
        const recentMessages = await getRecentMessages(6)
        
        setMessages(prev => {
          // If we have more than 6 messages (from lazy loading), only append new ones
          if (prev.length > 6) {
            const existingIds = new Set(prev.map(m => m.id))
            const newMessages = recentMessages.filter(m => !existingIds.has(m.id))
            
            if (newMessages.length > 0) {
              shouldScrollToBottomRef.current = true
              return [...prev, ...newMessages]
            }
            return prev
          } else {
            // Only update if there are actual changes
            const lastOld = prev[prev.length - 1]
            const lastNew = recentMessages[recentMessages.length - 1]
            
            if (!lastOld || lastNew?.id !== lastOld.id || recentMessages.length !== prev.length) {
              shouldScrollToBottomRef.current = true
              return recentMessages
            }
            return prev
          }
        })
      } catch (error) {
        console.error("Error polling messages:", error)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isReady])

  // Trigger refresh when messages change
  useEffect(() => {
    if (messages.length > 0 && messages.length !== lastMessageCountRef.current) {
      lastMessageCountRef.current = messages.length
      onActivityChange?.()
    }
  }, [messages.length, onActivityChange])

  // Check for confirmation requests and handle auto-scroll
  useEffect(() => {
    if (!isClient || !isReady || messages.length === 0) return

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role === "assistant" && lastMessage.metadata?.action) {
      const action = lastMessage.metadata.action
      if (
        (action === "edit_activities" || action === "delete_activities" || action === "log_past") &&
        lastMessage.content.includes("Would you like")
      ) {
        setPendingConfirmation({
          messageId: lastMessage.id,
          action: action,
          data: lastMessage.metadata,
        })
      } else {
        setPendingConfirmation(null)
      }
    }
    
    // Auto-scroll to bottom only when appropriate
    if (shouldScrollToBottomRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        shouldScrollToBottomRef.current = false
      }, 100)
    }
  }, [messages, isClient, isReady])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setIsLoading(true)
    shouldScrollToBottomRef.current = true

    const newUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
      source: "chat",
    }
    setMessages((prev) => [...prev, newUserMessage])

    try {
      const userId = await getCurrentUserId()

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          user_id: userId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 429) {
          // Usage limit exceeded
          throw new Error(`Usage limit exceeded: ${errorData.details}`)
        }
        throw new Error("Failed to send message")
      }

      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Load enough messages to include the new response
      const recentMessages = await getRecentMessages(Math.max(messages.length + 2, 6))
      setMessages(recentMessages)
      
      onActivityChange?.()
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => prev.filter((msg) => msg.id !== newUserMessage.id))
      
      // Show usage limit error with upgrade link
      if (error instanceof Error && error.message.includes("Usage limit exceeded")) {
        setMessages((prev) => [...prev, {
          id: `error-${Date.now()}`,
          role: "assistant" as const,
          content: `❌ ${error.message}\n\n[Upgrade your plan](/subscription) to continue using AI features.`,
          created_at: new Date().toISOString(),
          source: "system"
        }])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmation = async (confirmed: boolean) => {
    if (!pendingConfirmation) return

    setIsLoading(true)
    setPendingConfirmation(null)
    shouldScrollToBottomRef.current = true

    try {
      const userId = await getCurrentUserId()
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: confirmed ? "yes" : "no",
          user_id: userId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send confirmation")
      }

      await new Promise(resolve => setTimeout(resolve, 300))
      
      const recentMessages = await getRecentMessages(Math.max(messages.length + 2, 6))
      setMessages(recentMessages)
      
      onActivityChange?.()
    } catch (error) {
      console.error("Error sending confirmation:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Check for speech recognition support and initialize
  useEffect(() => {
    if (!isClient) return

    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    
    if (SpeechRecognition) {
      setIsSpeechSupported(true)
      
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsRecording(true)
        setRecognitionError(null)
        // Input is already preserved in finalTranscriptRef.current via toggleRecording
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = ''
        let newFinalTranscript = ''

        // Process all results from the event
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            newFinalTranscript += transcript + ' '
            // Add to accumulated final transcript
            finalTranscriptRef.current += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        // Update input: existing base + new final results + current interim
        setInput(finalTranscriptRef.current + interimTranscript)
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsRecording(false)
        
        let errorMessage = 'Speech recognition error'
        if (event.error === 'no-speech') {
          errorMessage = 'No speech detected. Please try again.'
        } else if (event.error === 'audio-capture') {
          errorMessage = 'No microphone found. Please check your microphone.'
        } else if (event.error === 'not-allowed') {
          errorMessage = 'Microphone permission denied. Please allow microphone access.'
        } else {
          errorMessage = `Speech recognition error: ${event.error}`
        }
        
        setRecognitionError(errorMessage)
        
        // Clear error after 5 seconds
        setTimeout(() => setRecognitionError(null), 5000)
      }

      recognition.onend = () => {
        setIsRecording(false)
        // Finalize the transcript when recognition ends
        setInput(finalTranscriptRef.current.trim())
      }

      recognitionRef.current = recognition
    } else {
      setIsSpeechSupported(false)
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [isClient])

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) {
      setRecognitionError('Speech recognition not supported in this browser')
      return
    }

    if (isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
      // When stopping, ensure final transcript is in input (will be set in onend)
    } else {
      // Reset final transcript reference to current input (preserve typed text)
      finalTranscriptRef.current = input.trim()
      try {
        recognitionRef.current.start()
      } catch (error) {
        console.error('Error starting recognition:', error)
        setRecognitionError('Failed to start recording. Please try again.')
        setIsRecording(false)
      }
    }
  }, [isRecording, input])

  // Also stop recording if user submits form while recording
  const handleSubmitWithVoice = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // Stop recording if active
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop()
      // Wait a moment for onend to fire and finalize transcript
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Then proceed with normal submit
    const userMessage = input.trim()
    setInput("")
    setIsLoading(true)
    shouldScrollToBottomRef.current = true

    const newUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
      source: "chat",
    }
    setMessages((prev) => [...prev, newUserMessage])

    try {
      const userId = await getCurrentUserId()

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          user_id: userId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 429) {
          // Usage limit exceeded
          throw new Error(`Usage limit exceeded: ${errorData.details}`)
        }
        throw new Error("Failed to send message")
      }

      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Load enough messages to include the new response
      const recentMessages = await getRecentMessages(Math.max(messages.length + 2, 6))
      setMessages(recentMessages)
      
      onActivityChange?.()
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => prev.filter((msg) => msg.id !== newUserMessage.id))
      
      // Show usage limit error with upgrade link
      if (error instanceof Error && error.message.includes("Usage limit exceeded")) {
        setMessages((prev) => [...prev, {
          id: `error-${Date.now()}`,
          role: "assistant" as const,
          content: `❌ ${error.message}\n\n[Upgrade your plan](/subscription) to continue using AI features.`,
          created_at: new Date().toISOString(),
          source: "system"
        }])
      }
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, isRecording, messages.length, onActivityChange])

  // Don't render until ready
  if (!isClient || !isReady) {
    return (
      <div className="flex flex-col h-[500px]">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col h-[500px]">
        <div className="flex-1 overflow-y-auto p-4" ref={messagesContainerRef}>
          <div className="space-y-4">
            {isLoadingMore && (
              <div className="flex justify-center items-center py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
              </div>
            )}
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
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {(message.source === "n8n" || message.metadata?.from_ai) && (
                    <div className="text-xs text-blue-600 mt-1">
                      <p>{message.metadata?.from_ai ? "from AI" : "from n8n"}</p>
                      {message.metadata?.action && <p className="text-blue-500">Action: {message.metadata.action}</p>}
                    </div>
                  )}

                  {pendingConfirmation &&
                    pendingConfirmation.messageId === message.id &&
                    (message.metadata?.action === "edit_activities" ||
                      message.metadata?.action === "delete_activities" ||
                      message.metadata?.action === "log_past") && (
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
        </div>
        <form onSubmit={handleSubmitWithVoice} className="flex gap-2 p-4 border-t">
          <div className="flex-1 relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRecording ? "Listening..." : "Start work activity"}
              disabled={isLoading}
              className="flex-1 pr-10"
            />
            {recognitionError && (
              <div className="absolute -top-8 left-0 right-0 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded">
                {recognitionError}
              </div>
            )}
          </div>
          {isSpeechSupported && (
            <Button
              type="button"
              onClick={toggleRecording}
              disabled={isLoading}
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
              className={isRecording ? "animate-pulse" : ""}
              title={isRecording ? "Stop recording" : "Start voice input"}
            >
              {isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}