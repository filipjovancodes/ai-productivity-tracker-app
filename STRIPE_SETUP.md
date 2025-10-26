# Stripe Integration Setup Guide

## 1. Install Stripe Dependencies

```bash
npm install stripe
```

## 2. Environment Variables

Add these to your `.env.local` file:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Price IDs (create these in your Stripe dashboard)
STRIPE_PRO_PRICE_ID=price_your_pro_price_id
STRIPE_PREMIUM_PRICE_ID=price_your_premium_price_id

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 3. Create Stripe Products and Prices

1. Go to your Stripe Dashboard
2. Navigate to Products
3. Create two products:

### Pro Plan ($5/month)
- Name: "Pro Plan"
- Price: $5.00
- Billing: Monthly
- Copy the Price ID to `STRIPE_PRO_PRICE_ID`

### Premium Plan ($10/month)
- Name: "Premium Plan" 
- Price: $10.00
- Billing: Monthly
- Copy the Price ID to `STRIPE_PREMIUM_PRICE_ID`

## 4. Set Up Webhook

1. Go to Stripe Dashboard > Webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook secret to `STRIPE_WEBHOOK_SECRET`

## 5. Test the Integration

1. Start your development server
2. Go to `/subscription`
3. Click "Upgrade to Pro" or "Upgrade to Premium"
4. Complete the Stripe checkout with test card: `4242 4242 4242 4242`
5. Verify the subscription is created in your database

## 6. Production Setup

1. Replace test keys with live keys
2. Update webhook URL to production domain
3. Test with real payment methods
4. Monitor webhook events in Stripe Dashboard
