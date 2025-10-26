import { createClient } from '@/lib/supabase/server'

export async function createFreeSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    console.log('Creating free subscription for user:', userId)
    
    const { error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_type: 'free',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
      })

    if (error) {
      console.error('Error creating free subscription:', error)
      return { success: false, error: error.message }
    }

    console.log('Free subscription created successfully')
    return { success: true }
  } catch (error) {
    console.error('Error in createFreeSubscription:', error)
    return { success: false, error: 'Failed to create subscription' }
  }
}

export async function getUserSubscription(userId: string) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching subscription:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in getUserSubscription:', error)
    return null
  }
}
