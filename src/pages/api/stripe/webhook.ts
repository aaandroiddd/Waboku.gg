import { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// This is necessary to handle Stripe webhooks
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Stripe Webhook] Request received:', {
    method: req.method,
    hasSignature: !!req.headers['stripe-signature'],
    url: req.url,
    headers: Object.keys(req.headers)
  });

  if (req.method !== 'POST') {
    console.log('[Stripe Webhook] Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Stripe Webhook] Missing webhook secret');
    return res.status(500).json({
      error: 'Configuration error',
      message: 'Webhook secret is not configured'
    });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error('[Stripe Webhook] Missing Stripe signature');
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Missing Stripe signature'
    });
  }

  let event: Stripe.Event;

  try {
    console.log('[Stripe Webhook] Attempting to construct event with signature:', sig.substring(0, 10) + '...');
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('[Stripe Webhook] Event constructed successfully:', {
      type: event.type,
      id: event.id,
      apiVersion: event.api_version
    });
  } catch (err) {
    console.error('[Stripe Webhook] Error verifying webhook signature:', err);
    return res.status(400).json({
      error: 'Webhook verification failed',
      message: 'Could not verify webhook signature',
      details: err instanceof Error ? err.message : String(err)
    });
  }

  // Initialize Firebase Admin
  getFirebaseAdmin();
  const firestoreDb = getFirestore();
  const realtimeDb = getDatabase();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Handle subscription checkout
        if (session.metadata?.userId) {
          const userId = session.metadata.userId;
          
          console.log('[Stripe Webhook] Subscription checkout completed, updating user account:', {
            userId,
            sessionId: session.id
          });

          // Get current date for subscription dates
          const currentDate = new Date();
          const renewalDate = new Date(currentDate);
          renewalDate.setDate(currentDate.getDate() + 30); // 30 days from now

          // Update user's subscription status immediately after successful checkout in Realtime DB
          // Update tier and status separately to comply with validation rules
          await realtimeDb.ref(`users/${userId}/account/tier`).set('premium');
          await realtimeDb.ref(`users/${userId}/account/status`).set('active');
          
          // Update subscription fields separately
          const subscriptionRef = realtimeDb.ref(`users/${userId}/account/subscription`);
          await subscriptionRef.update({
            status: 'active', // Changed from 'processing' to 'active' for immediate effect
            tier: 'premium',
            startDate: currentDate.toISOString(),
            renewalDate: renewalDate.toISOString(),
            currentPeriodEnd: Math.floor(renewalDate.getTime() / 1000),
            lastUpdated: Date.now()
          });

          // Also update Firestore for consistency
          await firestoreDb.collection('users').doc(userId).set({
            accountTier: 'premium', // Top-level field for easier queries
            subscription: {
              currentPlan: 'premium',
              status: 'active',
              startDate: currentDate.toISOString(),
              endDate: renewalDate.toISOString() // Using endDate for consistency
            }
          }, { merge: true });

          console.log('[Stripe Webhook] User account updated to premium:', {
            userId,
            sessionId: session.id,
            startDate: currentDate.toISOString(),
            renewalDate: renewalDate.toISOString()
          });
        } 
        // Handle marketplace purchase
        else if (session.metadata?.listingId && session.metadata?.buyerId && session.metadata?.sellerId) {
          const { listingId, buyerId, sellerId } = session.metadata;
          
          console.log('[Stripe Webhook] Marketplace purchase completed:', {
            listingId,
            buyerId,
            sellerId,
            sessionId: session.id
          });

          try {
            // Get the payment intent to access transfer data
            let paymentIntentId = session.payment_intent as string;
            
            // Update the listing status to sold
            await firestoreDb.collection('listings').doc(listingId).update({
              status: 'sold',
              soldAt: new Date(),
              soldTo: buyerId,
              paymentSessionId: session.id,
              paymentIntentId: paymentIntentId,
              updatedAt: new Date()
            });
            
            console.log('[Stripe Webhook] Listing marked as sold:', {
              listingId,
              status: 'sold',
              soldTo: buyerId
            });

            // Get the listing data to include in the order
            const listingDoc = await firestoreDb.collection('listings').doc(listingId).get();
            const listingData = listingDoc.data();
            
            if (!listingData) {
              throw new Error(`Listing ${listingId} not found`);
            }
            
            // Check if this order came from an accepted offer
            let offerPrice = null;
            if (session.metadata?.offerId) {
              try {
                const offerDoc = await firestoreDb.collection('offers').doc(session.metadata.offerId).get();
                if (offerDoc.exists) {
                  const offerData = offerDoc.data();
                  offerPrice = offerData.amount;
                  console.log(`[Stripe Webhook] Found offer price: ${offerPrice} for offer ID: ${session.metadata.offerId}`);
                }
              } catch (err) {
                console.error('[Stripe Webhook] Error fetching offer data:', err);
              }
            }

            // Create an order record
            const orderData = {
              listingId,
              buyerId,
              sellerId,
              status: 'awaiting_shipping', // Changed from 'completed' to 'awaiting_shipping'
              amount: session.amount_total ? session.amount_total / 100 : 0, // Convert from cents
              platformFee: session.metadata.platformFee ? parseInt(session.metadata.platformFee) / 100 : 0, // Convert from cents
              paymentSessionId: session.id,
              paymentIntentId: paymentIntentId,
              createdAt: new Date(),
              updatedAt: new Date(),
              // Include offer price if available
              ...(offerPrice && { offerPrice }),
              shippingAddress: session.shipping?.address ? {
                name: session.shipping.name,
                line1: session.shipping.address.line1,
                line2: session.shipping.address.line2,
                city: session.shipping.address.city,
                state: session.shipping.address.state,
                postal_code: session.shipping.address.postal_code,
                country: session.shipping.address.country,
              } : null,
              // Add the listing snapshot for display in the orders page
              listingSnapshot: {
                title: listingData.title || 'Untitled Listing',
                price: listingData.price || 0,
                imageUrl: listingData.imageUrls && listingData.imageUrls.length > 0 ? listingData.imageUrls[0] : null
              }
            };

            // Create the order in Firestore
            console.log('[Stripe Webhook] Attempting to create order in main collection with data:', {
              listingId,
              buyerId,
              sellerId,
              amount: orderData.amount,
              status: orderData.status,
              paymentSessionId: orderData.paymentSessionId,
              paymentIntentId: orderData.paymentIntentId,
              shippingAddress: orderData.shippingAddress ? 'Present' : 'Missing'
            });
            
            // Verify Firestore connection
            try {
              const testRef = firestoreDb.collection('_test_connection').doc('test');
              await testRef.set({ timestamp: new Date() });
              console.log('[Stripe Webhook] Firestore connection verified');
              await testRef.delete();
            } catch (connectionError) {
              console.error('[Stripe Webhook] Firestore connection test failed:', connectionError);
              // Continue anyway, as the actual order creation might still work
            }
            
            let orderRef;
            try {
              // First check if an order with this payment session already exists
              const existingOrdersQuery = await firestoreDb.collection('orders')
                .where('paymentSessionId', '==', session.id)
                .limit(1)
                .get();
              
              if (!existingOrdersQuery.empty) {
                const existingOrder = existingOrdersQuery.docs[0];
                console.log('[Stripe Webhook] Order already exists for this session:', {
                  orderId: existingOrder.id,
                  paymentSessionId: session.id
                });
                orderRef = existingOrder.ref;
                
                // Update the existing order with any new information
                await orderRef.update({
                  updatedAt: new Date(),
                  paymentIntentId: paymentIntentId, // Ensure payment intent is updated
                  status: 'completed' // Ensure status is completed
                });
              } else {
                // Create a new order
                orderRef = await firestoreDb.collection('orders').add(orderData);
                console.log('[Stripe Webhook] Order created successfully in main collection:', {
                  orderId: orderRef.id,
                  path: `orders/${orderRef.id}`
                });
              }
            } catch (orderCreateError) {
              console.error('[Stripe Webhook] Failed to create order in main collection:', orderCreateError);
              
              // Log more details about the error
              if (orderCreateError instanceof Error) {
                console.error('[Stripe Webhook] Error details:', {
                  message: orderCreateError.message,
                  stack: orderCreateError.stack,
                  name: orderCreateError.name
                });
              }
              
              throw orderCreateError; // Re-throw to be caught by the outer try/catch
            }
            
            // Add the order to the buyer's orders
            await firestoreDb.collection('users').doc(buyerId).collection('orders').doc(orderRef.id).set({
              orderId: orderRef.id,
              role: 'buyer',
              createdAt: new Date()
            });
            console.log('[Stripe Webhook] Order added to buyer collection:', {
              buyerId,
              orderId: orderRef.id
            });
            
            // Add the order to the seller's orders
            await firestoreDb.collection('users').doc(sellerId).collection('orders').doc(orderRef.id).set({
              orderId: orderRef.id,
              role: 'seller',
              createdAt: new Date()
            });
            console.log('[Stripe Webhook] Order added to seller collection:', {
              sellerId,
              orderId: orderRef.id
            });

            console.log('[Stripe Webhook] Order creation completed successfully:', {
              orderId: orderRef.id,
              listingId,
              buyerId,
              sellerId
            });
          } catch (error) {
            console.error('[Stripe Webhook] Error processing marketplace purchase:', error);
            throw error; // Re-throw to be caught by the outer try/catch
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Only process marketplace payments (those with transfer_data)
        if (paymentIntent.transfer_data && paymentIntent.metadata?.listingId) {
          const { listingId, buyerId, sellerId } = paymentIntent.metadata;
          
          console.log('[Stripe Webhook] Payment intent succeeded for marketplace purchase:', {
            listingId,
            buyerId,
            sellerId,
            paymentIntentId: paymentIntent.id,
            transferId: paymentIntent.transfer_data.destination
          });
          
          // Update the order with the transfer information
          const ordersSnapshot = await firestoreDb.collection('orders')
            .where('paymentIntentId', '==', paymentIntent.id)
            .limit(1)
            .get();
          
          if (!ordersSnapshot.empty) {
            const orderDoc = ordersSnapshot.docs[0];
            await orderDoc.ref.update({
              transferId: paymentIntent.transfer_data.destination,
              transferAmount: paymentIntent.amount - (paymentIntent.application_fee_amount || 0),
              paymentStatus: 'succeeded',
              updatedAt: new Date()
            });
            
            console.log('[Stripe Webhook] Order updated with transfer information:', {
              orderId: orderDoc.id,
              transferId: paymentIntent.transfer_data.destination
            });
          }
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        
        // Find the user with this Connect account ID
        const usersSnapshot = await firestoreDb.collection('users')
          .where('stripeConnectAccountId', '==', account.id)
          .limit(1)
          .get();
        
        if (!usersSnapshot.empty) {
          const userDoc = usersSnapshot.docs[0];
          const userId = userDoc.id;
          
          // Update the user's Connect account status
          let status = 'pending';
          if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
            status = 'active';
          }
          
          await userDoc.ref.update({
            stripeConnectStatus: status,
            stripeConnectDetailsSubmitted: account.details_submitted,
            stripeConnectChargesEnabled: account.charges_enabled,
            stripeConnectPayoutsEnabled: account.payouts_enabled,
            stripeConnectUpdatedAt: new Date()
          });
          
          console.log('[Stripe Webhook] User Connect account updated:', {
            userId,
            accountId: account.id,
            status
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (!userId) {
          console.error('[Stripe Webhook] No userId found in subscription metadata:', {
            subscriptionId: subscription.id,
            metadata: subscription.metadata
          });
          throw new Error('No userId found in subscription metadata');
        }

        const status = subscription.status;
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
        const cancelAtPeriodEnd = subscription.cancel_at_period_end;
        const canceledAt = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null;

        console.log('[Stripe Webhook] Processing subscription update:', {
          userId,
          subscriptionId: subscription.id,
          status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          canceledAt
        });

        // Determine the correct account tier and status
        // If subscription is active but set to cancel at period end, we should keep it as premium until the end date
        let accountTier = 'free';
        let subscriptionStatus = status;
        
        if (status === 'active') {
          accountTier = 'premium';
          
          // If it's set to cancel at period end, mark it as 'canceled' in our system
          // but keep the accountTier as premium until the end date
          if (cancelAtPeriodEnd) {
            subscriptionStatus = 'canceled';
          }
        }

        // Update Firestore
        await firestoreDb.collection('users').doc(userId).set({
          accountTier: accountTier,
          subscription: {
            currentPlan: 'premium', // Keep the plan as premium
            startDate: currentPeriodStart,
            endDate: currentPeriodEnd,
            status: subscriptionStatus,
            stripeSubscriptionId: subscription.id,
            cancelAtPeriodEnd: cancelAtPeriodEnd,
            canceledAt: canceledAt
          }
        }, { merge: true });

        // Update Realtime Database with more complete data - update fields separately
        
        // Update tier and status separately to comply with validation rules
        await realtimeDb.ref(`users/${userId}/account/tier`).set(accountTier);
        await realtimeDb.ref(`users/${userId}/account/status`).set('active');
        
        // Update subscription fields separately
        const subscriptionRef = realtimeDb.ref(`users/${userId}/account/subscription`);
        await subscriptionRef.update({
          stripeSubscriptionId: subscription.id,
          status: subscriptionStatus,
          tier: 'premium', // Keep the tier as premium
          startDate: currentPeriodStart,
          endDate: currentPeriodEnd,
          renewalDate: currentPeriodEnd,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: cancelAtPeriodEnd,
          canceledAt: canceledAt,
          lastUpdated: Date.now()
        });
        
        console.log('[Stripe Webhook] Updated subscription status:', {
          userId,
          subscriptionId: subscription.id,
          status: subscriptionStatus,
          accountTier: accountTier,
          cancelAtPeriodEnd: cancelAtPeriodEnd
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (!userId) {
          throw new Error('No userId found in subscription metadata');
        }

        // FIXED: Check if the subscription is still within the paid period
        const currentDate = new Date();
        const endDate = new Date(subscription.current_period_end * 1000);
        const endDateIso = endDate.toISOString();
        
        // If the subscription is deleted but still within the paid period,
        // we should keep the user as premium until the end date
        const isWithinPaidPeriod = currentDate < endDate;
        
        console.log('[Stripe Webhook] Processing subscription deletion:', {
          userId,
          endDate: endDateIso,
          currentDate: currentDate.toISOString(),
          isWithinPaidPeriod
        });

        if (isWithinPaidPeriod) {
          // Update Firestore - keep as premium but mark as canceled
          await firestoreDb.collection('users').doc(userId).set({
            accountTier: 'premium', // Keep as premium until end date
            subscription: {
              currentPlan: 'premium',
              status: 'canceled', // Mark as canceled
              endDate: endDateIso,
              renewalDate: endDateIso,
              canceledAt: new Date().toISOString(),
              cancelAtPeriodEnd: true
            }
          }, { merge: true });

          // Update Realtime Database - update fields separately
          await realtimeDb.ref(`users/${userId}/account/tier`).set('premium'); // Keep as premium
          
          // Update subscription fields separately
          const subscriptionRef = realtimeDb.ref(`users/${userId}/account/subscription`);
          await subscriptionRef.update({
            status: 'canceled',
            tier: 'premium',
            endDate: endDateIso,
            renewalDate: endDateIso,
            canceledAt: new Date().toISOString(),
            cancelAtPeriodEnd: true,
            lastUpdated: Date.now()
          });
          
          console.log('[Stripe Webhook] Subscription marked as canceled but still active until end date:', {
            userId,
            endDate: endDateIso
          });
        } else {
          // If already past the end date, downgrade immediately
          // Update Firestore
          await firestoreDb.collection('users').doc(userId).set({
            accountTier: 'free',
            subscription: {
              currentPlan: 'free',
              status: 'inactive',
              endDate: endDateIso
            }
          }, { merge: true });

          // Update Realtime Database - update fields separately
          await realtimeDb.ref(`users/${userId}/account/tier`).set('free');
          
          // Update subscription fields separately
          const subscriptionRef = realtimeDb.ref(`users/${userId}/account/subscription`);
          await subscriptionRef.update({
            status: 'inactive',
            tier: 'free',
            endDate: endDateIso,
            lastUpdated: Date.now()
          });
          
          console.log('[Stripe Webhook] Subscription deleted and downgraded immediately:', {
            userId,
            endDate: endDateIso
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = invoice.subscription as string;
        
        // Get the subscription to find the user ID
        const subDetails = await stripe.subscriptions.retrieve(subscription);
        const userId = subDetails.metadata.userId;

        if (!userId) {
          throw new Error('No userId found in subscription metadata');
        }

        // Update subscription status in database
        await realtimeDb.ref(`users/${userId}/account/subscription`).update({
          status: 'payment_failed',
          lastUpdated: Date.now()
        });

        console.log('[Stripe Webhook] Payment failed:', {
          userId,
          subscriptionId: subscription
        });
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing webhook:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
}