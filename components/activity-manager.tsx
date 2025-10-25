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

export function ActivityManager({ onActivityChange, initialActivities, refreshTrigger }: ActivityManagerProps) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities || [])
  const [loading, setLoading] = useState(!initialActivities)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
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
      started_at: activity.started_at.slice(0, 16),
      ended_at: activity.ended_at ? activity.ended_at.slice(0, 16) : "",
      duration_minutes: activity.duration_minutes?.toString() || "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingActivity) return

    try {
      const updates: any = {}

      if (editForm.activity_name !== editingActivity.activity_name) {
        updates.activity_name = editForm.activity_name
      }

      if (editForm.started_at !== editingActivity.started_at.slice(0, 16)) {
        updates.started_at = new Date(editForm.started_at).toISOString()
      }

      if (editForm.ended_at !== (editingActivity.ended_at?.slice(0, 16) || "")) {
        updates.ended_at = editForm.ended_at ? new Date(editForm.ended_at).toISOString() : null
      }

      if (editForm.duration_minutes !== (editingActivity.duration_minutes?.toString() || "")) {
        updates.duration_minutes = editForm.duration_minutes ? Number.parseInt(editForm.duration_minutes) : null
      }

      if (Object.keys(updates).length === 0) {
        setEditingActivity(null)
        return
      }

      const response = await fetch(`/api/activities/${editingActivity.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      if (data.success) {
        await loadActivities()
        onActivityChange?.()
        setEditingActivity(null)
      } else {
        alert("Error updating activity: " + data.error)
      }
    } catch (error) {
      console.error("Error updating activity:", error)
      alert("Error updating activity")
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
      started_at: oneHourAgo.toISOString().slice(0, 16),
      ended_at: now.toISOString().slice(0, 16),
      duration_minutes: "60",
    })
  }

  const handleSaveCreate = async () => {
    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_name: editForm.activity_name,
          started_at: new Date(editForm.started_at).toISOString(),
          ended_at: editForm.ended_at ? new Date(editForm.ended_at).toISOString() : null,
          duration_minutes: editForm.duration_minutes ? Number.parseInt(editForm.duration_minutes) : null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        await loadActivities()
        onActivityChange?.()
        setIsCreating(false)
      } else {
        alert("Error creating activity: " + data.error)
      }
    } catch (error) {
      console.error("Error creating activity:", error)
      alert("Error creating activity")
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
                    <Dialog>
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
                          <Button variant="outline" onClick={() => setEditingActivity(null)}>
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
