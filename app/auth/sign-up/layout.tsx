import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Sign up for AI Time Tracker and start tracking your time with AI-powered automation. Free plan includes 30 AI messages per month.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

