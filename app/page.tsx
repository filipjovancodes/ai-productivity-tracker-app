import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentActivity, getActivityStats, getTopActivities } from "@/lib/activity-service"
import { CurrentActivityDisplay } from "@/components/current-activity-display"
import { ActivityChat } from "@/components/activity-chat"
import { ActivityAnalytics } from "@/components/activity-analytics"
import { QuickActions } from "@/components/quick-actions"
import { ActivityManager } from "@/components/activity-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">How to Use</CardTitle>
            <CardDescription>
              Simply tell the AI what you're doing in natural language. Try "I'm working" to start tracking, or "stop"
              to end your current session. Use quick actions for your most frequent activities.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <CurrentActivityDisplay initialActivity={currentActivity} />

            <Tabs defaultValue="chat" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="chat">AI Chat</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="manage">Manage</TabsTrigger>
              </TabsList>
              <TabsContent value="chat">
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Chat</CardTitle>
                    <CardDescription>Tell me what you're working on</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ActivityChat />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="analytics">
                <ActivityAnalytics stats={stats} />
              </TabsContent>
              <TabsContent value="manage">
                <ActivityManager />
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <QuickActions topActivities={topActivities} hasCurrentActivity={currentActivity !== null} />
          </div>
        </div>
      </main>
    </div>
  )
}
