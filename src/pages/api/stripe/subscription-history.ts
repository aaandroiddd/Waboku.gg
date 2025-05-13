import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
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
    headers: Object.keys(req.headers)
  });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];
    
    // Initialize Firebase Admin and verify token
    const { admin } = getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    
    console.log('[Subscription History] Fetching history for user:', userId);

    // Get Firestore and Realtime Database references
    const firestore = admin.firestore();
    const realtimeDb = admin.database();
    
    // Fetch user data from Firestore
    const userDoc = await firestore.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    // Fetch subscription history from Firestore
    const subscriptionHistoryRef = firestore.collection('users').doc(userId).collection('subscription_history');
    const historySnapshot = await subscriptionHistoryRef.orderBy('date', 'desc').limit(50).get();
    
    let events = [];
    let stripeCustomerId = null;
    let paymentMethods = [];
    
    // If we have user data with a Stripe customer ID, fetch payment methods
    if (userData?.stripeCustomerId) {
      stripeCustomerId = userData.stripeCustomerId;
      
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
    
    // If we have history records in Firestore, use those
    if (!historySnapshot.empty) {
      events = historySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type,
          date: data.date,
          description: data.description,
          details: data.details || {}
        };
      });
      
      console.log('[Subscription History] Fetched history from Firestore:', {
        count: events.length
      });
    } else {
      // If no history records, try to reconstruct from subscription data
      console.log('[Subscription History] No history records found, reconstructing from subscription data');
      
      // Get current subscription data
      const subscriptionData = userData?.subscription || {};
      
      // If there's a Stripe subscription ID, fetch details from Stripe
      if (subscriptionData.stripeSubscriptionId && !subscriptionData.stripeSubscriptionId.includes('admin_')) {
        try {
          // Fetch subscription from Stripe
          const subscription = await stripe.subscriptions.retrieve(subscriptionData.stripeSubscriptionId, {
            expand: ['default_payment_method', 'latest_invoice.payment_intent']
          });
          
          // Add subscription creation event
          events.push({
            id: `sub_created_${subscription.id}`,
            type: 'subscription_created',
            date: new Date(subscription.created * 1000).toISOString(),
            description: 'Subscription created',
            details: {
              status: subscription.status,
              tier: 'premium'
            }
          });
          
          // Add payment events from invoices
          try {
            const invoices = await stripe.invoices.list({
              subscription: subscription.id,
              limit: 10
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
                
                events.push({
                  id: `payment_${invoice.id}`,
                  type: 'payment_succeeded',
                  date: new Date(invoice.created * 1000).toISOString(),
                  description: 'Payment succeeded',
                  details: {
                    amount: invoice.amount_paid / 100,
                    ...cardDetails
                  }
                });
              } else if (invoice.status === 'uncollectible' || invoice.status === 'open' && invoice.due_date && invoice.due_date < Math.floor(Date.now() / 1000)) {
                events.push({
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
            events.push({
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
            count: events.length,
            subscriptionId: subscription.id
          });
        } catch (stripeError) {
          console.error('[Subscription History] Error fetching subscription from Stripe:', stripeError);
        }
      } else if (subscriptionData.stripeSubscriptionId?.includes('admin_')) {
        // For admin-assigned subscriptions
        events.push({
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
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    // Return the subscription history and payment methods
    return res.status(200).json({
      events,
      paymentMethods
    });
  } catch (error: any) {
    console.error('[Subscription History] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'Failed to fetch subscription history'
    });
  }
}