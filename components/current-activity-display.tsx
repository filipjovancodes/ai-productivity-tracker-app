"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"
import type { Activity } from "@/lib/types"
import { useClientOnly } from "@/lib/hooks/use-client-only"

interface CurrentActivityDisplayProps {
  initialActivity: Activity | null
}

export function CurrentActivityDisplay({ initialActivity }: CurrentActivityDisplayProps) {
  const [activity, setActivity] = useState<Activity | null>(initialActivity)
  const [elapsed, setElapsed] = useState(0)
  const isClient = useClientOnly()

  useEffect(() => {
    setActivity(initialActivity)
    setElapsed(0)
  }, [initialActivity])

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
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground text-sm">No active session</p>
        </CardContent>
      </Card>
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
        <Badge variant="secondary" className="text-lg font-mono px-4 py-2">
          {hours > 0 ? `${hours}h ` : ""}
          {minutes}m
        </Badge>
      </CardContent>
    </Card>
  )
}
