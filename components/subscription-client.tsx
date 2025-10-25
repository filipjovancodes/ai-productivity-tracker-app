"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Check, Zap, Crown, Star, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface UserSubscription {
  plan_type: string
  status: string
  current_period_end: string | null
  is_active: boolean
}

interface UsageData {
  current_usage: number
  usage_limit: number
  usage_percentage: number
}

export function SubscriptionClient() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubscriptionData()
  }, [])

  const loadSubscriptionData = async () => {
    try {
      const supabase = createClient()
      
      // Get user subscription
      const { data: subData } = await supabase.rpc('get_user_subscription')
      if (subData && subData.length > 0) {
        setSubscription(subData[0])
      }

      // Get usage data
      const { data: usageData } = await supabase.rpc('get_user_monthly_usage', {
        p_usage_type: 'ai_message'
      })
      
      if (usageData !== null) {
        const limit = subscription?.plan_type === 'free' ? 30 : 
                     subscription?.plan_type === 'pro' ? 1000 : 10000
        setUsage({
          current_usage: usageData,
          usage_limit: limit,
          usage_percentage: (usageData / limit) * 100
        })
      }
    } catch (error) {
      console.error("Error loading subscription data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (planType: string) => {
    try {
      // In a real implementation, you would integrate with Stripe here
      // For now, we'll just show an alert
      alert(`Upgrading to ${planType} plan. This would integrate with Stripe in production.`)
    } catch (error) {
      console.error("Error upgrading plan:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Plan Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>Your current subscription and usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold capitalize">{subscription?.plan_type || 'Free'}</h3>
              <p className="text-sm text-muted-foreground">
                Status: <Badge variant={subscription?.is_active ? "default" : "secondary"}>
                  {subscription?.status || 'Active'}
                </Badge>
              </p>
            </div>
            {subscription?.current_period_end && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Renews on</p>
                <p className="text-sm font-medium">
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {usage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>AI Messages this month</span>
                <span className="font-medium">{usage.current_usage} / {usage.usage_limit}</span>
              </div>
              <Progress value={usage.usage_percentage} className="h-2" />
              {usage.usage_percentage > 80 && (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>You're approaching your monthly limit</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Options */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="relative border-primary">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground">Recommended</Badge>
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Pro Plan
            </CardTitle>
            <CardDescription>Perfect for serious productivity tracking</CardDescription>
            <div className="text-2xl font-bold">$9<span className="text-sm font-normal text-muted-foreground">/month</span></div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>1,000 AI messages per month</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Advanced analytics</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Data export</span>
              </li>
            </ul>
            <Button 
              className="w-full" 
              onClick={() => handleUpgrade('pro')}
              disabled={subscription?.plan_type === 'pro'}
            >
              {subscription?.plan_type === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-500" />
              Premium Plan
            </CardTitle>
            <CardDescription>For power users and teams</CardDescription>
            <div className="text-2xl font-bold">$19<span className="text-sm font-normal text-muted-foreground">/month</span></div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>10,000 AI messages per month</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Everything in Pro</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>API access</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Team collaboration</span>
              </li>
            </ul>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => handleUpgrade('premium')}
              disabled={subscription?.plan_type === 'premium'}
            >
              {subscription?.plan_type === 'premium' ? 'Current Plan' : 'Upgrade to Premium'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
