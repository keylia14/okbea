
/**
 * Stripe Configuration
 * 
 * This file handles all Stripe-related operations including:
 * - Payment processing
 * - Affiliate payouts
 * - Webhook handling
 * 
 * Required Environment Variables:
 * - STRIPE_PUBLISHABLE_KEY: Your Stripe publishable key (starts with pk_)
 * - STRIPE_SECRET_KEY: Your Stripe secret key (starts with sk_)
 * - STRIPE_WEBHOOK_SECRET: Your webhook signing secret (starts with whsec_)
 */

import Stripe from 'stripe'

// Lazy-initialize Stripe only when needed
let stripeInstance: Stripe | null = null

function getStripeInstance(): Stripe {
  if (!stripeInstance) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || ''
    
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set in .env file')
    }
    
    stripeInstance = new Stripe(stripeSecretKey, {
      apiVersion: '2025-09-30.clover',
      typescript: true,
    })
  }
  
  return stripeInstance
}

// Export the publishable key for client-side use
export const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || ''

/**
 * Create a payout to an affiliate
 * @param amount - Amount in dollars (e.g., 100.50)
 * @param email - Affiliate's email address
 * @param description - Description of the payout
 */
export async function createAffiliatePayout(
  amount: number,
  email: string,
  description: string
) {
  try {
    const stripe = getStripeInstance()
    
    // Convert dollars to cents for Stripe
    const amountInCents = Math.round(amount * 100)

    // Create a payment intent for the payout
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      description: description,
      metadata: {
        affiliate_email: email,
        payout_type: 'affiliate_commission'
      },
    })

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      amount: amount,
      status: paymentIntent.status
    }
  } catch (error: any) {
    console.error('Stripe payout error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Get payout history
 */
export async function getPayoutHistory(limit: number = 10) {
  try {
    const stripe = getStripeInstance()
    
    const payouts = await stripe.payouts.list({
      limit: limit,
    })

    return {
      success: true,
      payouts: payouts.data
    }
  } catch (error: any) {
    console.error('Stripe payout history error:', error)
    return {
      success: false,
      error: error.message,
      payouts: []
    }
  }
}

/**
 * Verify webhook signature
 * This ensures the webhook actually came from Stripe
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''
  
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return null
  }

  try {
    const stripe = getStripeInstance()
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message)
    return null
  }
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PUBLISHABLE_KEY
  )
}
