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
    const { orderId, userId, email } = req.body;

    if (!orderId || !userId || !email) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log(`[create-pending-order-session] Processing payment for order: ${orderId}, user: ${userId}`);

    // Initialize Firebase Admin
    getFirebaseAdmin();
    const db = getFirestore();

    // Get the order data
    const orderDoc = await db.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      console.error(`[create-pending-order-session] Order not found: ${orderId}`);
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data();
    
    // Verify the buyer is the one making the request
    if (orderData.buyerId !== userId) {
      console.error(`[create-pending-order-session] Unauthorized access: ${userId} is not the buyer of order ${orderId}`);
      return res.status(403).json({ error: 'Unauthorized access to this order' });
    }

    // Verify the order is in pending status
    if (orderData.status !== 'pending') {
      console.error(`[create-pending-order-session] Order is not in pending status: ${orderData.status}`);
      return res.status(400).json({ error: 'Order is not in pending status' });
    }

    // Verify the order has shipping information
    if (!orderData.shippingAddress) {
      console.error(`[create-pending-order-session] Order does not have shipping information`);
      return res.status(400).json({ error: 'Shipping information is required before payment' });
    }

    // Get the seller's Stripe Connect account ID
    const sellerDoc = await db.collection('users').doc(orderData.sellerId).get();
    const sellerData = sellerDoc.data();

    if (!sellerData?.stripeConnectAccountId) {
      console.error(`[create-pending-order-session] Seller has no Stripe Connect account: ${orderData.sellerId}`);
      return res.status(400).json({ 
        error: 'Seller has not set up their payment account yet',
        code: 'seller_not_connected'
      });
    }

    // Check if the seller's account is fully onboarded
    if (sellerData.stripeConnectStatus !== 'active') {
      console.error(`[create-pending-order-session] Seller's Stripe account is not active: ${sellerData.stripeConnectStatus}`);
      return res.status(400).json({ 
        error: 'Seller\'s payment account is not fully set up yet',
        code: 'seller_not_active'
      });
    }

    // Get shipping cost from the original listing
    let shippingCost = 0;
    if (orderData.listingId) {
      const listingDoc = await db.collection('listings').doc(orderData.listingId).get();
      if (listingDoc.exists) {
        const listingData = listingDoc.data();
        shippingCost = listingData.shippingCost || 0;
      }
    }

    // Calculate total amount including shipping
    const offerPrice = orderData.offerPrice || orderData.amount;
    const totalAmount = offerPrice + shippingCost;
    const amount = Math.round(totalAmount * 100); // Convert to cents
    const platformFee = Math.round(amount * (PLATFORM_FEE_PERCENTAGE / 100));

    console.log(`[create-pending-order-session] Creating checkout session for offer: ${offerPrice}, shipping: ${shippingCost}, total: ${totalAmount}, platform fee: ${platformFee}`);

    // Create line items - separate offer and shipping if shipping cost exists
    const lineItems = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: orderData.listingSnapshot?.title || `Order #${orderId.slice(0, 8)}`,
            images: orderData.listingSnapshot?.imageUrl 
              ? [orderData.listingSnapshot.imageUrl] 
              : [],
            description: `Payment for pending order #${orderId.slice(0, 8)}`,
          },
          unit_amount: Math.round(offerPrice * 100),
        },
        quantity: 1,
      },
    ];

    // Add shipping as a separate line item if there's a shipping cost
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Shipping',
            description: 'Shipping and handling',
          },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      });
    }

    // Create Stripe checkout session with Connect
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
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
          shippingCost: shippingCost.toString(),
          offerPrice: offerPrice.toString(),
          totalAmount: totalAmount.toString(),
          isPendingOrderPayment: 'true',
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
        shippingCost: shippingCost.toString(),
        offerPrice: offerPrice.toString(),
        totalAmount: totalAmount.toString(),
        isPendingOrderPayment: 'true',
      },
      customer_email: email,
    });

    console.log(`[create-pending-order-session] Checkout session created: ${session.id}`);

    // Update the order with payment session info
    await db.collection('orders').doc(orderId).update({
      paymentSessionId: session.id,
      paymentStatus: 'pending',
      updatedAt: new Date(),
    });

    return res.status(200).json({ sessionId: session.id });
  } catch (error: any) {
    console.error('Error creating checkout session for pending order:', error);
    res.status(500).json({ 
      error: error.message || 'Error creating checkout session',
      code: error.code || 'unknown_error'
    });
  }
}