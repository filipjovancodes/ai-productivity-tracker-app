import { NextRequest, NextResponse } from "next/server"
import { getActivityDetails, updateActivity, deleteActivity } from "@/lib/activity-edit-service"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params
    
    if (!activityId) {
      return NextResponse.json({ error: "Activity ID is required" }, { status: 400 })
    }

    const activity = await getActivityDetails(activityId)
    
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, activity })
  } catch (error) {
    console.error("Error fetching activity:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params
    const body = await req.json()
    
    if (!activityId) {
      return NextResponse.json({ error: "Activity ID is required" }, { status: 400 })
    }

    const { activity_name, started_at, ended_at, duration_minutes } = body

    const result = await updateActivity(activityId, {
      activity_name,
      started_at,
      ended_at,
      duration_minutes
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: "Activity updated successfully",
      activityId: result.activityId
    })
  } catch (error) {
    console.error("Error updating activity:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params
    
    if (!activityId) {
      return NextResponse.json({ error: "Activity ID is required" }, { status: 400 })
    }

    const result = await deleteActivity(activityId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: "Activity deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting activity:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
