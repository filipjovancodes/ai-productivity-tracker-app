"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Square } from "lucide-react"
import type { Activity } from "@/lib/types"
import { useClientOnly } from "@/lib/hooks/use-client-only"
import { QuickActions } from "@/components/quick-actions"
import { createClient } from "@/lib/supabase/client"

interface CurrentActivityDisplayProps {
  initialActivity: Activity | null
  onActivityChange?: () => void
  refreshTrigger?: number
  topActivities?: string[]
}

export function CurrentActivityDisplay({ initialActivity, onActivityChange, refreshTrigger, topActivities }: CurrentActivityDisplayProps) {
  const [activity, setActivity] = useState<Activity | null>(initialActivity)
  const [elapsed, setElapsed] = useState(0)
  const [isStopping, setIsStopping] = useState(false)
  const isClient = useClientOnly()

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
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // Add cache busting with timestamp
          const response = await fetch(`/api/activities?current=true&_t=${Date.now()}`, {
            cache: 'no-store'
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
          console.error('Error refreshing activity:', error)
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
      const { data: stoppedActivityId, error } = await supabase
        .rpc('stop_current_n8n_activity', {
          p_user_id: user.id
        })

      if (error) {
        throw new Error(`Failed to stop activity: ${error.message}`)
      }

      // Update UI immediately
      setActivity(null)
      setElapsed(0)
      
      // Wait a bit then trigger refresh to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 300))
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
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground text-sm">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  if (!activity) {
    return (
      <div className="space-y-4">
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-muted-foreground text-sm">No active session</p>
          </CardContent>
        </Card>
        {topActivities && topActivities.length > 0 && (
          <QuickActions
            topActivities={topActivities}
            hasCurrentActivity={false}
            onActivityChange={onActivityChange}
          />
        )}
      </div>
    )
  }

  const hours = Math.floor(elapsed / 60)
  const minutes = elapsed % 60

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardContent className="flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-lg">{activity.activity_name}</p>
            <p className="text-sm text-muted-foreground">Currently active</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-lg font-mono px-4 py-2">
            {hours > 0 ? `${hours}h ` : ""}
            {minutes}m
          </Badge>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleStopActivity}
            disabled={isStopping}
          >
            <Square className="h-4 w-4 mr-2" />
            {isStopping ? "Stopping..." : "Stop"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
