import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { subscriptionHistoryService } from '@/lib/subscription-history-service';
import { subscriptionHistoryCache } from '@/lib/subscription-history-cache';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Subscription History] Request received:', {
    method: req.method,
    url: req.url,
    query: req.query,
    headers: Object.keys(req.headers)
  });

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized - Missing or invalid authorization header',
        code: 'UNAUTHORIZED'
      });
    }

    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];
    
    // Initialize Firebase Admin and verify token
    const { admin } = getFirebaseAdmin();
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (tokenError) {
      console.error('[Subscription History] Token verification failed:', tokenError);
      return res.status(401).json({ 
        error: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
    }
    
    const userId = decodedToken.uid;
    
    // Parse query parameters for pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50); // Max 50 items per page
    const startAfter = req.query.startAfter as string;
    
    console.log('[Subscription History] Fetching history for user:', {
      userId,
      page,
      limit,
      startAfter
    });

    // Check paginated cache first
    const cachedData = subscriptionHistoryCache.getPaginated(userId, page, limit);
    if (cachedData) {
      console.log('[Subscription History] Returning cached paginated data');
      return res.status(200).json({
        ...cachedData,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Get Firestore reference
    const firestore = admin.firestore();
    
    // Fetch user data from Firestore with error handling
    let userData = null;
    try {
      const userDoc = await firestore.collection('users').doc(userId).get();
      userData = userDoc.exists ? userDoc.data() : null;
    } catch (firestoreError) {
      console.error('[Subscription History] Error fetching user data:', firestoreError);
      return res.status(500).json({ 
        error: 'Failed to fetch user data',
        code: 'FIRESTORE_ERROR',
        message: 'Unable to retrieve user information from database'
      });
    }
    
    let historyResult = { events: [], hasMore: false, lastEventId: undefined };
    let paymentMethods = [];
    
    try {
      // Use the subscription history service to get paginated events
      historyResult = await subscriptionHistoryService.getHistory(userId, limit, startAfter);
      console.log('[Subscription History] Fetched history from service:', {
        count: historyResult.events.length,
        hasMore: historyResult.hasMore,
        lastEventId: historyResult.lastEventId
      });
    } catch (historyError) {
      console.error('[Subscription History] Error fetching from service:', historyError);
      // Continue with empty events array - we'll try fallback reconstruction
    }
    
    // If we have user data with a Stripe customer ID, fetch payment methods
    if (userData?.stripeCustomerId) {
      const stripeCustomerId = userData.stripeCustomerId;
      
      try {
        // Fetch payment methods from Stripe
        const paymentMethodsResponse = await stripe.paymentMethods.list({
          customer: stripeCustomerId,
          type: 'card',
        });
        
        paymentMethods = paymentMethodsResponse.data.map(pm => ({
          id: pm.id,
          brand: pm.card?.brand || 'unknown',
          last4: pm.card?.last4 || '****',
          exp_month: pm.card?.exp_month || 0,
          exp_year: pm.card?.exp_year || 0,
        }));
        
        console.log('[Subscription History] Fetched payment methods:', {
          count: paymentMethods.length,
          customerId: stripeCustomerId
        });
      } catch (stripeError) {
        console.error('[Subscription History] Error fetching payment methods:', stripeError);
      }
    }
    
    // If no events from service and this is the first page, try to reconstruct from subscription data (fallback)
    if (historyResult.events.length === 0 && page === 1) {
      console.log('[Subscription History] No history records found, reconstructing from subscription data');
      
      let fallbackEvents = [];
      
      // Get current subscription data
      const subscriptionData = userData?.subscription || {};
      
      // If there's a Stripe subscription ID, fetch details from Stripe
      if (subscriptionData.stripeSubscriptionId && !subscriptionData.stripeSubscriptionId.includes('admin_')) {
        try {
          // Fetch subscription from Stripe with timeout
          const subscription = await Promise.race([
            stripe.subscriptions.retrieve(subscriptionData.stripeSubscriptionId, {
              expand: ['default_payment_method', 'latest_invoice.payment_intent']
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Stripe API timeout')), 10000)
            )
          ]) as Stripe.Subscription;
          
          // Add subscription creation event
          fallbackEvents.push({
            id: `sub_created_${subscription.id}`,
            type: 'subscription_created',
            date: new Date(subscription.created * 1000).toISOString(),
            description: 'Premium subscription activated',
            details: {
              status: subscription.status,
              tier: 'premium'
            }
          });
          
          // Add payment events from invoices
          try {
            const invoices = await stripe.invoices.list({
              subscription: subscription.id,
              limit: Math.min(limit, 10)
            });
            
            for (const invoice of invoices.data) {
              if (invoice.status === 'paid') {
                const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
                let cardDetails = {};
                
                // Try to get payment method details
                if (typeof paymentIntent === 'string') {
                  try {
                    const pi = await stripe.paymentIntents.retrieve(paymentIntent, {
                      expand: ['payment_method']
                    });
                    
                    if (pi.payment_method && typeof pi.payment_method !== 'string') {
                      const pm = pi.payment_method;
                      if (pm.card) {
                        cardDetails = {
                          cardBrand: pm.card.brand,
                          cardLast4: pm.card.last4
                        };
                      }
                    }
                  } catch (piError) {
                    console.error('[Subscription History] Error fetching payment intent:', piError);
                  }
                }
                
                fallbackEvents.push({
                  id: `payment_${invoice.id}`,
                  type: 'payment_succeeded',
                  date: new Date(invoice.created * 1000).toISOString(),
                  description: 'Payment processed successfully',
                  details: {
                    amount: invoice.amount_paid / 100,
                    ...cardDetails
                  }
                });
              } else if (invoice.status === 'uncollectible' || (invoice.status === 'open' && invoice.due_date && invoice.due_date < Math.floor(Date.now() / 1000))) {
                fallbackEvents.push({
                  id: `payment_failed_${invoice.id}`,
                  type: 'payment_failed',
                  date: new Date(invoice.created * 1000).toISOString(),
                  description: 'Payment failed',
                  details: {
                    amount: invoice.amount_due / 100
                  }
                });
              }
            }
          } catch (invoiceError) {
            console.error('[Subscription History] Error fetching invoices:', invoiceError);
          }
          
          // If subscription is canceled, add cancellation event
          if (subscription.canceled_at) {
            fallbackEvents.push({
              id: `sub_canceled_${subscription.id}`,
              type: 'subscription_canceled',
              date: new Date(subscription.canceled_at * 1000).toISOString(),
              description: 'Subscription canceled',
              details: {
                status: 'canceled',
                endDate: new Date(subscription.current_period_end * 1000).toISOString()
              }
            });
          }
          
          console.log('[Subscription History] Reconstructed history from Stripe:', {
            count: fallbackEvents.length,
            subscriptionId: subscription.id
          });
        } catch (stripeError) {
          console.error('[Subscription History] Error fetching subscription from Stripe:', stripeError);
          return res.status(500).json({ 
            error: 'Failed to fetch subscription data from Stripe',
            code: 'STRIPE_ERROR',
            message: stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error'
          });
        }
      } else if (subscriptionData.stripeSubscriptionId?.includes('admin_')) {
        // For admin-assigned subscriptions
        fallbackEvents.push({
          id: `admin_upgrade_${Date.now()}`,
          type: 'admin_update',
          date: subscriptionData.startDate || new Date().toISOString(),
          description: 'Account upgraded by administrator',
          details: {
            status: 'active',
            tier: 'premium',
            endDate: subscriptionData.endDate || subscriptionData.renewalDate
          }
        });
        
        console.log('[Subscription History] Added admin upgrade event');
      }
      
      // Sort events by date (newest first)
      fallbackEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Apply pagination to fallback events
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedFallbackEvents = fallbackEvents.slice(startIndex, endIndex);
      
      historyResult = {
        events: paginatedFallbackEvents,
        hasMore: endIndex < fallbackEvents.length,
        lastEventId: paginatedFallbackEvents.length > 0 ? paginatedFallbackEvents[paginatedFallbackEvents.length - 1].id : undefined
      };
    }
    
    // Calculate total pages (approximate)
    const totalPages = historyResult.hasMore ? page + 1 : page;
    
    // Prepare response data
    const responseData = {
      events: historyResult.events,
      paymentMethods,
      hasMore: historyResult.hasMore,
      lastEventId: historyResult.lastEventId,
      currentPage: page,
      totalPages,
      limit,
      timestamp: new Date().toISOString()
    };
    
    // Cache the paginated response for 5 minutes
    subscriptionHistoryCache.setPaginated(userId, page, limit, responseData, 5 * 60 * 1000);
    
    // Return the subscription history and payment methods
    return res.status(200).json(responseData);
  } catch (error: any) {
    console.error('[Subscription History] Unexpected error:', {
      error: error.message,
      stack: error.stack,
      userId,
      page,
      limit
    });
    
    // Determine error type and provide appropriate response
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Authentication token expired',
        code: 'TOKEN_EXPIRED',
        message: 'Please sign in again'
      });
    }
    
    if (error.code === 'permission-denied') {
      return res.status(403).json({ 
        error: 'Permission denied',
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to access this resource'
      });
    }
    
    if (error.message?.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Request timeout',
        code: 'TIMEOUT',
        message: 'The request took too long to complete. Please try again.'
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred while fetching subscription history',
      timestamp: new Date().toISOString()
    });
  }
}