import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    console.log('🔔 Stripe webhook received')
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!

    console.log('Webhook signature:', signature ? 'Present' : 'Missing')
    console.log('Webhook secret configured:', webhookSecret ? 'Yes' : 'No')

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      console.log('✅ Webhook signature verified')
      console.log('Event type:', event.type)
      console.log('Event ID:', event.id)
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const supabase = await createClient()

    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('🎯 Processing checkout.session.completed event')
        const session = event.data.object as Stripe.Checkout.Session
        
        console.log('Session mode:', session.mode)
        console.log('Session metadata:', session.metadata)
        console.log('Session customer:', session.customer)
        console.log('Session subscription:', session.subscription)
        
        if (session.mode === 'subscription') {
          console.log('📋 Retrieving subscription details...')
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          
          console.log('Subscription details:', {
            id: subscription.id,
            status: subscription.status,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end
          })
          
          console.log('💾 Updating database with subscription...')
          console.log('User ID:', session.metadata?.user_id)
          console.log('Plan type:', session.metadata?.plan)
          
          // Update user subscription in database using RPC function
          const { data, error } = await supabase.rpc('create_subscription_from_webhook', {
            p_user_id: session.metadata?.user_id,
            p_plan_type: session.metadata?.plan,
            p_status: 'active',
            p_stripe_customer_id: session.customer as string,
            p_stripe_subscription_id: subscription.id,
            p_current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : new Date().toISOString(),
            p_current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })

          if (error) {
            console.error('❌ Error updating subscription:', error)
            return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
          }
          
          console.log('✅ Subscription updated successfully:', data)
        } else {
          console.log('⚠️ Session mode is not subscription, skipping')
        }
        break
      }

      case 'customer.subscription.created': {
        console.log('🎯 Processing customer.subscription.created event')
        const subscription = event.data.object as Stripe.Subscription
        
        console.log('New subscription details:', {
          id: subscription.id,
          status: subscription.status,
          customer: subscription.customer,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end
        })
        
        // Get customer details to find user_id
        try {
          const customer = await stripe.customers.retrieve(subscription.customer as string)
          console.log('Customer details:', {
            id: customer.id,
            email: customer.email,
            metadata: customer.metadata
          })
          
          if (customer.metadata?.user_id) {
            console.log('💾 Creating new subscription from customer metadata...')
            
            // Use the RLS-bypassing function
            const { data, error } = await supabase.rpc('create_subscription_from_webhook', {
              p_user_id: customer.metadata.user_id,
              p_plan_type: customer.metadata.plan || 'pro',
              p_status: subscription.status === 'active' ? 'active' : 'inactive',
              p_stripe_customer_id: subscription.customer as string,
              p_stripe_subscription_id: subscription.id,
              p_current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : new Date().toISOString(),
              p_current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            
            if (error) {
              console.error('❌ Error creating subscription:', error)
            } else {
              console.log('✅ Subscription created successfully:', data)
            }
          } else {
            console.log('⚠️ No user_id found in customer metadata')
          }
        } catch (customerError) {
          console.error('❌ Error retrieving customer:', customerError)
        }
        break
      }

      case 'customer.subscription.updated': {
        console.log('🎯 Processing customer.subscription.updated event')
        const subscription = event.data.object as Stripe.Subscription
        
        console.log('Subscription details:', {
          id: subscription.id,
          status: subscription.status,
          customer: subscription.customer,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end
        })
        
        // Try to find existing subscription by stripe_subscription_id
        const { data: existingSub, error: findError } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('stripe_subscription_id', subscription.id)
          .single()
        
        if (findError && findError.code !== 'PGRST116') {
          console.error('Error finding existing subscription:', findError)
        }
        
        if (existingSub) {
          console.log('📝 Updating existing subscription...')
          // Update subscription status
          const { data, error } = await supabase
            .from('user_subscriptions')
            .update({
              status: subscription.status === 'active' ? 'active' : 'inactive',
              current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : new Date().toISOString(),
              current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq('stripe_subscription_id', subscription.id)
            .select()

          if (error) {
            console.error('❌ Error updating subscription status:', error)
          } else {
            console.log('✅ Subscription updated successfully:', data)
          }
        } else {
          console.log('⚠️ No existing subscription found for subscription ID:', subscription.id)
          console.log('This might be a new subscription that needs to be created')
          
          // Try to get customer details to find user_id
          try {
            const customer = await stripe.customers.retrieve(subscription.customer as string)
            console.log('Customer details:', {
              id: customer.id,
              email: customer.email,
              metadata: customer.metadata
            })
            
            // If we have user_id in customer metadata, create subscription
            if (customer.metadata?.user_id) {
              console.log('💾 Creating new subscription from customer metadata...')
              const { data, error } = await supabase
                .from('user_subscriptions')
                .upsert({
                  user_id: customer.metadata.user_id,
                  plan_type: 'pro', // Default to pro, could be determined from subscription items
                  status: subscription.status === 'active' ? 'active' : 'inactive',
                  stripe_customer_id: subscription.customer as string,
                  stripe_subscription_id: subscription.id,
                  current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                  current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                })
                .select()
              
              if (error) {
                console.error('❌ Error creating subscription from customer metadata:', error)
              } else {
                console.log('✅ Subscription created from customer metadata:', data)
              }
            }
          } catch (customerError) {
            console.error('❌ Error retrieving customer:', customerError)
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Mark subscription as cancelled
        const { error } = await supabase
          .from('user_subscriptions')
          .update({
            status: 'cancelled',
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('Error cancelling subscription:', error)
        }
        break
      }

      case 'invoice_payment.paid': {
        console.log('🎯 Processing invoice_payment.paid event')
        const invoice = event.data.object as Stripe.Invoice
        
        console.log('Invoice details:', {
          id: invoice.id,
          customer: invoice.customer,
          subscription: invoice.subscription,
          status: invoice.status
        })
        
        // This event indicates a successful payment, but the subscription should already be created
        // by customer.subscription.created. We'll just log it for now.
        console.log('✅ Payment successful for invoice:', invoice.id)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
