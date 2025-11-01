"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2, Calendar, Clock, ActivityIcon, Plus } from "lucide-react"
import { format } from "date-fns"
import type { Activity } from "@/lib/types"

interface ActivityManagerProps {
  onActivityChange?: () => void
  initialActivities?: Activity[]
  refreshTrigger?: number
}

// Convert UTC timestamp to datetime-local format (YYYY-MM-DDTHH:mm)
function convertUTCToDateTimeLocal(utcTimestamp: string): string {
  const date = new Date(utcTimestamp)
  // Get the local time string in YYYY-MM-DDTHH:mm format
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Convert datetime-local format to UTC ISO string
function convertDateTimeLocalToUTC(dateTimeLocal: string): string {
  // Create a date object from the local datetime string
  // This assumes the input is in the user's local timezone
  const date = new Date(dateTimeLocal)
  return date.toISOString()
}

export function ActivityManager({ onActivityChange, initialActivities, refreshTrigger }: ActivityManagerProps) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities || [])
  const [loading, setLoading] = useState(!initialActivities)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editForm, setEditForm] = useState({
    activity_name: "",
    started_at: "",
    ended_at: "",
    duration_minutes: "",
  })

  useEffect(() => {
    // Only load if we don't have initial activities
    if (!initialActivities) {
      loadActivities()
    }
  }, [initialActivities])

  // Refresh activities when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadActivities()
    }
  }, [refreshTrigger])

  const loadActivities = async () => {
    try {
      const response = await fetch("/api/activities?limit=20")
      const data = await response.json()

      if (data.success) {
        setActivities(data.activities)
      }
    } catch (error) {
      console.error("Error loading activities:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (activity: Activity) => {
    setEditingActivity(activity)
    setEditForm({
      activity_name: activity.activity_name,
      started_at: convertUTCToDateTimeLocal(activity.started_at),
      ended_at: activity.ended_at ? convertUTCToDateTimeLocal(activity.ended_at) : "",
      duration_minutes: activity.duration_minutes?.toString() || "",
    })
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    console.log("🔥🔥🔥 handleSaveEdit called 🔥🔥🔥")
    console.log("Editing activity:", editingActivity)
    console.log("Edit form:", editForm)
    
    if (!editingActivity) {
      console.error("❌ No editing activity found")
      return
    }

    try {
      const updates: any = {}

      if (editForm.activity_name !== editingActivity.activity_name) {
        updates.activity_name = editForm.activity_name
        console.log("📝 Activity name changed:", editForm.activity_name)
      }

      const originalStartedLocal = convertUTCToDateTimeLocal(editingActivity.started_at)
      console.log("📅 Original started_at (local):", originalStartedLocal)
      console.log("📅 Form started_at:", editForm.started_at)
      if (editForm.started_at !== originalStartedLocal) {
        const utcStart = convertDateTimeLocalToUTC(editForm.started_at)
        updates.started_at = utcStart
        console.log("📝 Start time changed to UTC:", utcStart)
      }

      const originalEndedLocal = editingActivity.ended_at ? convertUTCToDateTimeLocal(editingActivity.ended_at) : ""
      console.log("📅 Original ended_at (local):", originalEndedLocal)
      console.log("📅 Form ended_at:", editForm.ended_at)
      if (editForm.ended_at !== originalEndedLocal) {
        const utcEnd = editForm.ended_at ? convertDateTimeLocalToUTC(editForm.ended_at) : null
        updates.ended_at = utcEnd
        console.log("📝 End time changed to UTC:", utcEnd)
      }

      if (editForm.duration_minutes !== (editingActivity.duration_minutes?.toString() || "")) {
        updates.duration_minutes = editForm.duration_minutes ? Number.parseInt(editForm.duration_minutes) : null
        console.log("📝 Duration changed:", updates.duration_minutes)
      }

      console.log("📦 Updates object:", updates)

      if (Object.keys(updates).length === 0) {
        console.log("⚠️ No updates to save")
        setIsEditDialogOpen(false)
        setEditingActivity(null)
        return
      }

      const url = `/api/activities/${editingActivity.id}`
      console.log("🌐 Making PUT request to:", url)
      console.log("📤 Request payload:", JSON.stringify(updates, null, 2))

      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      console.log("📥 Response status:", response.status)
      console.log("📥 Response statusText:", response.statusText)
      console.log("📥 Response headers:", Object.fromEntries(response.headers.entries()))

      // Read the response body once
      const responseText = await response.text()
      console.log("📥 Response text:", responseText)

      if (!response.ok) {
        let errorMessage = `Error ${response.status}: ${response.statusText}`
        try {
          if (responseText) {
            const errorData = JSON.parse(responseText)
            errorMessage = errorData.error || errorData.details || errorMessage
            console.error("❌ Response error data:", errorData)
          }
        } catch (e) {
          // Not JSON, use the text as is or the status message
          console.error("❌ Error parsing error response:", e)
          errorMessage = responseText || errorMessage
        }
        alert(`Error updating activity: ${errorMessage}`)
        return
      }

      let data
      try {
        data = responseText ? JSON.parse(responseText) : {}
      } catch (e) {
        console.error("❌ Error parsing response as JSON:", e)
        console.error("Response text that failed to parse:", responseText)
        alert("Error updating activity: Invalid response from server")
        return
      }
      
      console.log("✅ Response data:", data)

      if (data.success) {
        console.log("✅ Update successful, reloading activities...")
        await loadActivities()
        onActivityChange?.()
        setIsEditDialogOpen(false)
        setEditingActivity(null)
      } else {
        console.error("❌ Update failed:", data.error)
        alert("Error updating activity: " + data.error)
      }
    } catch (error) {
      console.error("❌ Error updating activity:", error)
      console.error("Error details:", error instanceof Error ? error.message : 'Unknown error')
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace')
      alert("Error updating activity: " + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleDelete = async (activityId: string) => {
    try {
      const response = await fetch(`/api/activities/${activityId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        await loadActivities()
        onActivityChange?.()
      } else {
        alert("Error deleting activity: " + data.error)
      }
    } catch (error) {
      console.error("Error deleting activity:", error)
      alert("Error deleting activity")
    }
  }

  const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return "N/A"
    if (minutes === 0) return "0m"
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy 'at' h:mm a")
  }

  const handleCreate = () => {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    setIsCreating(true)
    setEditForm({
      activity_name: "",
      started_at: convertUTCToDateTimeLocal(oneHourAgo.toISOString()),
      ended_at: convertUTCToDateTimeLocal(now.toISOString()),
      duration_minutes: "60",
    })
  }

  const handleSaveCreate = async () => {
    console.log("🔥🔥🔥 handleSaveCreate called 🔥🔥🔥")
    console.log("Create form:", editForm)
    
    try {
      const payload = {
        activity_name: editForm.activity_name,
        started_at: convertDateTimeLocalToUTC(editForm.started_at),
        ended_at: editForm.ended_at ? convertDateTimeLocalToUTC(editForm.ended_at) : null,
        duration_minutes: editForm.duration_minutes ? Number.parseInt(editForm.duration_minutes) : null,
      }
      console.log("📤 Request payload:", JSON.stringify(payload, null, 2))

      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      console.log("📥 Response status:", response.status)
      console.log("📥 Response statusText:", response.statusText)

      // Read the response body once
      const responseText = await response.text()
      console.log("📥 Response text:", responseText)

      if (!response.ok) {
        let errorMessage = `Error ${response.status}: ${response.statusText}`
        try {
          if (responseText) {
            const errorData = JSON.parse(responseText)
            errorMessage = errorData.error || errorData.details || errorMessage
            console.error("❌ Response error data:", errorData)
          }
        } catch (e) {
          console.error("❌ Error parsing error response:", e)
          errorMessage = responseText || errorMessage
        }
        alert(`Error creating activity: ${errorMessage}`)
        return
      }

      let data
      try {
        data = responseText ? JSON.parse(responseText) : {}
      } catch (e) {
        console.error("❌ Error parsing response as JSON:", e)
        console.error("Response text that failed to parse:", responseText)
        alert("Error creating activity: Invalid response from server")
        return
      }
      
      console.log("✅ Response data:", data)

      if (data.success) {
        console.log("✅ Create successful, reloading activities...")
        await loadActivities()
        onActivityChange?.()
        setIsCreating(false)
      } else {
        console.error("❌ Create failed:", data.error)
        alert("Error creating activity: " + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error("❌ Error creating activity:", error)
      console.error("Error details:", error instanceof Error ? error.message : 'Unknown error')
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace')
      alert("Error creating activity: " + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Manager</CardTitle>
          <CardDescription>Loading activities...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ActivityIcon className="h-5 w-5" />
              Activity Manager
            </CardTitle>
            <CardDescription>View, edit, and delete your activity sessions</CardDescription>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Activity
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Activity</DialogTitle>
                <DialogDescription>Manually add a new activity session.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new_activity_name">Activity Name</Label>
                  <Input
                    id="new_activity_name"
                    value={editForm.activity_name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, activity_name: e.target.value }))}
                    placeholder="e.g., Working, Meeting, Break"
                  />
                </div>
                <div>
                  <Label htmlFor="new_started_at">Start Time</Label>
                  <Input
                    id="new_started_at"
                    type="datetime-local"
                    value={editForm.started_at}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, started_at: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="new_ended_at">End Time</Label>
                  <Input
                    id="new_ended_at"
                    type="datetime-local"
                    value={editForm.ended_at}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, ended_at: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="new_duration_minutes">Duration (minutes)</Label>
                  <Input
                    id="new_duration_minutes"
                    type="number"
                    value={editForm.duration_minutes}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveCreate}>Create Activity</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No activities found. Start tracking to see your sessions here.
          </p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-medium">{activity.activity_name}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(activity.started_at)}
                      </div>
                      {activity.ended_at && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDuration(activity.duration_minutes)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={activity.ended_at ? "secondary" : "default"}>
                      {activity.ended_at ? "Completed" : "Active"}
                    </Badge>
                    <Dialog open={isEditDialogOpen && editingActivity?.id === activity.id} onOpenChange={(open) => {
                      setIsEditDialogOpen(open)
                      if (!open) {
                        setEditingActivity(null)
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(activity)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Activity</DialogTitle>
                          <DialogDescription>Update the details of this activity session.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="activity_name">Activity Name</Label>
                            <Input
                              id="activity_name"
                              value={editForm.activity_name}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, activity_name: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="started_at">Start Time</Label>
                            <Input
                              id="started_at"
                              type="datetime-local"
                              value={editForm.started_at}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, started_at: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="ended_at">End Time</Label>
                            <Input
                              id="ended_at"
                              type="datetime-local"
                              value={editForm.ended_at}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, ended_at: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                            <Input
                              id="duration_minutes"
                              type="number"
                              value={editForm.duration_minutes}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => {
                            setIsEditDialogOpen(false)
                            setEditingActivity(null)
                          }}>
                            Cancel
                          </Button>
                          <Button onClick={handleSaveEdit}>Save Changes</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Activity</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this activity? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(activity.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
