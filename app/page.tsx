import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentActivity, getActivityStats, getTopActivities, getRecentActivities } from "@/lib/activity-service"
import { getRecentMessages } from "@/lib/message-service"
import { HomeClient } from "@/components/home-client"
import Image from "next/image"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Track your time with AI-powered automation. View your activity dashboard, analytics, and manage your time tracking sessions.",
  openGraph: {
    title: "AI Time Tracker Dashboard",
    description:
      "Track your time with AI-powered automation. View your activity dashboard, analytics, and manage your time tracking sessions.",
  },
}

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const [currentActivity, stats, topActivities, recentActivities, recentMessages] = await Promise.all([
    getCurrentActivity(),
    getActivityStats(7),
    getTopActivities(5),
    getRecentActivities(20),
    getRecentMessages(20),
  ])

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aitimetracker.com"

  // Main application structured data
  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "AI Time Tracker",
    description:
      "Track your time effortlessly with AI-powered time tracking. Automate activity logging, get detailed analytics, and boost your productivity.",
    url: baseUrl,
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "150",
    },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "0",
      highPrice: "10",
      offerCount: "3",
    },
    featureList: [
      "AI-powered time tracking using natural language",
      "Automated activity logging from text descriptions",
      "Detailed analytics and time breakdown",
      "Real-time activity tracking",
      "Past activity logging with confirmation",
      "Activity editing and deletion",
      "Export capabilities",
      "Multiple subscription tiers",
    ],
    screenshot: `${baseUrl}/logo.png`,
    softwareVersion: "1.0",
    datePublished: "2024-01-01",
    dateModified: new Date().toISOString().split("T")[0],
  }

  // FAQ Schema for AI understanding
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is AI Time Tracker?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AI Time Tracker is a web application that uses artificial intelligence to help users track their time automatically. Users can describe activities in natural language, and the AI automatically logs time entries. It supports real-time tracking, past activity logging, analytics, and activity management.",
        },
      },
      {
        "@type": "Question",
        name: "How does AI Time Tracker work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AI Time Tracker uses AI (Claude via AWS Bedrock) to parse natural language commands. Users can say things like 'Start tracking Work' or 'Log 9am to 5pm for Work from Monday to Friday' and the system automatically creates time entries. The AI understands time ranges, activity names, and can edit or delete past entries.",
        },
      },
      {
        "@type": "Question",
        name: "What are the subscription plans?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AI Time Tracker offers three plans: Free plan ($0/month) with 30 AI messages per month and 7-day analytics, Pro plan ($5/month) with 1,000 AI messages per month and unlimited analytics, and Premium plan ($10/month) with unlimited AI messages and analytics plus advanced features.",
        },
      },
      {
        "@type": "Question",
        name: "Can I track past activities?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, you can log past activities by describing them in natural language. For example, you can say 'From October 20-24, I worked from 9am to 5pm' and the AI will create entries for those dates. The system will show you a confirmation before logging to ensure accuracy.",
        },
      },
      {
        "@type": "Question",
        name: "Does AI Time Tracker support time zones?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, AI Time Tracker automatically detects your timezone and converts all times appropriately. When you specify times like '9am to 5pm', the system interprets this in your local timezone and stores it correctly in the database as UTC.",
        },
      },
      {
        "@type": "Question",
        name: "What analytics features are available?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AI Time Tracker provides detailed analytics including time breakdown by activity, total time spent, daily/weekly/monthly summaries, and productivity insights. Free users get 7-day analytics, while Pro and Premium users get unlimited analytics.",
        },
      },
    ],
  }

  // HowTo Schema for key features
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to track time with AI Time Tracker",
    description: "Step-by-step guide for using AI Time Tracker to log activities",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Start an activity",
        text: "Use natural language to start tracking. Examples: 'Start tracking Work' or 'Begin coding session'",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Stop an activity",
        text: "Say 'Stop' or 'Stop current activity' to end the current tracking session",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Log past activities",
        text: "Describe past activities with time ranges. Example: 'From Monday to Friday, I worked from 9am to 5pm'",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "View analytics",
        text: "Check the Analytics tab to see time breakdown, activity summaries, and productivity insights",
      },
    ],
  }

  const structuredData = [webAppSchema, faqSchema, howToSchema]

  return (
    <div className="min-h-screen bg-background">
      {structuredData.map((schema, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <header className="border-b sticky top-0 z-40 bg-background">
        <div className="px-4 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <a href="/" className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity">
              <div className="relative h-8 w-8 flex-shrink-0 sm:h-9 sm:w-9">
                <Image src="/logo.png" alt="AI Time Tracker" fill className="object-contain" priority />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-semibold">AI Time Tracker</h1>
              </div>
            </a>
            <div className="flex items-center gap-3 flex-shrink-0">
              <a href="/subscription" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Upgrade
              </a>
              <form action="/auth/signout" method="post">
                <button type="submit" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-3 pb-20 sm:px-6 sm:py-4">
        <HomeClient
          currentActivity={currentActivity}
          stats={stats}
          topActivities={topActivities}
          recentActivities={recentActivities}
          recentMessages={recentMessages}
        />
      </main>
    </div>
  )
}
