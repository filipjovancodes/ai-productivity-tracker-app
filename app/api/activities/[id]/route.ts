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
  console.log("🔥🔥🔥 PUT /api/activities/[id] endpoint called 🔥🔥🔥")
  console.log("Request method:", req.method)
  console.log("Request URL:", req.url)
  
  try {
    const { id: activityId } = await params
    console.log("✅ Activity ID from params:", activityId)
    
    const body = await req.json()
    console.log("✅ Request body received:", JSON.stringify(body, null, 2))
    
    if (!activityId) {
      console.error("❌ Activity ID is missing")
      return NextResponse.json({ error: "Activity ID is required" }, { status: 400 })
    }

    const { activity_name, started_at, ended_at, duration_minutes } = body
    console.log("📝 Update fields:", { activity_name, started_at, ended_at, duration_minutes })

    console.log("🔄 Calling updateActivity function...")
    const result = await updateActivity(activityId, {
      activity_name,
      started_at,
      ended_at,
      duration_minutes
    })
    console.log("✅ updateActivity result:", JSON.stringify(result, null, 2))

    if (!result.success) {
      console.error("❌ Update failed:", result.error)
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    console.log("✅ Activity updated successfully!")
    return NextResponse.json({ 
      success: true, 
      message: "Activity updated successfully",
      activityId: result.activityId
    })
  } catch (error) {
    console.error("❌ Error updating activity:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace')
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
