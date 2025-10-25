import { NextRequest, NextResponse } from "next/server"
import { getRecentActivities } from "@/lib/activity-edit-service"
import { getCurrentActivity, getActivityStats } from "@/lib/activity-service"
import { createClient } from "@/lib/supabase/server"

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
