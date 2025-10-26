import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createFreeSubscription } from '@/lib/subscription-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Creating free subscription for user:', user.id)

    const result = await createFreeSubscription(user.id)

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to create subscription' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Free subscription created successfully' 
    })
  } catch (error) {
    console.error('Error creating free subscription:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
