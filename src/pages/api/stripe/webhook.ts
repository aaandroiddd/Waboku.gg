import { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { emailService } from '@/lib/email-service';
import { subscriptionHistoryService } from '@/lib/subscription-history-service';

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
        
        console.log('[Stripe Webhook] Checkout session completed:', {
          sessionId: session.id,
          hasShipping: !!session.shipping,
          shippingData: session.shipping ? {
            name: session.shipping.name,
            address: session.shipping.address
          } : null,
          metadata: session.metadata
        });
        
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

          // Create a complete subscription object to ensure all fields are properly set
          const completeSubscriptionData = {
            status: 'active',
            tier: 'premium',
            currentPlan: 'premium',
            stripeSubscriptionId: session.subscription as string, // Store the subscription ID
            startDate: currentDate.toISOString(),
            renewalDate: renewalDate.toISOString(),
            endDate: renewalDate.toISOString(), // Using endDate for consistency
            currentPeriodEnd: Math.floor(renewalDate.getTime() / 1000),
            cancelAtPeriodEnd: false,
            canceledAt: null,
            lastUpdated: Date.now()
          };
          
          console.log('[Stripe Webhook] Complete subscription data:', completeSubscriptionData);

          // Update user's subscription status immediately after successful checkout in Realtime DB
          // Update tier and status separately to comply with validation rules
          await realtimeDb.ref(`users/${userId}/account/tier`).set('premium');
          await realtimeDb.ref(`users/${userId}/account/status`).set('active');
          
          // Update subscription fields separately
          const subscriptionRef = realtimeDb.ref(`users/${userId}/account/subscription`);
          await subscriptionRef.update(completeSubscriptionData);

          // Also update Firestore for consistency - use set with merge: false to ensure complete replacement
          await firestoreDb.collection('users').doc(userId).set({
            accountTier: 'premium', // Top-level field for easier queries
            subscription: completeSubscriptionData,
            updatedAt: new Date()
          }, { merge: true });

          console.log('[Stripe Webhook] User account updated to premium:', {
            userId,
            sessionId: session.id,
            startDate: currentDate.toISOString(),
            renewalDate: renewalDate.toISOString()
          });

          // Add subscription history event
          try {
            await subscriptionHistoryService.addSubscriptionCreated(
              userId,
              session.subscription as string,
              'premium'
            );
            console.log('[Stripe Webhook] Added subscription created event to history');
          } catch (historyError) {
            console.error('[Stripe Webhook] Error adding subscription history:', historyError);
          }

          // Send subscription success email
          try {
            const userDoc = await firestoreDb.collection('users').doc(userId).get();
            const userData = userDoc.data();
            
            if (userData && userData.email) {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
              await emailService.sendSubscriptionSuccessEmail({
                userName: userData.displayName || userData.username || 'User',
                userEmail: userData.email,
                amount: session.amount_total ? session.amount_total / 100 : 9.99,
                planName: 'Premium',
                billingPeriod: 'Monthly',
                nextBillingDate: renewalDate.toLocaleDateString(),
                actionUrl: `${baseUrl}/dashboard/settings`
              });
              console.log('[Stripe Webhook] Subscription success email sent to:', userData.email);
            }
          } catch (emailError) {
            console.error('[Stripe Webhook] Error sending subscription success email:', emailError);
          }
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
            
            // Check if this is a payment for an existing pending order (from accepted offers)
            if (session.metadata?.isPendingOrderPayment === 'true' && session.metadata?.orderId) {
              console.log('[Stripe Webhook] Processing payment for existing pending order:', {
                orderId: session.metadata.orderId,
                sessionId: session.id
              });
              
              try {
                // Get payment method details and shipping information from payment intent
                let paymentMethod = null;
                let shippingFromPaymentIntent = null;
                if (paymentIntentId) {
                  try {
                    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                    
                    // Extract payment method details
                    if (paymentIntent.payment_method) {
                      const paymentMethodDetails = await stripe.paymentMethods.retrieve(
                        paymentIntent.payment_method as string
                      );
                      
                      if (paymentMethodDetails.card) {
                        paymentMethod = {
                          brand: paymentMethodDetails.card.brand,
                          last4: paymentMethodDetails.card.last4,
                          exp_month: paymentMethodDetails.card.exp_month,
                          exp_year: paymentMethodDetails.card.exp_year
                        };
                        
                        console.log('[Stripe Webhook] Retrieved payment method details for pending order:', {
                          brand: paymentMethodDetails.card.brand,
                          last4: paymentMethodDetails.card.last4
                        });
                      }
                    }

                    // Extract shipping information from payment intent
                    if (paymentIntent.shipping?.address) {
                      shippingFromPaymentIntent = {
                        name: paymentIntent.shipping.name,
                        line1: paymentIntent.shipping.address.line1,
                        line2: paymentIntent.shipping.address.line2,
                        city: paymentIntent.shipping.address.city,
                        state: paymentIntent.shipping.address.state,
                        postal_code: paymentIntent.shipping.address.postal_code,
                        country: paymentIntent.shipping.address.country,
                      };
                      console.log('[Stripe Webhook] Retrieved shipping address from payment intent for pending order:', {
                        name: paymentIntent.shipping.name,
                        city: paymentIntent.shipping.address.city,
                        state: paymentIntent.shipping.address.state
                      });
                    }
                  } catch (error) {
                    console.error('[Stripe Webhook] Error retrieving payment intent details for pending order:', error);
                  }
                }
                
                // Update the existing order with payment information and shipping address
                // Build listing snapshot payload for pending order payment
                const listingSnapshotPayload = {
                  title: listingData.title || 'Untitled Listing',
                  description: listingData.description || '',
                  price: listingData.price || 0,
                  imageUrl: listingData.imageUrls && listingData.imageUrls.length > 0 ? listingData.imageUrls[0] : null,
                  images: Array.isArray(listingData.imageUrls) ? listingData.imageUrls : [],
                  attributes: listingData.attributes || {},
                  game: listingData.game || null,
                  category: listingData.category || null,
                  condition: listingData.condition || null,
                  shippingTerms: {
                    shippingCost: typeof listingData.shippingCost === 'number' ? listingData.shippingCost : null,
                    isPickup: !!listingData.isPickup,
                    shippingMethod: listingData.shippingMethod || null,
                    shippingNotes: listingData.shippingNotes || null,
                  },
                  sellerUsername: null as string | null,
                };

                try {
                  const sellerDocSnap = await firestoreDb.collection('users').doc(sellerId).get();
                  const sellerDataForSnapshot = sellerDocSnap.data();
                  if (sellerDataForSnapshot) {
                    listingSnapshotPayload.sellerUsername = sellerDataForSnapshot.displayName || sellerDataForSnapshot.username || null;
                  }
                } catch (e) {
                  console.error('[Stripe Webhook] Error fetching seller for snapshot (pending order):', e);
                }

                const updateData: any = {
                  status: 'awaiting_shipping',
                  paymentStatus: 'paid',
                  paymentSessionId: session.id,
                  paymentIntentId: paymentIntentId,
                  platformFee: session.metadata.platformFee ? parseInt(session.metadata.platformFee) / 100 : 0,
                  updatedAt: new Date()
                };

                // Ensure listing snapshot is persisted for pending order payment
                updateData.listingSnapshot = listingSnapshotPayload;

                // Add payment method if available
                if (paymentMethod) {
                  updateData.paymentMethod = paymentMethod;
                }

                // Add shipping address from payment intent (preferred) or session fallback
                if (shippingFromPaymentIntent) {
                  updateData.shippingAddress = shippingFromPaymentIntent;
                  console.log('[Stripe Webhook] Adding shipping address from payment intent to pending order:', {
                    name: shippingFromPaymentIntent.name,
                    city: shippingFromPaymentIntent.city,
                    state: shippingFromPaymentIntent.state
                  });
                } else if (session.shipping?.address) {
                  updateData.shippingAddress = {
                    name: session.shipping.name,
                    line1: session.shipping.address.line1,
                    line2: session.shipping.address.line2,
                    city: session.shipping.address.city,
                    state: session.shipping.address.state,
                    postal_code: session.shipping.address.postal_code,
                    country: session.shipping.address.country,
                  };
                  console.log('[Stripe Webhook] Adding shipping address from session to pending order:', {
                    name: session.shipping.name,
                    city: session.shipping.address.city,
                    state: session.shipping.address.state
                  });
                }

                const orderRef = firestoreDb.collection('orders').doc(session.metadata.orderId);
                await orderRef.update(updateData);
                
                console.log('[Stripe Webhook] Updated pending order with payment information:', {
                  orderId: session.metadata.orderId,
                  status: 'awaiting_shipping',
                  paymentStatus: 'paid',
                  hasShippingAddress: !!updateData.shippingAddress
                });
                
                // Send notifications for the updated pending order
                try {
                  // Get buyer and seller data for notifications
                  const [buyerDoc, sellerDoc] = await Promise.all([
                    firestoreDb.collection('users').doc(buyerId).get(),
                    firestoreDb.collection('users').doc(sellerId).get()
                  ]);

                  const buyerData = buyerDoc.data();
                  const sellerData = sellerDoc.data();

                  if (buyerData && sellerData) {
                    const orderNumber = session.metadata.orderId.substring(0, 8).toUpperCase();
                    const orderDate = new Date().toLocaleDateString();
                    const shippingAddressFormatted = updateData.shippingAddress ? 
                      `${updateData.shippingAddress.name}\n${updateData.shippingAddress.line1}${updateData.shippingAddress.line2 ? '\n' + updateData.shippingAddress.line2 : ''}\n${updateData.shippingAddress.city}, ${updateData.shippingAddress.state} ${updateData.shippingAddress.postal_code}\n${updateData.shippingAddress.country}` : 
                      'No shipping address provided';

                    // Send order confirmation email to buyer
                    if (buyerData.email) {
                      await emailService.sendOrderConfirmationEmail({
                        userName: buyerData.displayName || buyerData.username || 'User',
                        userEmail: buyerData.email,
                        orderNumber: orderNumber,
                        orderDate: orderDate,
                        cardName: listingData.title || 'Trading Card',
                        setName: listingData.game || 'Unknown Set',
                        condition: listingData.condition || 'Unknown',
                        quantity: 1,
                        price: (session.amount_total ? (session.amount_total / 100) - (session.metadata.platformFee ? parseInt(session.metadata.platformFee) / 100 : 0) : 0).toFixed(2),
                        sellerName: sellerData.displayName || sellerData.username || 'Seller',
                        sellerLocation: sellerData.location || 'Unknown Location',
                        subtotal: (session.amount_total ? (session.amount_total / 100) - (session.metadata.platformFee ? parseInt(session.metadata.platformFee) / 100 : 0) : 0).toFixed(2),
                        shipping: '0.00', // Assuming free shipping for now
                        fee: (session.metadata.platformFee ? parseInt(session.metadata.platformFee) / 100 : 0).toFixed(2),
                        total: (session.amount_total ? session.amount_total / 100 : 0).toFixed(2),
                        shippingAddress: shippingAddressFormatted,
                        orderId: session.metadata.orderId
                      });
                      console.log('[Stripe Webhook] Order confirmation email sent to buyer for pending order:', buyerData.email);
                    }

                    // Send payment confirmation email to buyer
                    if (buyerData.email && paymentMethod) {
                      await emailService.sendPaymentConfirmationEmail({
                        userName: buyerData.displayName || buyerData.username || 'User',
                        userEmail: buyerData.email,
                        transactionId: paymentIntentId || session.id,
                        paymentMethod: `${paymentMethod.brand?.toUpperCase()} ending in ${paymentMethod.last4}`,
                        amount: (session.amount_total ? session.amount_total / 100 : 0).toFixed(2),
                        paymentDate: orderDate,
                        orderId: session.metadata.orderId
                      });
                      console.log('[Stripe Webhook] Payment confirmation email sent to buyer for pending order:', buyerData.email);
                    }

                    // Import notification service and create notifications
                    try {
                      const { notificationService } = await import('@/lib/notification-service');
                      
                      // Create in-app notification for buyer about order payment
                      await notificationService.createNotification({
                        userId: buyerId,
                        type: 'order_update',
                        title: '🛒 Payment Confirmed!',
                        message: `Your payment for "${listingData.title}" has been processed and the order is awaiting shipment.`,
                        data: {
                          orderId: session.metadata.orderId,
                          actionUrl: `/dashboard/orders/${session.metadata.orderId}`
                        }
                      });
                      console.log('[Stripe Webhook] In-app notification created for buyer (pending order):', buyerId);

                      // Create in-app notification for seller about new sale
                      await notificationService.createNotification({
                        userId: sellerId,
                        type: 'sale',
                        title: '🎉 Payment Received!',
                        message: `${buyerData.displayName || buyerData.username || 'A buyer'} completed payment for your "${listingData.title}" - $${(session.amount_total ? session.amount_total / 100 : 0).toFixed(2)}`,
                        data: {
                          orderId: session.metadata.orderId,
                          listingId: listingId,
                          actionUrl: `/dashboard/orders/${session.metadata.orderId}`
                        }
                      });
                      console.log('[Stripe Webhook] In-app notification created for seller (pending order):', sellerId);
                    } catch (notificationImportError) {
                      console.error('[Stripe Webhook] Error importing notification service for pending order:', notificationImportError);
                    }

                    // Send sale notification email to seller
                    if (sellerData.email) {
                      await emailService.sendEmailNotification({
                        userId: sellerId,
                        userEmail: sellerData.email,
                        userName: sellerData.displayName || sellerData.username || 'User',
                        type: 'sale',
                        title: '🎉 Payment Received!',
                        message: `${buyerData.displayName || buyerData.username || 'A buyer'} completed payment for your "${listingData.title}" - $${(session.amount_total ? session.amount_total / 100 : 0).toFixed(2)}. Please prepare the item for shipment.`,
                        actionUrl: `/dashboard/orders/${session.metadata.orderId}`,
                        data: {
                          orderId: session.metadata.orderId,
                          listingId: listingId,
                          buyerName: buyerData.displayName || buyerData.username || 'Buyer',
                          amount: session.amount_total ? session.amount_total / 100 : 0
                        }
                      });
                      console.log('[Stripe Webhook] Sale notification email sent to seller for pending order:', sellerData.email);
                    }
                  }
                } catch (notificationError) {
                  console.error('[Stripe Webhook] Error sending notifications for pending order:', notificationError);
                  // Don't throw error - order was updated successfully, notifications are secondary
                }
                
                // Return early since we've handled the pending order
                return res.status(200).json({ received: true });
              } catch (err) {
                console.error('[Stripe Webhook] Error updating pending order:', err);
                throw err;
              }
            }

            // Get payment method details and shipping information from payment intent
            let paymentMethod = null;
            let shippingFromPaymentIntent = null;
            let shippingFromSession = null;
            let billingFromSession = null;
            let finalShippingAddress = null;
            
            console.log('[Stripe Webhook] Starting shipping address extraction for new order:', {
              sessionId: session.id,
              hasSessionShipping: !!session.shipping,
              sessionShippingDetails: session.shipping ? {
                name: session.shipping.name,
                hasAddress: !!session.shipping.address,
                address: session.shipping.address
              } : null,
              hasCustomerDetails: !!session.customer_details,
              customerDetailsAddress: session.customer_details?.address || null
            });
            
            // First, try to get shipping from the session directly
            if (session.shipping?.address) {
              shippingFromSession = {
                name: session.shipping.name || '',
                line1: session.shipping.address.line1 || '',
                line2: session.shipping.address.line2 || '',
                city: session.shipping.address.city || '',
                state: session.shipping.address.state || '',
                postal_code: session.shipping.address.postal_code || '',
                country: session.shipping.address.country || '',
              };
              console.log('[Stripe Webhook] ✅ Retrieved shipping address from session:', {
                name: session.shipping.name,
                city: session.shipping.address.city,
                state: session.shipping.address.state,
                line1: session.shipping.address.line1,
                line2: session.shipping.address.line2,
                postal_code: session.shipping.address.postal_code,
                country: session.shipping.address.country
              });
            } else {
              console.log('[Stripe Webhook] ❌ No shipping address found in session for new order');
            }

            // Try to get billing address from session as fallback for shipping
            if (session.customer_details?.address) {
              billingFromSession = {
                name: session.customer_details.name || '',
                line1: session.customer_details.address.line1 || '',
                line2: session.customer_details.address.line2 || '',
                city: session.customer_details.address.city || '',
                state: session.customer_details.address.state || '',
                postal_code: session.customer_details.address.postal_code || '',
                country: session.customer_details.address.country || '',
              };
              console.log('[Stripe Webhook] ✅ Retrieved billing address from session as potential shipping fallback:', {
                name: session.customer_details.name,
                city: session.customer_details.address.city,
                state: session.customer_details.address.state,
                line1: session.customer_details.address.line1,
                line2: session.customer_details.address.line2,
                postal_code: session.customer_details.address.postal_code,
                country: session.customer_details.address.country
              });
            } else {
              console.log('[Stripe Webhook] ❌ No billing address found in session customer details');
            }
            
            if (paymentIntentId) {
              try {
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
                  expand: ['payment_method']
                });
                
                console.log('[Stripe Webhook] Retrieved payment intent for new order:', {
                  id: paymentIntent.id,
                  hasShipping: !!paymentIntent.shipping,
                  shippingDetails: paymentIntent.shipping ? {
                    name: paymentIntent.shipping.name,
                    address: paymentIntent.shipping.address
                  } : null
                });
                
                // Extract payment method details
                if (paymentIntent.payment_method) {
                  const paymentMethodDetails = await stripe.paymentMethods.retrieve(
                    paymentIntent.payment_method as string
                  );
                  
                  if (paymentMethodDetails.card) {
                    paymentMethod = {
                      brand: paymentMethodDetails.card.brand,
                      last4: paymentMethodDetails.card.last4,
                      exp_month: paymentMethodDetails.card.exp_month,
                      exp_year: paymentMethodDetails.card.exp_year
                    };
                    
                    console.log('[Stripe Webhook] Retrieved payment method details for new order:', {
                      brand: paymentMethodDetails.card.brand,
                      last4: paymentMethodDetails.card.last4
                    });
                  }
                }

                // Extract shipping information from payment intent
                if (paymentIntent.shipping?.address) {
                  shippingFromPaymentIntent = {
                    name: paymentIntent.shipping.name || '',
                    line1: paymentIntent.shipping.address.line1 || '',
                    line2: paymentIntent.shipping.address.line2 || '',
                    city: paymentIntent.shipping.address.city || '',
                    state: paymentIntent.shipping.address.state || '',
                    postal_code: paymentIntent.shipping.address.postal_code || '',
                    country: paymentIntent.shipping.address.country || '',
                  };
                  console.log('[Stripe Webhook] Retrieved shipping address from payment intent:', {
                    name: paymentIntent.shipping.name,
                    city: paymentIntent.shipping.address.city,
                    state: paymentIntent.shipping.address.state,
                    line1: paymentIntent.shipping.address.line1,
                    line2: paymentIntent.shipping.address.line2,
                    postal_code: paymentIntent.shipping.address.postal_code,
                    country: paymentIntent.shipping.address.country
                  });
                } else {
                  console.log('[Stripe Webhook] No shipping address found in payment intent for new order. Payment intent shipping object:', {
                    hasShipping: !!paymentIntent.shipping,
                    shippingObject: paymentIntent.shipping,
                    hasAddress: !!paymentIntent.shipping?.address
                  });
                }
              } catch (error) {
                console.error('[Stripe Webhook] Error retrieving payment intent details for new order:', error);
              }
            }

            // Determine the best shipping address source
            // Priority: 1) Payment intent shipping, 2) Session shipping, 3) Billing address as shipping fallback
            if (shippingFromPaymentIntent) {
              finalShippingAddress = shippingFromPaymentIntent;
              console.log('[Stripe Webhook] 🎯 Using shipping address from payment intent (most reliable for Buy Now orders):', {
                source: 'payment_intent',
                name: shippingFromPaymentIntent.name,
                city: shippingFromPaymentIntent.city,
                state: shippingFromPaymentIntent.state,
                line1: shippingFromPaymentIntent.line1
              });
            } else if (shippingFromSession) {
              finalShippingAddress = shippingFromSession;
              console.log('[Stripe Webhook] 🎯 Using shipping address from session (fallback):', {
                source: 'session_shipping',
                name: shippingFromSession.name,
                city: shippingFromSession.city,
                state: shippingFromSession.state,
                line1: shippingFromSession.line1
              });
            } else if (billingFromSession) {
              finalShippingAddress = billingFromSession;
              console.log('[Stripe Webhook] 🎯 Using billing address as shipping address (final fallback):', {
                source: 'billing_as_shipping',
                name: billingFromSession.name,
                city: billingFromSession.city,
                state: billingFromSession.state,
                line1: billingFromSession.line1
              });
            } else {
              console.log('[Stripe Webhook] ❌ CRITICAL: No shipping or billing address found in session or payment intent');
            }

            // Additional validation to ensure we have a complete shipping address
            if (finalShippingAddress) {
              // Validate that we have the essential fields
              const hasRequiredFields = finalShippingAddress.name && 
                                      finalShippingAddress.line1 && 
                                      finalShippingAddress.city && 
                                      finalShippingAddress.state && 
                                      finalShippingAddress.postal_code && 
                                      finalShippingAddress.country;
              
              if (!hasRequiredFields) {
                console.warn('[Stripe Webhook] ⚠️ Shipping address is incomplete, missing required fields:', {
                  hasName: !!finalShippingAddress.name,
                  hasLine1: !!finalShippingAddress.line1,
                  hasCity: !!finalShippingAddress.city,
                  hasState: !!finalShippingAddress.state,
                  hasPostalCode: !!finalShippingAddress.postal_code,
                  hasCountry: !!finalShippingAddress.country,
                  shippingAddress: finalShippingAddress
                });
                // Set finalShippingAddress to null if incomplete
                finalShippingAddress = null;
                console.log('[Stripe Webhook] ❌ Setting finalShippingAddress to null due to incomplete data');
              } else {
                console.log('[Stripe Webhook] ✅ Final shipping address validated successfully:', {
                  name: finalShippingAddress.name,
                  city: finalShippingAddress.city,
                  state: finalShippingAddress.state,
                  country: finalShippingAddress.country,
                  isComplete: true
                });
              }
            }
            
            // Calculate auto-completion dates
            const now = new Date();
            const autoCompletionEligibleAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
            const autoCompletionScheduledAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

            // Pre-fetch seller username for listing snapshot
            let sellerUsernameForSnapshot: string | null = null;
            try {
              const sellerDocSnap = await firestoreDb.collection('users').doc(sellerId).get();
              const sellerDataForSnapshot = sellerDocSnap.data();
              if (sellerDataForSnapshot) {
                sellerUsernameForSnapshot = sellerDataForSnapshot.displayName || sellerDataForSnapshot.username || null;
              }
            } catch (e) {
              console.error('[Stripe Webhook] Error fetching seller for snapshot:', e);
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
              paymentStatus: 'paid',
              ...(paymentMethod && { paymentMethod }),
              autoCompletionEligibleAt: autoCompletionEligibleAt,
              autoCompletionScheduledAt: autoCompletionScheduledAt,
              createdAt: new Date(),
              updatedAt: new Date(),
              // Include offer price if available
              ...(offerPrice && { offerPrice }),
              // Use the determined best shipping address
              shippingAddress: finalShippingAddress,
              // Add tracking requirement flag
              trackingRequired: true,
              // Add the listing snapshot for display in the orders page
              listingSnapshot: {
                title: listingData.title || 'Untitled Listing',
                description: listingData.description || '',
                price: listingData.price || 0,
                imageUrl: listingData.imageUrls && listingData.imageUrls.length > 0 ? listingData.imageUrls[0] : null,
                images: Array.isArray(listingData.imageUrls) ? listingData.imageUrls : [],
                attributes: listingData.attributes || {},
                game: listingData.game || null,
                category: listingData.category || null,
                condition: listingData.condition || null,
                shippingTerms: {
                  shippingCost: typeof listingData.shippingCost === 'number' ? listingData.shippingCost : null,
                  isPickup: !!listingData.isPickup,
                  shippingMethod: listingData.shippingMethod || null,
                  shippingNotes: listingData.shippingNotes || null,
                },
                sellerUsername: sellerUsernameForSnapshot
              }
            };

            console.log('[Stripe Webhook] Order data prepared with shipping address:', {
              listingId,
              buyerId,
              sellerId,
              hasShippingAddress: !!orderData.shippingAddress,
              shippingName: orderData.shippingAddress?.name,
              shippingCity: orderData.shippingAddress?.city,
              shippingState: orderData.shippingAddress?.state,
              shippingSource: shippingFromPaymentIntent ? 'payment_intent' : (session.shipping ? 'session' : 'none'),
              sessionShippingData: session.shipping ? {
                name: session.shipping.name,
                address: session.shipping.address
              } : 'No shipping data in session',
              paymentIntentShippingData: shippingFromPaymentIntent ? 'Present' : 'Missing'
            });

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
                
                // Update the existing order with any new information including shipping address
                const updateData: any = {
                  updatedAt: new Date(),
                  paymentIntentId: paymentIntentId, // Ensure payment intent is updated
                  status: 'awaiting_shipping', // Keep status as awaiting_shipping for consistency
                  ...(paymentMethod && { paymentMethod })
                };

                // Add shipping address if we have it
                if (finalShippingAddress) {
                  updateData.shippingAddress = finalShippingAddress;
                  console.log('[Stripe Webhook] Adding shipping address to existing order:', {
                    orderId: existingOrder.id,
                    shippingName: finalShippingAddress.name,
                    shippingCity: finalShippingAddress.city,
                    shippingState: finalShippingAddress.state
                  });
                }

                await orderRef.update(updateData);
                console.log('[Stripe Webhook] Updated existing order with shipping address:', {
                  orderId: existingOrder.id,
                  hasShippingAddress: !!updateData.shippingAddress
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

            // Send email notifications and create in-app notifications
            try {
              // Get buyer and seller data for notifications
              const [buyerDoc, sellerDoc] = await Promise.all([
                firestoreDb.collection('users').doc(buyerId).get(),
                firestoreDb.collection('users').doc(sellerId).get()
              ]);

              const buyerData = buyerDoc.data();
              const sellerData = sellerDoc.data();

              if (buyerData && sellerData) {
                const orderNumber = orderRef.id.substring(0, 8).toUpperCase();
                const orderDate = new Date().toLocaleDateString();
                const shippingAddressFormatted = orderData.shippingAddress ? 
                  `${orderData.shippingAddress.name}\n${orderData.shippingAddress.line1}${orderData.shippingAddress.line2 ? '\n' + orderData.shippingAddress.line2 : ''}\n${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.postal_code}\n${orderData.shippingAddress.country}` : 
                  'No shipping address provided';

                // Send order confirmation email to buyer
                if (buyerData.email) {
                  await emailService.sendOrderConfirmationEmail({
                    userName: buyerData.displayName || buyerData.username || 'User',
                    userEmail: buyerData.email,
                    orderNumber: orderNumber,
                    orderDate: orderDate,
                    cardName: listingData.title || 'Trading Card',
                    setName: listingData.game || 'Unknown Set',
                    condition: listingData.condition || 'Unknown',
                    quantity: 1,
                    price: (orderData.amount - (orderData.platformFee || 0)).toFixed(2),
                    sellerName: sellerData.displayName || sellerData.username || 'Seller',
                    sellerLocation: sellerData.location || 'Unknown Location',
                    subtotal: (orderData.amount - (orderData.platformFee || 0)).toFixed(2),
                    shipping: '0.00', // Assuming free shipping for now
                    fee: (orderData.platformFee || 0).toFixed(2),
                    total: orderData.amount.toFixed(2),
                    shippingAddress: shippingAddressFormatted,
                    orderId: orderRef.id
                  });
                  console.log('[Stripe Webhook] Order confirmation email sent to buyer:', buyerData.email);
                }

                // Send payment confirmation email to buyer
                if (buyerData.email && orderData.paymentMethod) {
                  await emailService.sendPaymentConfirmationEmail({
                    userName: buyerData.displayName || buyerData.username || 'User',
                    userEmail: buyerData.email,
                    transactionId: orderData.paymentIntentId || orderData.paymentSessionId,
                    paymentMethod: `${orderData.paymentMethod.brand?.toUpperCase()} ending in ${orderData.paymentMethod.last4}`,
                    amount: orderData.amount.toFixed(2),
                    paymentDate: orderDate,
                    orderId: orderRef.id
                  });
                  console.log('[Stripe Webhook] Payment confirmation email sent to buyer:', buyerData.email);
                }

                // Create in-app notification for buyer about new order
                const { notificationService } = await import('@/lib/notification-service');
                await notificationService.createNotification({
                  userId: buyerId,
                  type: 'order_update',
                  title: '🛒 Order Confirmed!',
                  message: `Your order for "${listingData.title}" has been confirmed and is awaiting shipment.`,
                  data: {
                    orderId: orderRef.id,
                    actionUrl: `/dashboard/orders/${orderRef.id}`
                  }
                });
                console.log('[Stripe Webhook] In-app notification created for buyer:', buyerId);

                // Create in-app notification for seller about new sale
                await notificationService.createNotification({
                  userId: sellerId,
                  type: 'sale',
                  title: '🎉 New Sale!',
                  message: `${buyerData.displayName || buyerData.username || 'A buyer'} purchased your "${listingData.title}" for $${orderData.amount.toFixed(2)}`,
                  data: {
                    orderId: orderRef.id,
                    listingId: listingId,
                    actionUrl: `/dashboard/orders/${orderRef.id}`
                  }
                });
                console.log('[Stripe Webhook] In-app notification created for seller:', sellerId);

                // Send sale notification email to seller
                if (sellerData.email) {
                  await emailService.sendEmailNotification({
                    userId: sellerId,
                    userEmail: sellerData.email,
                    userName: sellerData.displayName || sellerData.username || 'User',
                    type: 'sale',
                    title: '🎉 New Sale!',
                    message: `${buyerData.displayName || buyerData.username || 'A buyer'} purchased your "${listingData.title}" for $${orderData.amount.toFixed(2)}. Please prepare the item for shipment.`,
                    actionUrl: `/dashboard/orders/${orderRef.id}`,
                    data: {
                      orderId: orderRef.id,
                      listingId: listingId,
                      buyerName: buyerData.displayName || buyerData.username || 'Buyer',
                      amount: orderData.amount
                    }
                  });
                  console.log('[Stripe Webhook] Sale notification email sent to seller:', sellerData.email);
                }
              }
            } catch (notificationError) {
              console.error('[Stripe Webhook] Error sending notifications:', notificationError);
              // Don't throw error - order was created successfully, notifications are secondary
            }
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
            
            // Get payment method details if available
            let paymentMethod = null;
            if (paymentIntent.payment_method) {
              try {
                const paymentMethodDetails = await stripe.paymentMethods.retrieve(
                  paymentIntent.payment_method as string
                );
                
                if (paymentMethodDetails.card) {
                  paymentMethod = {
                    brand: paymentMethodDetails.card.brand,
                    last4: paymentMethodDetails.card.last4,
                    exp_month: paymentMethodDetails.card.exp_month,
                    exp_year: paymentMethodDetails.card.exp_year
                  };
                  
                  console.log('[Stripe Webhook] Retrieved payment method details:', {
                    brand: paymentMethodDetails.card.brand,
                    last4: paymentMethodDetails.card.last4
                  });
                }
              } catch (error) {
                console.error('[Stripe Webhook] Error retrieving payment method:', error);
              }
            }
            
            await orderDoc.ref.update({
              transferId: paymentIntent.transfer_data.destination,
              transferAmount: paymentIntent.amount - (paymentIntent.application_fee_amount || 0),
              paymentStatus: 'succeeded',
              ...(paymentMethod && { paymentMethod }),
              updatedAt: new Date()
            });
            
            console.log('[Stripe Webhook] Order updated with transfer information:', {
              orderId: orderDoc.id,
              transferId: paymentIntent.transfer_data.destination,
              hasPaymentMethod: !!paymentMethod
            });
          }
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        
        console.log('[Stripe Webhook] Account updated event received:', {
          accountId: account.id,
          detailsSubmitted: account.details_submitted,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled
        });
        
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
          } else if (account.details_submitted) {
            status = 'pending';
          }
          
          const updateData = {
            stripeConnectStatus: status,
            stripeConnectDetailsSubmitted: account.details_submitted || false,
            stripeConnectChargesEnabled: account.charges_enabled || false,
            stripeConnectPayoutsEnabled: account.payouts_enabled || false,
            stripeConnectUpdatedAt: new Date()
          };
          
          await userDoc.ref.update(updateData);
          
          console.log('[Stripe Webhook] User Connect account updated:', {
            userId,
            accountId: account.id,
            status,
            updateData
          });
        } else {
          console.log('[Stripe Webhook] No user found for Connect account:', account.id);
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

        // Add subscription history event
        try {
          if (event.type === 'customer.subscription.created') {
            await subscriptionHistoryService.addSubscriptionCreated(
              userId,
              subscription.id,
              'premium'
            );
          } else {
            // For subscription updates
            if (cancelAtPeriodEnd && !canceledAt) {
              // Subscription was just set to cancel at period end
              await subscriptionHistoryService.addSubscriptionCanceled(
                userId,
                subscription.id,
                currentPeriodEnd
              );
            } else {
              await subscriptionHistoryService.addSubscriptionUpdated(
                userId,
                subscription.id,
                subscriptionStatus,
                {
                  cancelAtPeriodEnd,
                  endDate: currentPeriodEnd,
                  renewalDate: currentPeriodEnd
                }
              );
            }
          }
          console.log('[Stripe Webhook] Added subscription history event');
        } catch (historyError) {
          console.error('[Stripe Webhook] Error adding subscription history:', historyError);
        }
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

          // Send subscription canceled email
          try {
            const userDoc = await firestoreDb.collection('users').doc(userId).get();
            const userData = userDoc.data();
            
            if (userData && userData.email) {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
              await emailService.sendSubscriptionCanceledEmail({
                userName: userData.displayName || userData.username || 'User',
                userEmail: userData.email,
                planName: 'Premium',
                endDate: endDate.toLocaleDateString(),
                actionUrl: `${baseUrl}/dashboard/settings`
              });
              console.log('[Stripe Webhook] Subscription canceled email sent to:', userData.email);
            }
          } catch (emailError) {
            console.error('[Stripe Webhook] Error sending subscription canceled email:', emailError);
          }
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

        // Add subscription history event
        try {
          await subscriptionHistoryService.addSubscriptionCanceled(
            userId,
            subscription.id,
            endDateIso
          );
          console.log('[Stripe Webhook] Added subscription deleted event to history');
        } catch (historyError) {
          console.error('[Stripe Webhook] Error adding subscription deletion history:', historyError);
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

        // Add subscription history event
        try {
          await subscriptionHistoryService.addPaymentFailed(
            userId,
            invoice.amount_due || 0,
            invoice.id
          );
          console.log('[Stripe Webhook] Added payment failed event to history');
        } catch (historyError) {
          console.error('[Stripe Webhook] Error adding payment failed history:', historyError);
        }

        // Send subscription payment failed email
        try {
          const userDoc = await firestoreDb.collection('users').doc(userId).get();
          const userData = userDoc.data();
          
          if (userData && userData.email) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
            const retryDate = new Date();
            retryDate.setDate(retryDate.getDate() + 3); // Retry in 3 days
            
            await emailService.sendSubscriptionFailedEmail({
              userName: userData.displayName || userData.username || 'User',
              userEmail: userData.email,
              planName: 'Premium',
              amount: invoice.amount_due ? invoice.amount_due / 100 : 9.99,
              retryDate: retryDate.toLocaleDateString(),
              actionUrl: `${baseUrl}/dashboard/settings`
            });
            console.log('[Stripe Webhook] Subscription payment failed email sent to:', userData.email);
          }
        } catch (emailError) {
          console.error('[Stripe Webhook] Error sending subscription payment failed email:', emailError);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = invoice.subscription as string;
        
        // Only process subscription invoices (not one-time payments)
        if (subscription) {
          // Get the subscription to find the user ID
          const subDetails = await stripe.subscriptions.retrieve(subscription);
          const userId = subDetails.metadata.userId;

          if (!userId) {
            console.log('[Stripe Webhook] No userId found in subscription metadata for payment succeeded');
            break;
          }

          // Only send email for recurring charges (not the initial payment)
          if (invoice.billing_reason === 'subscription_cycle') {
            console.log('[Stripe Webhook] Processing recurring subscription charge:', {
              userId,
              subscriptionId: subscription,
              amount: invoice.amount_paid / 100
            });

            // Add subscription history event for successful payment
            try {
              // Get payment method details if available
              let cardDetails = undefined;
              if (invoice.payment_intent) {
                try {
                  const paymentIntent = await stripe.paymentIntents.retrieve(
                    invoice.payment_intent as string,
                    { expand: ['payment_method'] }
                  );
                  
                  if (paymentIntent.payment_method && typeof paymentIntent.payment_method !== 'string') {
                    const pm = paymentIntent.payment_method;
                    if (pm.card) {
                      cardDetails = {
                        brand: pm.card.brand,
                        last4: pm.card.last4
                      };
                    }
                  }
                } catch (pmError) {
                  console.error('[Stripe Webhook] Error fetching payment method for history:', pmError);
                }
              }

              await subscriptionHistoryService.addPaymentSucceeded(
                userId,
                invoice.amount_paid,
                cardDetails,
                invoice.id
              );
              console.log('[Stripe Webhook] Added payment succeeded event to history');
            } catch (historyError) {
              console.error('[Stripe Webhook] Error adding payment succeeded history:', historyError);
            }

            // Send subscription charge email
            try {
              const userDoc = await firestoreDb.collection('users').doc(userId).get();
              const userData = userDoc.data();
              
              if (userData && userData.email) {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
                const nextBillingDate = new Date(subDetails.current_period_end * 1000);
                
                await emailService.sendSubscriptionChargeEmail({
                  userName: userData.displayName || userData.username || 'User',
                  userEmail: userData.email,
                  amount: invoice.amount_paid / 100,
                  planName: 'Premium',
                  billingPeriod: 'Monthly',
                  nextBillingDate: nextBillingDate.toLocaleDateString(),
                  actionUrl: `${baseUrl}/dashboard/settings`
                });
                console.log('[Stripe Webhook] Subscription charge email sent to:', userData.email);
              }
            } catch (emailError) {
              console.error('[Stripe Webhook] Error sending subscription charge email:', emailError);
            }
          }
        }
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing webhook:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
}