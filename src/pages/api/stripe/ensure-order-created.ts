import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Ensure Order Created] Request received:', {
    method: req.method,
    query: req.query,
    body: req.body
  });

  if (req.method !== 'POST') {
    console.log('[Ensure Order Created] Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      console.error('[Ensure Order Created] Missing session ID');
      return res.status(400).json({
        error: 'Missing session ID',
        message: 'Session ID is required'
      });
    }

    // Initialize Firebase Admin
    getFirebaseAdmin();
    const firestoreDb = getFirestore();

    // First check if an order with this payment session already exists
    const existingOrdersQuery = await firestoreDb.collection('orders')
      .where('paymentSessionId', '==', sessionId)
      .limit(1)
      .get();
    
    if (!existingOrdersQuery.empty) {
      const existingOrder = existingOrdersQuery.docs[0];
      console.log('[Ensure Order Created] Order already exists for this session:', {
        orderId: existingOrder.id,
        paymentSessionId: sessionId
      });
      
      return res.status(200).json({ 
        success: true,
        message: 'Order already exists',
        orderId: existingOrder.id,
        orderData: existingOrder.data()
      });
    }

    // If no order exists, retrieve the checkout session from Stripe
    console.log('[Ensure Order Created] No order found, retrieving checkout session:', sessionId);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'payment_intent']
    });

    if (!session) {
      console.error('[Ensure Order Created] Session not found:', sessionId);
      return res.status(404).json({
        error: 'Session not found',
        message: 'Could not find the checkout session'
      });
    }

    // Check if this is a marketplace purchase (has listingId, buyerId, sellerId in metadata)
    if (!session.metadata?.listingId || !session.metadata?.buyerId || !session.metadata?.sellerId) {
      console.error('[Ensure Order Created] Not a marketplace purchase session:', {
        sessionId,
        metadata: session.metadata
      });
      return res.status(400).json({
        error: 'Not a marketplace purchase',
        message: 'This session is not for a marketplace purchase'
      });
    }

    // Check if the payment was successful
    if (session.payment_status !== 'paid') {
      console.error('[Ensure Order Created] Payment not completed:', {
        sessionId,
        paymentStatus: session.payment_status
      });
      return res.status(400).json({
        error: 'Payment not completed',
        message: 'The payment has not been completed yet'
      });
    }

    // Extract the necessary data
    const { listingId, buyerId, sellerId } = session.metadata;
    const paymentIntentId = session.payment_intent as string;

    console.log('[Ensure Order Created] Creating order for successful checkout:', {
      sessionId,
      listingId,
      buyerId,
      sellerId,
      paymentIntentId
    });

    // Update the listing status to sold if it's not already
    const listingRef = firestoreDb.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      console.error('[Ensure Order Created] Listing not found:', listingId);
      return res.status(404).json({
        error: 'Listing not found',
        message: 'The listing associated with this purchase could not be found'
      });
    }

    const listingData = listingDoc.data();
    
    // Only update if the listing is not already sold
    if (listingData?.status !== 'sold') {
      await listingRef.update({
        status: 'sold',
        soldAt: new Date(),
        soldTo: buyerId,
        paymentSessionId: sessionId,
        paymentIntentId: paymentIntentId,
        updatedAt: new Date()
      });
      
      console.log('[Ensure Order Created] Listing marked as sold:', {
        listingId,
        status: 'sold',
        soldTo: buyerId
      });
    } else {
      console.log('[Ensure Order Created] Listing already marked as sold:', {
        listingId,
        status: listingData.status
      });
    }

    // Check if this order came from an accepted offer
    let offerPrice = null;
    if (session.metadata?.offerId) {
      try {
        const offerDoc = await firestoreDb.collection('offers').doc(session.metadata.offerId).get();
        if (offerDoc.exists) {
          const offerData = offerDoc.data();
          offerPrice = offerData.amount;
          console.log(`[Ensure Order Created] Found offer price: ${offerPrice} for offer ID: ${session.metadata.offerId}`);
        }
      } catch (err) {
        console.error('[Ensure Order Created] Error fetching offer data:', err);
      }
    }

    // Extract shipping address using the same comprehensive logic as webhook
    let shippingFromPaymentIntent = null;
    let shippingFromSession = null;
    let billingFromSession = null;
    let finalShippingAddress = null;
    
    console.log('[Ensure Order Created] Starting shipping address extraction:', {
      sessionId,
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
      console.log('[Ensure Order Created] ✅ Retrieved shipping address from session:', {
        name: session.shipping.name,
        city: session.shipping.address.city,
        state: session.shipping.address.state,
        line1: session.shipping.address.line1
      });
    } else {
      console.log('[Ensure Order Created] ❌ No shipping address found in session');
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
      console.log('[Ensure Order Created] ✅ Retrieved billing address from session as potential shipping fallback:', {
        name: session.customer_details.name,
        city: session.customer_details.address.city,
        state: session.customer_details.address.state,
        line1: session.customer_details.address.line1
      });
    } else {
      console.log('[Ensure Order Created] ❌ No billing address found in session customer details');
    }
    
    // Try to get shipping from payment intent
    if (paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['payment_method']
        });
        
        console.log('[Ensure Order Created] Retrieved payment intent:', {
          id: paymentIntent.id,
          hasShipping: !!paymentIntent.shipping,
          shippingDetails: paymentIntent.shipping ? {
            name: paymentIntent.shipping.name,
            address: paymentIntent.shipping.address
          } : null
        });

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
          console.log('[Ensure Order Created] ✅ Retrieved shipping address from payment intent:', {
            name: paymentIntent.shipping.name,
            city: paymentIntent.shipping.address.city,
            state: paymentIntent.shipping.address.state,
            line1: paymentIntent.shipping.address.line1
          });
        } else {
          console.log('[Ensure Order Created] ❌ No shipping address found in payment intent');
        }
      } catch (error) {
        console.error('[Ensure Order Created] Error retrieving payment intent details:', error);
      }
    }

    // Determine the best shipping address source
    // Priority: 1) Payment intent shipping, 2) Session shipping, 3) Billing address as shipping fallback
    if (shippingFromPaymentIntent) {
      finalShippingAddress = shippingFromPaymentIntent;
      console.log('[Ensure Order Created] 🎯 Using shipping address from payment intent (most reliable):', {
        source: 'payment_intent',
        name: shippingFromPaymentIntent.name,
        city: shippingFromPaymentIntent.city,
        state: shippingFromPaymentIntent.state
      });
    } else if (shippingFromSession) {
      finalShippingAddress = shippingFromSession;
      console.log('[Ensure Order Created] 🎯 Using shipping address from session (fallback):', {
        source: 'session_shipping',
        name: shippingFromSession.name,
        city: shippingFromSession.city,
        state: shippingFromSession.state
      });
    } else if (billingFromSession) {
      finalShippingAddress = billingFromSession;
      console.log('[Ensure Order Created] 🎯 Using billing address as shipping address (final fallback):', {
        source: 'billing_as_shipping',
        name: billingFromSession.name,
        city: billingFromSession.city,
        state: billingFromSession.state
      });
    } else {
      console.log('[Ensure Order Created] ❌ CRITICAL: No shipping or billing address found');
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
        console.warn('[Ensure Order Created] ⚠️ Shipping address is incomplete, missing required fields:', {
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
        console.log('[Ensure Order Created] ❌ Setting finalShippingAddress to null due to incomplete data');
      } else {
        console.log('[Ensure Order Created] ✅ Final shipping address validated successfully:', {
          name: finalShippingAddress.name,
          city: finalShippingAddress.city,
          state: finalShippingAddress.state,
          country: finalShippingAddress.country,
          isComplete: true
        });
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
      paymentSessionId: sessionId,
      paymentIntentId: paymentIntentId,
      paymentStatus: 'paid',
      trackingRequired: true, // Set tracking as required by default
      createdAt: new Date(),
      updatedAt: new Date(),
      // Include offer price if available
      ...(offerPrice && { offerPrice }),
      // Use the determined best shipping address
      shippingAddress: finalShippingAddress,
      // Add the listing snapshot for display in the orders page
      listingSnapshot: {
        title: listingData.title || 'Untitled Listing',
        price: listingData.price || 0,
        imageUrl: listingData.imageUrls && listingData.imageUrls.length > 0 ? listingData.imageUrls[0] : null
      }
    };

    console.log('[Ensure Order Created] Order data prepared with shipping address:', {
      listingId,
      buyerId,
      sellerId,
      hasShippingAddress: !!orderData.shippingAddress,
      shippingName: orderData.shippingAddress?.name,
      shippingCity: orderData.shippingAddress?.city,
      shippingState: orderData.shippingAddress?.state,
      shippingSource: shippingFromPaymentIntent ? 'payment_intent' : (shippingFromSession ? 'session' : (billingFromSession ? 'billing' : 'none'))
    });
    
    // Create the order in Firestore
    console.log('[Ensure Order Created] Creating order with data:', {
      listingId,
      buyerId,
      sellerId,
      amount: orderData.amount,
      paymentSessionId: sessionId
    });
    
    const orderRef = await firestoreDb.collection('orders').add(orderData);
    
    console.log('[Ensure Order Created] Order created successfully:', {
      orderId: orderRef.id,
      path: `orders/${orderRef.id}`
    });
    
    // Add the order to the buyer's orders
    await firestoreDb.collection('users').doc(buyerId).collection('orders').doc(orderRef.id).set({
      orderId: orderRef.id,
      role: 'buyer',
      createdAt: new Date()
    });
    
    // Add the order to the seller's orders
    await firestoreDb.collection('users').doc(sellerId).collection('orders').doc(orderRef.id).set({
      orderId: orderRef.id,
      role: 'seller',
      createdAt: new Date()
    });
    
    console.log('[Ensure Order Created] Order creation completed successfully:', {
      orderId: orderRef.id,
      listingId,
      buyerId,
      sellerId
    });
    
    return res.status(200).json({ 
      success: true,
      message: 'Order created successfully',
      orderId: orderRef.id
    });
  } catch (error) {
    console.error('[Ensure Order Created] Error processing request:', error);
    return res.status(500).json({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}