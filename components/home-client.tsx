"use client"

import { useState, useCallback, useRef } from "react"
import { CardContent } from "@/components/ui/card"
import { CurrentActivityDisplay } from "@/components/current-activity-display"
import { ActivityChat } from "@/components/activity-chat"
import { ActivityAnalytics } from "@/components/activity-analytics"
import { ActivityManager } from "@/components/activity-manager"
import { UsageIndicator } from "@/components/usage-indicator"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, ListChecks, Wand2 } from "lucide-react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
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
  recentMessages,
}: HomeClientProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeTab, setActiveTab] = useState("activities")
  const [isChatOpen, setIsChatOpen] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const handleActivityChange = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  const handleChatOpen = useCallback(() => {
    setIsChatOpen(true)
    setTimeout(() => {
      if (chatRef.current) {
        const messagesContainer = chatRef.current.querySelector("[data-messages-container]")
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
      }
    }, 100)
  }, [])

  return (
    <div className="space-y-4">
      <CurrentActivityDisplay
        initialActivity={currentActivity}
        refreshTrigger={refreshTrigger}
        onActivityChange={handleActivityChange}
        topActivities={topActivities}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-0 bg-secondary/50">
          <TabsTrigger value="activities" className="text-xs sm:text-sm gap-1 sm:gap-2">
            <ListChecks className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Activities</span>
            <span className="sm:hidden">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm gap-1 sm:gap-2">
            <BarChart3 className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Analytics</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="mt-4 space-y-3">
          <ActivityManager
            initialActivities={recentActivities}
            onActivityChange={handleActivityChange}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-3">
          <ActivityAnalytics stats={stats} refreshTrigger={refreshTrigger} />
        </TabsContent>
      </Tabs>

      <Button
        onClick={handleChatOpen}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
        size="icon"
        title="Open AI Assistant"
      >
        <Wand2 className="h-6 w-6" />
        <span className="sr-only">AI Chat</span>
      </Button>

      <Drawer open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DrawerContent className="h-[80vh] flex flex-col">
          <DrawerHeader className="flex-shrink-0 border-b">
            <DrawerTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              AI Assistant
            </DrawerTitle>
          </DrawerHeader>
          <div ref={chatRef} className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 border-b px-4 py-2 bg-background">
              <UsageIndicator refreshTrigger={refreshTrigger} />
            </div>
            <Card className="flex-1 border-0 rounded-none overflow-hidden">
              <CardContent className="p-0 h-full">
                <ActivityChat initialMessages={recentMessages} onActivityChange={handleActivityChange} />
              </CardContent>
            </Card>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
