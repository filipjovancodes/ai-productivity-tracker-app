import { CardContent } from "@/components/ui/card"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentActivity, getActivityStats, getTopActivities, getRecentActivities } from "@/lib/activity-service"
import { getRecentMessages } from "@/lib/message-service"
import { CurrentActivityDisplay } from "@/components/current-activity-display"
import { ActivityChat } from "@/components/activity-chat"
import { ActivityAnalytics } from "@/components/activity-analytics"
import { ActivityManager } from "@/components/activity-manager"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity } from "lucide-react"
import { HomeClient } from "@/components/home-client"

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const [currentActivity, stats, topActivities, recentActivities, recentMessages] = await Promise.all([
    getCurrentActivity(),
    getActivityStats(7),
    getTopActivities(5),
    getRecentActivities(20),
    getRecentMessages(20),
  ])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Activity className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">AI Time Tracker</h1>
                <p className="text-sm text-muted-foreground">Track your time with AI</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a href="/subscription" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Subscription
              </a>
              <form action="/auth/signout" method="post">
                <button type="submit" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <HomeClient 
          currentActivity={currentActivity}
          stats={stats}
          topActivities={topActivities}
          recentActivities={recentActivities}
          recentMessages={recentMessages}
        />
      </main>
    </div>
  )
}
