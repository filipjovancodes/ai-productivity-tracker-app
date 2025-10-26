"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

interface UsageData {
  current_usage: number
  usage_limit: number
  usage_percentage: number
  plan_type: string
}

interface UsageIndicatorProps {
  refreshTrigger?: number
}

export function UsageIndicator({ refreshTrigger }: UsageIndicatorProps) {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsageData()
  }, [])

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadUsageData()
    }
  }, [refreshTrigger])

  const loadUsageData = async () => {
    try {
      const supabase = createClient()
      
      console.log("Loading usage data...")
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log("User data:", user, "User error:", userError)
      
      if (userError || !user) {
        console.error("Error getting user:", userError)
        setUsage({
          current_usage: 0,
          usage_limit: 30,
          usage_percentage: 0,
          plan_type: 'free'
        })
        return
      }
      
      // Get user subscription
      const { data: subData, error: subError } = await supabase.rpc('get_user_subscription', {
        p_user_id: user.id
      })
      
      console.log("Subscription data:", subData, "Error:", subError)
      
      if (subError) {
        console.error("Error getting subscription:", subError)
        // Fallback to free plan
        setUsage({
          current_usage: 0,
          usage_limit: 30,
          usage_percentage: 0,
          plan_type: 'free'
        })
        return
      }
      
      if (subData && subData.length > 0) {
        const subscription = subData[0]
        console.log("Found subscription:", subscription)
        
        // Get usage data
        const { data: usageCount, error: usageError } = await supabase.rpc('get_user_monthly_usage', {
          p_user_id: user.id,
          p_usage_type: 'ai_message'
        })
        
        console.log("Usage count:", usageCount, "Error:", usageError)
        
        const limit = subscription.plan_type === 'free' ? 30 : 
                     subscription.plan_type === 'pro' ? 1000 : 999999
        
        setUsage({
          current_usage: usageCount || 0,
          usage_limit: limit,
          usage_percentage: ((usageCount || 0) / limit) * 100,
          plan_type: subscription.plan_type
        })
      } else {
        console.log("No subscription found, creating free subscription automatically")
        
        // Automatically create a free subscription
        try {
          const createResponse = await fetch('/api/subscription/create-free', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          })
          
          const createResult = await createResponse.json()
          
          if (createResult.success) {
            console.log("Free subscription created successfully")
            // Set usage to free plan
            setUsage({
              current_usage: 0,
              usage_limit: 30,
              usage_percentage: 0,
              plan_type: 'free'
            })
          } else {
            console.error("Failed to create free subscription:", createResult.error)
            // Fallback to free plan anyway
            setUsage({
              current_usage: 0,
              usage_limit: 30,
              usage_percentage: 0,
              plan_type: 'free'
            })
          }
        } catch (error) {
          console.error("Error creating free subscription:", error)
          // Fallback to free plan anyway
          setUsage({
            current_usage: 0,
            usage_limit: 30,
            usage_percentage: 0,
            plan_type: 'free'
          })
        }
      }
    } catch (error) {
      console.error("Error loading usage data:", error)
      // Fallback to free plan on error
      setUsage({
        current_usage: 0,
        usage_limit: 30,
        usage_percentage: 0,
        plan_type: 'free'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    console.log("UsageIndicator: Loading...")
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading usage...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!usage) {
    console.log("UsageIndicator: No usage data")
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Usage data unavailable</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  console.log("UsageIndicator: Rendering with usage:", usage)

  const isNearLimit = usage.usage_percentage > 80
  const isAtLimit = usage.usage_percentage >= 100


  return (
    <Card className={`${isNearLimit ? 'border-amber-200 bg-amber-50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">AI Messages</span>
            <Badge variant="secondary" className="text-xs">
              {usage.plan_type}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {usage.current_usage} / {usage.usage_limit}
          </span>
        </div>
        
        <Progress value={usage.usage_percentage} className="h-2 mb-2" />
        
        {isNearLimit && !isAtLimit && (
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>You're approaching your monthly limit</span>
          </div>
        )}
        
        {isAtLimit && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Monthly limit reached</span>
            </div>
            <Button size="sm" asChild>
              <Link href="/subscription">Upgrade</Link>
            </Button>
          </div>
        )}
        
        {usage.plan_type === 'free' && usage.usage_percentage > 50 && (
          <div className="mt-2">
            <Button size="sm" variant="outline" asChild className="w-full">
              <Link href="/subscription">Upgrade for more messages</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
