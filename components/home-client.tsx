"use client"

import { useState, useCallback } from "react"
import { CardContent } from "@/components/ui/card"
import { CurrentActivityDisplay } from "@/components/current-activity-display"
import { ActivityChat } from "@/components/activity-chat"
import { ActivityAnalytics } from "@/components/activity-analytics"
import { ActivityManager } from "@/components/activity-manager"
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

  const handleActivityChange = useCallback(() => {
    setRefreshTrigger(prev => prev + 1)
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
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <Card>
            <CardContent className="p-4">
              <ActivityChat 
                initialMessages={recentMessages}
                onActivityChange={handleActivityChange}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities">
          <ActivityManager 
            initialActivities={recentActivities}
            onActivityChange={handleActivityChange}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <ActivityAnalytics stats={stats} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
