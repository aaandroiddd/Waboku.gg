import Stripe from 'stripe';
import { getFirebaseAdmin } from './firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

interface PaymentVerificationResult {
  isValid: boolean;
  error?: string;
  paymentIntent?: Stripe.PaymentIntent;
  session?: Stripe.Checkout.Session;
}

/**
 * Verify that a Stripe payment session is legitimate and matches expected parameters
 */
export async function verifyStripePayment(
  sessionId: string,
  expectedAmount: number,
  expectedUserId: string,
  expectedListingId?: string
): Promise<PaymentVerificationResult> {
  try {
    console.log('[payment-verification] Verifying Stripe payment:', {
      sessionId,
      expectedAmount,
      expectedUserId,
      expectedListingId
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session) {
      return {
        isValid: false,
        error: 'Payment session not found'
      };
    }

    // Verify session status
    if (session.payment_status !== 'paid') {
      return {
        isValid: false,
        error: `Payment not completed. Status: ${session.payment_status}`
      };
    }

    // Verify amount (convert to cents for comparison)
    const expectedAmountCents = Math.round(expectedAmount * 100);
    if (session.amount_total !== expectedAmountCents) {
      return {
        isValid: false,
        error: `Amount mismatch. Expected: ${expectedAmountCents}, Actual: ${session.amount_total}`
      };
    }

    // Verify user ID from metadata
    if (session.metadata?.userId !== expectedUserId && session.metadata?.buyerId !== expectedUserId) {
      return {
        isValid: false,
        error: 'User ID mismatch in payment metadata'
      };
    }

    // Verify listing ID if provided
    if (expectedListingId && session.metadata?.listingId !== expectedListingId) {
      return {
        isValid: false,
        error: 'Listing ID mismatch in payment metadata'
      };
    }

    // Get payment intent for additional verification
    let paymentIntent: Stripe.PaymentIntent | undefined;
    if (session.payment_intent) {
      paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
      
      // Verify payment intent status
      if (paymentIntent.status !== 'succeeded') {
        return {
          isValid: false,
          error: `Payment intent not succeeded. Status: ${paymentIntent.status}`
        };
      }
    }

    console.log('[payment-verification] Payment verification successful');
    return {
      isValid: true,
      session,
      paymentIntent
    };

  } catch (error) {
    console.error('[payment-verification] Error verifying payment:', error);
    return {
      isValid: false,
      error: `Payment verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Verify that an order hasn't already been processed for this payment
 */
export async function verifyOrderUniqueness(
  sessionId: string,
  paymentIntentId?: string
): Promise<{ isUnique: boolean; existingOrderId?: string }> {
  try {
    const db = getFirestore();
    
    // Check for existing orders with this session ID
    const sessionQuery = await db.collection('orders')
      .where('paymentSessionId', '==', sessionId)
      .limit(1)
      .get();
    
    if (!sessionQuery.empty) {
      return {
        isUnique: false,
        existingOrderId: sessionQuery.docs[0].id
      };
    }

    // Also check by payment intent ID if provided
    if (paymentIntentId) {
      const intentQuery = await db.collection('orders')
        .where('paymentIntentId', '==', paymentIntentId)
        .limit(1)
        .get();
      
      if (!intentQuery.empty) {
        return {
          isUnique: false,
          existingOrderId: intentQuery.docs[0].id
        };
      }
    }

    return { isUnique: true };

  } catch (error) {
    console.error('[payment-verification] Error checking order uniqueness:', error);
    // In case of error, assume not unique to prevent duplicate processing
    return { isUnique: false };
  }
}

/**
 * Verify webhook signature to ensure it's from Stripe
 */
export function verifyWebhookSignature(
  payload: Buffer,
  signature: string,
  secret: string
): { isValid: boolean; event?: Stripe.Event; error?: string } {
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, secret);
    return { isValid: true, event };
  } catch (error) {
    console.error('[payment-verification] Webhook signature verification failed:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Signature verification failed'
    };
  }
}

/**
 * Verify that a refund is legitimate and matches the original order
 */
export async function verifyRefundEligibility(
  orderId: string,
  requestedAmount: number,
  userId: string
): Promise<{
  isEligible: boolean;
  error?: string;
  order?: any;
  maxRefundAmount?: number;
}> {
  try {
    const db = getFirestore();
    
    // Get the order
    const orderDoc = await db.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      return {
        isEligible: false,
        error: 'Order not found'
      };
    }

    const orderData = orderDoc.data()!;

    // Verify user is either buyer or seller
    if (orderData.buyerId !== userId && orderData.sellerId !== userId) {
      return {
        isEligible: false,
        error: 'User not authorized for this order'
      };
    }

    // Check if order is in a refundable state
    const refundableStatuses = ['completed', 'awaiting_shipping', 'shipped'];
    if (!refundableStatuses.includes(orderData.status)) {
      return {
        isEligible: false,
        error: `Order status '${orderData.status}' is not eligible for refund`
      };
    }

    // Check if already refunded
    if (orderData.refundStatus === 'completed') {
      return {
        isEligible: false,
        error: 'Order has already been refunded'
      };
    }

    // Verify refund amount doesn't exceed order amount
    const maxRefundAmount = orderData.amount || 0;
    if (requestedAmount > maxRefundAmount) {
      return {
        isEligible: false,
        error: `Refund amount exceeds order total. Max: ${maxRefundAmount}`,
        maxRefundAmount
      };
    }

    // Check refund time limit (e.g., 30 days)
    const orderDate = orderData.createdAt?.toDate() || new Date(0);
    const daysSinceOrder = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceOrder > 30) {
      return {
        isEligible: false,
        error: 'Refund request exceeds 30-day limit'
      };
    }

    return {
      isEligible: true,
      order: orderData,
      maxRefundAmount
    };

  } catch (error) {
    console.error('[payment-verification] Error verifying refund eligibility:', error);
    return {
      isEligible: false,
      error: 'Failed to verify refund eligibility'
    };
  }
}

/**
 * Verify platform fee calculation
 */
export function verifyPlatformFee(
  orderAmount: number,
  platformFee: number,
  feePercentage: number = 0.05 // 5% default
): { isValid: boolean; expectedFee: number; error?: string } {
  const expectedFee = Math.round(orderAmount * feePercentage * 100) / 100; // Round to 2 decimal places
  const tolerance = 0.01; // 1 cent tolerance for rounding differences
  
  if (Math.abs(platformFee - expectedFee) > tolerance) {
    return {
      isValid: false,
      expectedFee,
      error: `Platform fee mismatch. Expected: ${expectedFee}, Actual: ${platformFee}`
    };
  }
  
  return {
    isValid: true,
    expectedFee
  };
}

/**
 * Verify that a Connect account is valid and can receive payments
 */
export async function verifyConnectAccount(accountId: string): Promise<{
  isValid: boolean;
  canReceivePayments: boolean;
  error?: string;
  account?: Stripe.Account;
}> {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    
    if (!account) {
      return {
        isValid: false,
        canReceivePayments: false,
        error: 'Connect account not found'
      };
    }

    const canReceivePayments = account.charges_enabled && account.payouts_enabled;
    
    return {
      isValid: true,
      canReceivePayments,
      account,
      ...(canReceivePayments ? {} : { error: 'Account cannot receive payments' })
    };

  } catch (error) {
    console.error('[payment-verification] Error verifying Connect account:', error);
    return {
      isValid: false,
      canReceivePayments: false,
      error: error instanceof Error ? error.message : 'Account verification failed'
    };
  }
}