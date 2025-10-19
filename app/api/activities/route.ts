import { NextRequest, NextResponse } from "next/server"
import { getRecentActivities } from "@/lib/activity-edit-service"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    
    const activities = await getRecentActivities(limit)
    
    return NextResponse.json({ 
      success: true, 
      activities,
      count: activities.length
    })
  } catch (error) {
    console.error("Error fetching activities:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
