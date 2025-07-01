import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin
    getFirebaseAdmin();
    const db = getFirestore();

    // Get recent webhook logs from Firestore (if we're storing them)
    // For now, let's check recent orders and their webhook processing status
    const ordersSnapshot = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const orders = ordersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        listingId: data.listingId,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        amount: data.amount,
        status: data.status,
        paymentSessionId: data.paymentSessionId,
        paymentIntentId: data.paymentIntentId,
        hasShippingAddress: !!data.shippingAddress,
        shippingAddress: data.shippingAddress,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
      };
    });

    // Check webhook configuration
    const webhookConfig = {
      webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      webhookEndpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/webhook`
    };

    return res.status(200).json({
      webhookConfig,
      recentOrders: orders,
      analysis: {
        totalOrders: orders.length,
        ordersWithShipping: orders.filter(o => o.hasShippingAddress).length,
        ordersWithoutShipping: orders.filter(o => !o.hasShippingAddress).length,
        ordersWithPaymentSession: orders.filter(o => o.paymentSessionId).length,
        ordersWithPaymentIntent: orders.filter(o => o.paymentIntentId).length
      }
    });

  } catch (error) {
    console.error('Error testing webhook configuration:', error);
    return res.status(500).json({ 
      error: 'Failed to test webhook configuration',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}