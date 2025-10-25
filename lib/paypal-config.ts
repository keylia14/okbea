
/**
 * PayPal Configuration
 * 
 * This file handles all PayPal-related operations including:
 * - Payment processing
 * - Affiliate payouts
 * - Order creation
 * 
 * Required Environment Variables:
 * - PAYPAL_CLIENT_ID: Your PayPal Client ID
 * - PAYPAL_CLIENT_SECRET: Your PayPal Client Secret
 * - PAYPAL_MODE: Either 'sandbox' or 'live'
 */

// PayPal API endpoints
const PAYPAL_API_SANDBOX = 'https://api-m.sandbox.paypal.com'
const PAYPAL_API_LIVE = 'https://api-m.paypal.com'

/**
 * Get the correct PayPal API URL based on mode
 */
function getPayPalAPI(): string {
  const mode = process.env.PAYPAL_MODE || 'sandbox'
  return mode === 'live' ? PAYPAL_API_LIVE : PAYPAL_API_SANDBOX
}

/**
 * Get PayPal access token
 * This is required for all API calls
 */
export async function getPayPalAccessToken(): Promise<string | null> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('⚠️ PayPal credentials not set in .env file')
    return null
  }

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
    const response = await fetch(`${getPayPalAPI()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    const data = await response.json()
    
    if (!response.ok) {
      console.error('PayPal auth error:', data)
      return null
    }

    return data.access_token
  } catch (error: any) {
    console.error('PayPal access token error:', error)
    return null
  }
}

/**
 * Create a payout to an affiliate
 * @param amount - Amount in dollars (e.g., 100.50)
 * @param email - Affiliate's PayPal email address
 * @param note - Description of the payout
 */
export async function createPayPalPayout(
  amount: number,
  email: string,
  note: string
) {
  const accessToken = await getPayPalAccessToken()
  
  if (!accessToken) {
    return {
      success: false,
      error: 'Failed to authenticate with PayPal'
    }
  }

  try {
    const payoutData = {
      sender_batch_header: {
        sender_batch_id: `batch_${Date.now()}`,
        email_subject: 'You have a payout from Okbea AI',
        email_message: note
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: amount.toFixed(2),
            currency: 'USD'
          },
          receiver: email,
          note: note,
          sender_item_id: `item_${Date.now()}`
        }
      ]
    }

    const response = await fetch(`${getPayPalAPI()}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payoutData),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('PayPal payout error:', data)
      return {
        success: false,
        error: data.message || 'Failed to create payout'
      }
    }

    return {
      success: true,
      batchId: data.batch_header.payout_batch_id,
      status: data.batch_header.batch_status,
      amount: amount
    }
  } catch (error: any) {
    console.error('PayPal payout error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Get payout details
 * @param batchId - The batch ID from createPayPalPayout
 */
export async function getPayPalPayoutStatus(batchId: string) {
  const accessToken = await getPayPalAccessToken()
  
  if (!accessToken) {
    return {
      success: false,
      error: 'Failed to authenticate with PayPal'
    }
  }

  try {
    const response = await fetch(
      `${getPayPalAPI()}/v1/payments/payouts/${batchId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Failed to get payout status'
      }
    }

    return {
      success: true,
      status: data.batch_header.batch_status,
      items: data.items
    }
  } catch (error: any) {
    console.error('PayPal payout status error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Check if PayPal is configured
 */
export function isPayPalConfigured(): boolean {
  return !!(
    process.env.PAYPAL_CLIENT_ID &&
    process.env.PAYPAL_CLIENT_SECRET
  )
}
