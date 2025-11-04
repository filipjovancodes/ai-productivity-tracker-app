"use client"

import { Button } from "@/components/ui/button"
import { startActivity, stopCurrentActivity } from "@/lib/activity-service"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Zap } from "lucide-react"

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
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
        {topActivities.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Start activities to see quick actions</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {topActivities.slice(0, 4).map((activity) => (
              <Button
                key={activity}
                variant="outline"
                onClick={() => handleStartActivity(activity)}
                disabled={loading !== null}
                className="h-8 text-xs py-1 px-2"
                size="sm"
              >
                <span className="truncate">{activity}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
