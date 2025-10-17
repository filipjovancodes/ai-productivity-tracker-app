"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { startActivity, stopCurrentActivity } from "@/lib/activity-service"
import { Zap, Square } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface QuickActionsProps {
  topActivities: string[]
  hasCurrentActivity: boolean
  onActivityChange?: () => void
}

export function QuickActions({ topActivities, hasCurrentActivity, onActivityChange }: QuickActionsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  const handleStartActivity = async (activityName: string) => {
    setLoading(activityName)
    try {
      await startActivity(activityName)
      onActivityChange?.()
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  const handleStopActivity = async () => {
    setLoading("stop")
    try {
      await stopCurrentActivity()
      onActivityChange?.()
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Actions
        </CardTitle>
        <CardDescription>Start your most frequent activities with one click</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {topActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Your most used activities will appear here</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {topActivities.map((activity) => (
              <Button
                key={activity}
                variant="outline"
                onClick={() => handleStartActivity(activity)}
                disabled={loading !== null}
                className="h-auto py-3 flex flex-col items-center gap-1"
              >
                <span className="font-medium">{activity}</span>
                {loading === activity && <span className="text-xs text-muted-foreground">Starting...</span>}
              </Button>
            ))}
          </div>
        )}

        {hasCurrentActivity && (
          <Button
            variant="destructive"
            onClick={handleStopActivity}
            disabled={loading !== null}
            className="w-full mt-4"
          >
            <Square className="h-4 w-4 mr-2" />
            {loading === "stop" ? "Stopping..." : "Stop Current Activity"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
