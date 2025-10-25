"use client"

import { useState, useCallback, useRef } from "react"
import { CardContent } from "@/components/ui/card"
import { CurrentActivityDisplay } from "@/components/current-activity-display"
import { ActivityChat } from "@/components/activity-chat"
import { ActivityAnalytics } from "@/components/activity-analytics"
import { ActivityManager } from "@/components/activity-manager"
import { UsageIndicator } from "@/components/usage-indicator"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Activity, ActivityStats } from "@/lib/types"
import type { ChatMessage } from "@/lib/message-service"

interface HomeClientProps {
  currentActivity: Activity | null
  stats: ActivityStats[]
  topActivities: string[]
  recentActivities: Activity[]
  recentMessages: ChatMessage[]
}

export function HomeClient({ 
  currentActivity, 
  stats, 
  topActivities, 
  recentActivities, 
  recentMessages 
}: HomeClientProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const chatRef = useRef<HTMLDivElement>(null)

  const handleActivityChange = useCallback(() => {
    setRefreshTrigger(prev => prev + 1)
  }, [])

  const handleChatTabClick = useCallback(() => {
    // Scroll to bottom when chat tab is clicked
    setTimeout(() => {
      if (chatRef.current) {
        const messagesContainer = chatRef.current.querySelector('[data-messages-container]')
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
      }
    }, 100)
  }, [])

  return (
    <div className="space-y-6">
      <CurrentActivityDisplay 
        initialActivity={currentActivity} 
        refreshTrigger={refreshTrigger}
        onActivityChange={handleActivityChange}
        topActivities={topActivities}
      />

      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chat" onClick={handleChatTabClick}>Chat</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" ref={chatRef}>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <ActivityChat 
                  initialMessages={recentMessages}
                  onActivityChange={handleActivityChange}
                />
              </CardContent>
            </Card>
            
            <UsageIndicator refreshTrigger={refreshTrigger} />
          </div>
        </TabsContent>

        <TabsContent value="activities">
          <ActivityManager 
            initialActivities={recentActivities}
            onActivityChange={handleActivityChange}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <ActivityAnalytics stats={stats} refreshTrigger={refreshTrigger} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
