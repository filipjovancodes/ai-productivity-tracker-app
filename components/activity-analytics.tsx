"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ActivityStats } from "@/lib/types"
import { TrendingUp } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { Button } from "@/components/ui/button"

interface ActivityAnalyticsProps {
  stats: ActivityStats[]
  refreshTrigger?: number
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

type TimeRange = "7days" | "30days" | "90days" | "all"

export function ActivityAnalytics({ stats, refreshTrigger }: ActivityAnalyticsProps) {
  const [currentStats, setCurrentStats] = useState<ActivityStats[]>(stats || [])
  const [timeRange, setTimeRange] = useState<TimeRange>("7days")

  useEffect(() => {
    setCurrentStats(stats || [])
  }, [stats])

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0 && stats && stats.length > 0) {
      const loadStats = async () => {
        try {
          const response = await fetch("/api/activities?stats=true")
          const data = await response.json()
          if (data.success) {
            setCurrentStats(data.stats || [])
          }
        } catch (error) {
          console.error("Error loading stats:", error)
        }
      }
      loadStats()
    }
  }, [refreshTrigger, stats])

  const totalMinutes = (currentStats || []).reduce((sum, stat) => sum + stat.total_minutes, 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60

  const chartData = (currentStats || []).map((stat) => ({
    name: stat.activity_name,
    value: stat.total_minutes,
    hours: (stat.total_minutes / 60).toFixed(1),
    sessions: stat.session_count,
  }))

  if (!currentStats || currentStats.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-xs sm:text-sm">No activity data yet</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        <Button
          variant={timeRange === "7days" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeRange("7days")}
          className="text-xs h-8"
        >
          7 Days
        </Button>
        <Button
          variant={timeRange === "30days" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeRange("30days")}
          className="text-xs h-8"
        >
          30 Days
        </Button>
        <Button
          variant={timeRange === "90days" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeRange("90days")}
          className="text-xs h-8"
        >
          90 Days
        </Button>
        <Button
          variant={timeRange === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeRange("all")}
          className="text-xs h-8"
        >
          All
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {totalHours}h {remainingMinutes}m
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {(currentStats || []).reduce((sum, stat) => sum + stat.session_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Activity Breakdown</CardTitle>
          <CardDescription className="text-xs">
            Last{" "}
            {timeRange === "7days"
              ? "7 days"
              : timeRange === "30days"
                ? "30 days"
                : timeRange === "90days"
                  ? "90 days"
                  : "all time"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Pie Chart */}
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend with percentages */}
            <div className="space-y-2">
              {(currentStats || []).map((stat, index) => {
                const percentage = ((stat.total_minutes / totalMinutes) * 100).toFixed(0)

                return (
                  <div key={stat.activity_name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="truncate font-medium">{stat.activity_name}</span>
                    </div>
                    <span className="text-muted-foreground font-mono">{percentage}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
