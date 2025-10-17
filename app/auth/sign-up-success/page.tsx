import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity } from "lucide-react"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold">Productivity Tracker</h1>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Thank you for signing up!</CardTitle>
              <CardDescription>Check your email to confirm</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You've successfully signed up. Please check your email to confirm your account before signing in.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
