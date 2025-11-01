import { NextRequest, NextResponse } from "next/server"
import { getRecentActivities, insertActivity } from "@/lib/activity-edit-service"
import { getCurrentActivity, getActivityStats } from "@/lib/activity-service"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  console.log("🔥🔥🔥 POST /api/activities endpoint called 🔥🔥🔥")
  console.log("Request method:", req.method)
  console.log("Request URL:", req.url)
  
  try {
    // Check authentication
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error("❌ Unauthorized - no user found")
      return NextResponse.json({ 
        error: "Unauthorized",
        success: false 
      }, { status: 401 })
    }

    const body = await req.json()
    console.log("✅ Request body received:", JSON.stringify(body, null, 2))

    const { activity_name, started_at, ended_at, duration_minutes } = body

    if (!activity_name) {
      console.error("❌ Missing activity_name")
      return NextResponse.json({ 
        error: "Activity name is required",
        success: false 
      }, { status: 400 })
    }

    console.log("🔄 Calling insertActivity function...")
    const result = await insertActivity({
      user_id: user.id,
      activity_name,
      started_at,
      ended_at,
      duration_minutes
    })
    console.log("✅ insertActivity result:", JSON.stringify(result, null, 2))

    if (!result.success) {
      console.error("❌ Insert failed:", result.error)
      return NextResponse.json({ 
        error: result.error,
        success: false 
      }, { status: 400 })
    }

    console.log("✅ Activity created successfully!")
    return NextResponse.json({ 
      success: true, 
      message: "Activity created successfully",
      activityId: result.activityId
    })
  } catch (error) {
    console.error("❌ Error creating activity:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ 
        error: "Unauthorized",
        success: false 
      }, { status: 401 })
    }
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const current = searchParams.get('current') === 'true'
    const stats = searchParams.get('stats') === 'true'
    
    if (current) {
      // Return current activity
      const currentActivity = await getCurrentActivity()
      return NextResponse.json({ 
        success: true, 
        activity: currentActivity
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    } else if (stats) {
      // Return activity stats
      const statsData = await getActivityStats(7)
      return NextResponse.json({ 
        success: true, 
        stats: statsData
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    } else {
      // Return recent activities
      const activities = await getRecentActivities(limit)
      
      return NextResponse.json({ 
        success: true, 
        activities,
        count: activities.length
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }
  } catch (error) {
    console.error("Error fetching activities:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
