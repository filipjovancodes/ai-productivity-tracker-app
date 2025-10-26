import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan } = await request.json()

    if (!plan || !['pro', 'premium'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    console.log('🧪 Testing webhook logic manually...')
    console.log('User ID:', user.id)
    console.log('Plan:', plan)

    // Simulate the webhook logic
    const { data, error } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        plan_type: plan,
        status: 'active',
        stripe_customer_id: 'test_customer_' + Date.now(),
        stripe_subscription_id: 'test_subscription_' + Date.now(),
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      })
      .select()

    if (error) {
      console.error('❌ Error creating test subscription:', error)
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
    }

    console.log('✅ Test subscription created successfully:', data)
    return NextResponse.json({ 
      success: true, 
      message: `${plan} subscription created for testing`,
      data: data
    })
  } catch (error) {
    console.error('Test webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
