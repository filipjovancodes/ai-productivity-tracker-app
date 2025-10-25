"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Cell } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ActivityStats } from "@/lib/types"
import { Clock, TrendingUp, BarChart3 } from "lucide-react"

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

export function ActivityAnalytics({ stats, refreshTrigger }: ActivityAnalyticsProps) {
  const [currentStats, setCurrentStats] = useState<ActivityStats[]>(stats || [])
  
  // Initialize with props
  useEffect(() => {
    setCurrentStats(stats || [])
  }, [stats])
  
  // Refresh stats when refreshTrigger changes (only if we have initial stats)
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
    minutes: stat.total_minutes,
    hours: (stat.total_minutes / 60).toFixed(1),
    sessions: stat.session_count,
  }))

  if (!currentStats || currentStats.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No activity data yet</p>
            <p className="text-muted-foreground text-xs mt-1">Start tracking to see your analytics</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Time Tracked</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalHours}h {remainingMinutes}m
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(currentStats || []).reduce((sum, stat) => sum + stat.session_count, 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across {(currentStats || []).length} activities</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Activity Comparison
          </CardTitle>
          <CardDescription>Compare time spent across activities</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              minutes: {
                label: "Minutes",
                color: "hsl(var(--chart-1))",
              },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis
                  type="number"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Math.floor(value / 60)}h`}
                />
                <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, props) => {
                        const hours = Math.floor(Number(value) / 60)
                        const mins = Number(value) % 60
                        return (
                          <div className="flex flex-col gap-1">
                            <div>
                              {hours}h {mins}m
                            </div>
                            <div className="text-xs text-muted-foreground">{props.payload.sessions} sessions</div>
                          </div>
                        )
                      }}
                    />
                  }
                />
                <Bar dataKey="minutes" radius={[0, 8, 8, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time by Activity</CardTitle>
          <CardDescription>Your productivity breakdown for the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              minutes: {
                label: "Minutes",
                color: "hsl(var(--chart-1))",
              },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Math.floor(value / 60)}h`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, props) => {
                        const hours = Math.floor(Number(value) / 60)
                        const mins = Number(value) % 60
                        return (
                          <div className="flex flex-col gap-1">
                            <div>
                              {hours}h {mins}m
                            </div>
                            <div className="text-xs text-muted-foreground">{props.payload.sessions} sessions</div>
                          </div>
                        )
                      }}
                    />
                  }
                />
                <Bar dataKey="minutes" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(currentStats || []).map((stat, index) => {
              const hours = Math.floor(stat.total_minutes / 60)
              const minutes = stat.total_minutes % 60
              const percentage = ((stat.total_minutes / totalMinutes) * 100).toFixed(1)

              return (
                <div key={stat.activity_name} className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{stat.activity_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {hours > 0 ? `${hours}h ` : ""}
                        {minutes}m
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">{percentage}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{stat.session_count} sessions</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
