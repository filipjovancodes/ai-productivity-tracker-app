import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

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

    // Define pricing
    const prices = {
      pro: process.env.STRIPE_PRO_PRICE_ID,
      premium: process.env.STRIPE_PREMIUM_PRICE_ID
    }

    const priceId = prices[plan as keyof typeof prices]

    if (!priceId) {
      console.error(`Missing price ID for plan: ${plan}`)
      return NextResponse.json({ 
        error: `Price ID not configured for ${plan} plan. Please set STRIPE_${plan.toUpperCase()}_PRICE_ID in your environment variables.` 
      }, { status: 500 })
    }

    // Create Stripe checkout session
    try {
      console.log('🛒 Creating Stripe checkout session...')
      console.log('User ID:', user.id)
      console.log('Plan:', plan)
      console.log('Price ID:', priceId)
      
      // Create or retrieve customer with user_id in metadata
      let customerId: string
      try {
        // Try to find existing customer by email
        const existingCustomers = await stripe.customers.list({
          email: user.email,
          limit: 1
        })
        
        if (existingCustomers.data.length > 0) {
          customerId = existingCustomers.data[0].id
          console.log('Using existing customer:', customerId)
          
          // Update customer metadata with user_id
          await stripe.customers.update(customerId, {
            metadata: {
              user_id: user.id,
              plan: plan
            }
          })
        } else {
          // Create new customer with user_id in metadata
          const customer = await stripe.customers.create({
            email: user.email,
            metadata: {
              user_id: user.id,
              plan: plan
            }
          })
          customerId = customer.id
          console.log('Created new customer:', customerId)
        }
      } catch (customerError) {
        console.error('Error handling customer:', customerError)
        // Fallback to using email only
        customerId = user.email!
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription`,
        metadata: {
          user_id: user.id,
          plan: plan,
        },
      })
      
      console.log('✅ Checkout session created:', session.id)
      console.log('Session URL:', session.url)

      return NextResponse.json({ sessionId: session.id, url: session.url })
    } catch (stripeError: any) {
      console.error('Stripe API error:', stripeError)
      
      if (stripeError.code === 'resource_missing') {
        return NextResponse.json({ 
          error: `Price ID '${priceId}' not found in Stripe. Please create the product and price in your Stripe dashboard and update your environment variables.` 
        }, { status: 400 })
      }
      
      return NextResponse.json({ 
        error: `Stripe error: ${stripeError.message}` 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
