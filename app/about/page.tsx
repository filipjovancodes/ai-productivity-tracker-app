import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "About AI Time Tracker",
  description: "Learn about AI Time Tracker - an AI-powered time tracking application that uses natural language processing to automatically log your activities and track your time.",
  openGraph: {
    title: "About AI Time Tracker",
    description: "Learn about AI Time Tracker - an AI-powered time tracking application that uses natural language processing to automatically log your activities and track your time.",
  },
}

export default function AboutPage() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aitimetracker.com'
  
  const aboutStructuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "mainEntity": {
      "@type": "SoftwareApplication",
      "name": "AI Time Tracker",
      "description": "AI Time Tracker is a web-based productivity application that uses artificial intelligence (Claude via AWS Bedrock) to help users track their time automatically through natural language commands.",
      "applicationCategory": "ProductivityApplication",
      "operatingSystem": "Web",
      "featureList": [
        "Natural language time tracking",
        "Automatic activity logging",
        "Real-time activity tracking",
        "Past activity logging with date ranges",
        "Activity editing and deletion",
        "Detailed analytics and time breakdown",
        "Multi-timezone support",
        "Export capabilities",
        "Multiple subscription tiers"
      ],
      "technology": "AWS Bedrock, Claude AI, Next.js, Supabase, PostgreSQL",
      "publisher": {
        "@type": "Organization",
        "name": "AI Time Tracker"
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutStructuredData) }}
      />
      
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-20 w-20">
                <Image
                  src="/logo.png"
                  alt="AI Time Tracker Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold">AI Time Tracker</h1>
                <p className="text-sm text-muted-foreground">AI-powered time tracking</p>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/auth/login">
                <Button variant="outline">Login</Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button>Sign Up</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold">About AI Time Tracker</h2>
            <p className="text-xl text-muted-foreground">
              Track your time effortlessly with AI-powered automation
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>What is AI Time Tracker?</CardTitle>
              <CardDescription>
                A modern productivity application powered by artificial intelligence
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                AI Time Tracker is a web-based application that uses artificial intelligence to help you track your time automatically. 
                Instead of manually entering time entries, you can simply describe what you did in natural language, and the AI will 
                automatically create time entries for you.
              </p>
              <p className="text-muted-foreground">
                The application uses Claude AI (via AWS Bedrock) to understand natural language commands. You can say things like 
                &quot;Start tracking Work&quot; to begin a session, or &quot;From Monday to Friday, I worked from 9am to 5pm&quot; to log past activities. 
                The AI understands time ranges, activity names, dates, and can even edit or delete past entries based on your instructions.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                <li><strong>Natural Language Processing:</strong> Describe activities in plain English</li>
                <li><strong>Real-time Tracking:</strong> Start and stop activities with voice or text commands</li>
                <li><strong>Past Activity Logging:</strong> Log activities from previous days or weeks with simple descriptions</li>
                <li><strong>Automatic Timezone Handling:</strong> All times are automatically converted based on your location</li>
                <li><strong>Detailed Analytics:</strong> View time breakdowns, activity summaries, and productivity insights</li>
                <li><strong>Activity Management:</strong> Edit or delete past entries easily</li>
                <li><strong>Multiple Subscription Tiers:</strong> Free, Pro, and Premium plans to suit different needs</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">1. Natural Language Input</h3>
                <p className="text-muted-foreground">
                  You describe your activities in natural language. For example: &quot;Start tracking coding&quot; or 
                  &quot;Log work from 9am to 5pm on Monday&quot;
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2. AI Processing</h3>
                <p className="text-muted-foreground">
                  The AI (Claude via AWS Bedrock) parses your input, extracts activity names, times, and dates, 
                  and structures the data appropriately.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">3. Automatic Logging</h3>
                <p className="text-muted-foreground">
                  The system automatically creates time entries in your database with proper timezone conversion. 
                  For past activities, you get a confirmation before logging.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">4. Analytics & Insights</h3>
                <p className="text-muted-foreground">
                  View detailed analytics, time breakdowns, and productivity insights based on your tracked activities.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technology Stack</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li><strong>Frontend:</strong> Next.js 15, React 19, TypeScript, Tailwind CSS</li>
                <li><strong>AI:</strong> AWS Bedrock (Claude 3 Haiku)</li>
                <li><strong>Backend:</strong> Next.js API Routes, Supabase</li>
                <li><strong>Database:</strong> PostgreSQL (via Supabase)</li>
                <li><strong>Authentication:</strong> Supabase Auth</li>
                <li><strong>Payments:</strong> Stripe</li>
                <li><strong>Hosting:</strong> Vercel</li>
              </ul>
            </CardContent>
          </Card>

          <div className="flex gap-4 justify-center">
            <Link href="/auth/sign-up">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link href="/subscription">
              <Button size="lg" variant="outline">View Plans</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
