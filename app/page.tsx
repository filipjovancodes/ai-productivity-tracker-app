import { CardContent } from "@/components/ui/card"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentActivity, getActivityStats, getTopActivities } from "@/lib/activity-service"
import { CurrentActivityDisplay } from "@/components/current-activity-display"
import { ActivityChat } from "@/components/activity-chat"
import { ActivityAnalytics } from "@/components/activity-analytics"
import { ActivityManager } from "@/components/activity-manager"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity } from "lucide-react"

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const [currentActivity, stats, topActivities] = await Promise.all([
    getCurrentActivity(),
    getActivityStats(7),
    getTopActivities(5),
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
                <h1 className="text-2xl font-bold">Productivity Tracker</h1>
                <p className="text-sm text-muted-foreground">Track your time with AI</p>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <CurrentActivityDisplay initialActivity={currentActivity} />

          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="chat">
              <Card>
                <CardContent className="p-4">
                  <ActivityChat topActivities={topActivities} hasCurrentActivity={currentActivity !== null} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activities">
              <ActivityManager />
            </TabsContent>

            <TabsContent value="analytics">
              <ActivityAnalytics stats={stats} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
