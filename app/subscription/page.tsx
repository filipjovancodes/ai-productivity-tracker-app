import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Crown, Star } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { StripeCheckout } from "@/components/stripe-checkout"
import Image from "next/image"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Subscription Plans",
  description:
    "Choose your AI Time Tracker plan. Free plan includes 30 AI messages per month. Upgrade to Pro or Premium for unlimited messages and advanced features.",
  openGraph: {
    title: "AI Time Tracker - Subscription Plans",
    description:
      "Choose your AI Time Tracker plan. Free plan includes 30 AI messages per month. Upgrade to Pro or Premium for unlimited messages and advanced features.",
  },
}

export default async function SubscriptionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aitimetracker.com"

  // Software Application schema with detailed offers
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AI Time Tracker",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    offers: [
      {
        "@type": "Offer",
        name: "Free Plan",
        price: "0",
        priceCurrency: "USD",
        priceValidUntil: "2025-12-31",
        description: "30 AI messages per month, basic activity tracking, 7-day analytics, email support",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "0",
          priceCurrency: "USD",
          billingIncrement: "P1M",
        },
      },
      {
        "@type": "Offer",
        name: "Pro Plan",
        price: "5",
        priceCurrency: "USD",
        priceValidUntil: "2025-12-31",
        description:
          "1,000 AI messages per month, unlimited analytics, advanced tracking, CSV export, priority support, custom activity categories",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "5",
          priceCurrency: "USD",
          billingIncrement: "P1M",
        },
      },
      {
        "@type": "Offer",
        name: "Premium Plan",
        price: "10",
        priceCurrency: "USD",
        priceValidUntil: "2025-12-31",
        description: "Unlimited AI messages, unlimited analytics, all Pro features, API access, team collaboration",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "10",
          priceCurrency: "USD",
          billingIncrement: "P1M",
        },
      },
    ],
  }

  // Pricing FAQ for subscription page
  const pricingFaqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What features are included in the Free plan?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The Free plan includes 30 AI messages per month, basic activity tracking, 7-day analytics, and email support. This is perfect for individuals getting started with time tracking.",
        },
      },
      {
        "@type": "Question",
        name: "What is the difference between Pro and Premium plans?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pro plan ($5/month) includes 1,000 AI messages per month, unlimited analytics, CSV export, priority support, and custom categories. Premium plan ($10/month) includes unlimited AI messages, all Pro features, plus API access and team collaboration features.",
        },
      },
      {
        "@type": "Question",
        name: "Can I upgrade or downgrade my plan?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, you can upgrade or downgrade your subscription plan at any time. Changes take effect immediately for upgrades, and downgrades apply at the next billing cycle.",
        },
      },
      {
        "@type": "Question",
        name: "What happens if I exceed my AI message limit?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "If you exceed your monthly AI message limit on the Free or Pro plan, you'll be prompted to upgrade. The system will show your current usage and remaining messages. Premium users have unlimited messages.",
        },
      },
    ],
  }

  const structuredData = [softwareSchema, pricingFaqSchema]

  return (
    <div className="min-h-screen bg-background">
      {structuredData.map((schema, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <header className="border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="relative h-8 w-8 flex-shrink-0 sm:h-10 sm:w-10">
                <Image src="/logo.png" alt="AI Time Tracker Logo" fill className="object-contain" priority />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-semibold sm:text-lg">AI Time Tracker</h1>
              </div>
            </a>
            <div className="flex items-center gap-3">
              <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors sm:text-sm">
                Dashboard
              </a>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors sm:text-sm"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
          <p className="text-muted-foreground text-lg">Unlock the full potential of AI-powered time tracking</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Free Plan */}
          <Card className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Free</CardTitle>
                <Badge variant="secondary">Current</Badge>
              </div>
              <CardDescription>Perfect for getting started</CardDescription>
              <div className="text-3xl font-bold">
                $0<span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>30 AI messages per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Basic activity tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>7-day analytics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Email support</span>
                </li>
              </ul>
              <Button className="w-full bg-transparent" variant="outline" disabled>
                Current Plan
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="relative border-primary">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
            </div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Pro
                </CardTitle>
              </div>
              <CardDescription>For serious time tracking enthusiasts</CardDescription>
              <div className="text-3xl font-bold">
                $5<span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>1,000 AI messages per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Advanced activity tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Unlimited analytics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Export data to CSV</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Custom activity categories</span>
                </li>
              </ul>
              <StripeCheckout plan="pro" className="w-full">
                Upgrade to Pro - $5/month
              </StripeCheckout>
            </CardContent>
          </Card>

          {/* Premium Plan */}
          <Card className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Crown className="h-5 w-5 text-purple-500" />
                  Premium
                </CardTitle>
              </div>
              <CardDescription>For power users and teams</CardDescription>
              <div className="text-3xl font-bold">
                $10<span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Unlimited AI messages</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Unlimited analytics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>API access</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Team collaboration</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>White-label options</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>24/7 phone support</span>
                </li>
              </ul>
              <StripeCheckout plan="premium" className="w-full" variant="outline">
                Upgrade to Premium - $10/month
              </StripeCheckout>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <h3 className="text-xl font-semibold mb-4">Frequently Asked Questions</h3>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left">
            <div>
              <h4 className="font-medium mb-2">What happens when I reach my limit?</h4>
              <p className="text-sm text-muted-foreground">
                You'll receive a notification when you're close to your limit. Once reached, you can upgrade your plan
                or wait for the next billing cycle.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Can I change plans anytime?</h4>
              <p className="text-sm text-muted-foreground">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Is there a free trial?</h4>
              <p className="text-sm text-muted-foreground">
                Yes! All paid plans come with a 7-day free trial. No credit card required.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">What payment methods do you accept?</h4>
              <p className="text-sm text-muted-foreground">
                We accept all major credit cards, PayPal, and bank transfers for annual plans.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
