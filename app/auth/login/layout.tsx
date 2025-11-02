import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Login",
  description: "Login to AI Time Tracker to start tracking your time with AI-powered automation.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
