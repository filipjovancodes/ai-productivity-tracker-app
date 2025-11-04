"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clock, Square, Play } from "lucide-react"
import type { Activity } from "@/lib/types"
import { useClientOnly } from "@/lib/hooks/use-client-only"
import { QuickActions } from "@/components/quick-actions"
import { createClient } from "@/lib/supabase/client"
import { startActivity } from "@/lib/activity-service"
import { useRouter } from "next/navigation"

interface CurrentActivityDisplayProps {
  initialActivity: Activity | null
  onActivityChange?: () => void
  refreshTrigger?: number
  topActivities?: string[]
}

export function CurrentActivityDisplay({
  initialActivity,
  onActivityChange,
  refreshTrigger,
  topActivities,
}: CurrentActivityDisplayProps) {
  const [activity, setActivity] = useState<Activity | null>(initialActivity)
  const [elapsed, setElapsed] = useState(0)
  const [isStopping, setIsStopping] = useState(false)
  const [newActivityInput, setNewActivityInput] = useState("")
  const [isStarting, setIsStarting] = useState(false)
  const isClient = useClientOnly()
  const router = useRouter()

  useEffect(() => {
    setActivity(initialActivity)
    setElapsed(0)
  }, [initialActivity])

  // Refresh activity when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && isClient) {
      const refreshActivity = async () => {
        try {
          // Wait a bit to ensure database operations complete
          await new Promise((resolve) => setTimeout(resolve, 300))

          // Add cache busting with timestamp
          const response = await fetch(`/api/activities?current=true&_t=${Date.now()}`, {
            cache: "no-store",
          })
          const data = await response.json()
          if (data.success && data.activity) {
            setActivity(data.activity)
            setElapsed(0)
          } else {
            setActivity(null)
            setElapsed(0)
          }
        } catch (error) {
          console.error("Error refreshing activity:", error)
        }
      }
      refreshActivity()
    }
  }, [refreshTrigger, isClient])

  useEffect(() => {
    if (!isClient || !activity) return

    const interval = setInterval(() => {
      const start = new Date(activity.started_at).getTime()
      const now = Date.now()
      const minutes = Math.floor((now - start) / 60000)
      setElapsed(minutes)
    }, 1000)

    return () => clearInterval(interval)
  }, [isClient, activity])

  const handleStartNewActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newActivityInput.trim() || isStarting) return

    setIsStarting(true)
    try {
      await startActivity(newActivityInput.trim())
      setNewActivityInput("")
      onActivityChange?.()
      router.refresh()
    } catch (error) {
      console.error("Error starting activity:", error)
    } finally {
      setIsStarting(false)
    }
  }

  const handleStopActivity = async () => {
    if (!activity || isStopping) return

    setIsStopping(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        console.error("User not authenticated")
        return
      }

      // Call database function directly to stop activity
      const { data: stoppedActivityId, error } = await supabase.rpc("stop_current_n8n_activity", {
        p_user_id: user.id,
      })

      if (error) {
        throw new Error(`Failed to stop activity: ${error.message}`)
      }

      // Update UI immediately
      setActivity(null)
      setElapsed(0)

      // Wait a bit then trigger refresh to ensure database is updated
      await new Promise((resolve) => setTimeout(resolve, 300))
      onActivityChange?.()
    } catch (error) {
      console.error("Error stopping activity:", error)
    } finally {
      setIsStopping(false)
    }
  }

  // Don't render timer until client-side to prevent hydration issues
  if (!isClient) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-6">
          <p className="text-muted-foreground text-xs sm:text-sm">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  if (!activity) {
    return (
      <Card className="border-dashed text-sm">
        <CardContent className="py-3 px-3">
          <form onSubmit={handleStartNewActivity} className="mb-3">
            <div className="flex gap-2">
              <Input
                value={newActivityInput}
                onChange={(e) => setNewActivityInput(e.target.value)}
                placeholder="I'm working on..."
                disabled={isStarting}
                className="text-xs h-8 flex-1"
              />
              <Button
                type="submit"
                disabled={!newActivityInput.trim() || isStarting}
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <Play className="h-4 w-4" />
              </Button>
            </div>
          </form>
          {topActivities && topActivities.length > 0 && (
            <div className="border-t pt-2">
              <QuickActions
                topActivities={topActivities}
                hasCurrentActivity={false}
                onActivityChange={onActivityChange}
              />
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const hours = Math.floor(elapsed / 60)
  const minutes = elapsed % 60

  return (
    <Card className="border-primary/50 bg-primary/5 text-sm">
      <CardContent className="py-3 px-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
              <Clock className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-xs truncate">{activity.activity_name}</p>
              <p className="text-[10px] text-muted-foreground">Active now</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge variant="secondary" className="text-xs font-mono px-1.5 py-0">
              {hours > 0 ? `${hours}h ` : ""}
              {minutes}m
            </Badge>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStopActivity}
              disabled={isStopping}
              className="text-xs h-6 px-2"
            >
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
