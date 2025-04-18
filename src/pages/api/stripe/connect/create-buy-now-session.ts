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

// Platform fee percentage (10%)
const PLATFORM_FEE_PERCENTAGE = 10;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { listingId, userId, email, orderId, offerPrice, shippingAddress } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Initialize Firebase Admin
    getFirebaseAdmin();
    const db = getFirestore();

    // If we have an orderId, this is for an accepted offer with shipping info
    if (orderId) {
      // Get the order data
      const orderDoc = await db.collection('orders').doc(orderId).get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const orderData = orderDoc.data();
      
      // Verify the buyer is the one making the request
      if (orderData.buyerId !== userId) {
        return res.status(403).json({ error: 'Unauthorized access to this order' });
      }

      // Get the seller's Stripe Connect account ID
      const sellerDoc = await db.collection('users').doc(orderData.sellerId).get();
      const sellerData = sellerDoc.data();

      if (!sellerData?.stripeConnectAccountId) {
        return res.status(400).json({ 
          error: 'Seller has not set up their payment account yet',
          code: 'seller_not_connected'
        });
      }

      // Check if the seller's account is fully onboarded
      if (sellerData.stripeConnectStatus !== 'active') {
        return res.status(400).json({ 
          error: 'Seller\'s payment account is not fully set up yet',
          code: 'seller_not_active'
        });
      }

      // Calculate the platform fee (10% of the total amount)
      const amount = Math.round((orderData.offerPrice || orderData.amount) * 100); // Convert to cents
      const platformFee = Math.round(amount * (PLATFORM_FEE_PERCENTAGE / 100));

      // Create Stripe checkout session with Connect
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: orderData.listingSnapshot?.title || `Order #${orderId.slice(0, 8)}`,
                images: orderData.listingSnapshot?.imageUrl 
                  ? [orderData.listingSnapshot.imageUrl] 
                  : [],
                description: `Accepted offer for ${orderData.listingSnapshot?.title || 'item'}`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: platformFee,
          transfer_data: {
            destination: sellerData.stripeConnectAccountId,
          },
          metadata: {
            orderId,
            listingId: orderData.listingId,
            buyerId: userId,
            sellerId: orderData.sellerId,
            platformFee,
            isOfferPayment: 'true',
          },
        },
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders?success=true&session_id={CHECKOUT_SESSION_ID}&ensure_order=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders/${orderId}?canceled=true`,
        metadata: {
          orderId,
          listingId: orderData.listingId,
          buyerId: userId,
          sellerId: orderData.sellerId,
          platformFee,
          isOfferPayment: 'true',
        },
        shipping_address_collection: shippingAddress ? undefined : {
          allowed_countries: ['US'],
        },
        customer_email: email,
      });

      // Update the order with payment session info
      await db.collection('orders').doc(orderId).update({
        paymentSessionId: session.id,
        paymentStatus: 'pending',
        updatedAt: new Date(),
      });

      return res.status(200).json({ sessionId: session.id });
    } 
    // Regular buy now flow for a listing
    else if (listingId) {
      // Get the listing data
      const listingDoc = await db.collection('listings').doc(listingId).get();
      
      if (!listingDoc.exists) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      const listingData = listingDoc.data();

      // Check if the listing is still available
      if (listingData.status === 'sold' || listingData.status === 'archived') {
        return res.status(400).json({ error: 'Listing is no longer available' });
      }

      // Get the seller's Stripe Connect account ID
      const sellerDoc = await db.collection('users').doc(listingData.userId).get();
      const sellerData = sellerDoc.data();

      if (!sellerData?.stripeConnectAccountId) {
        return res.status(400).json({ 
          error: 'Seller has not set up their payment account yet',
          code: 'seller_not_connected'
        });
      }

      // Check if the seller's account is fully onboarded
      if (sellerData.stripeConnectStatus !== 'active') {
        return res.status(400).json({ 
          error: 'Seller\'s payment account is not fully set up yet',
          code: 'seller_not_active'
        });
      }

      // Calculate the platform fee (10% of the total amount)
      const amount = Math.round(listingData.price * 100); // Convert to cents
      const platformFee = Math.round(amount * (PLATFORM_FEE_PERCENTAGE / 100));

      // Create Stripe checkout session with Connect
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: listingData.title,
                images: listingData.imageUrls && listingData.imageUrls.length > 0 
                  ? [listingData.imageUrls[0]] 
                  : [],
                description: listingData.description || undefined,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: platformFee,
          transfer_data: {
            destination: sellerData.stripeConnectAccountId,
          },
          metadata: {
            listingId,
            buyerId: userId,
            sellerId: listingData.userId,
            platformFee,
          },
        },
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders?success=true&session_id={CHECKOUT_SESSION_ID}&ensure_order=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/listings/${listingId}?canceled=true`,
        metadata: {
          listingId,
          buyerId: userId,
          sellerId: listingData.userId,
          platformFee,
        },
        shipping_address_collection: {
          allowed_countries: ['US'],
        },
        customer_email: email,
      });

      return res.status(200).json({ sessionId: session.id });
    } else {
      return res.status(400).json({ error: 'Either listingId or orderId is required' });
    }
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      error: error.message || 'Error creating checkout session',
      code: error.code || 'unknown_error'
    });
  }
}