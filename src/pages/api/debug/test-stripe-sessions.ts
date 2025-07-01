import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

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

    // Get recent checkout sessions from Stripe
    const sessions = await stripe.checkout.sessions.list({
      limit: 20,
      expand: ['data.payment_intent']
    });

    // Get recent orders from Firestore for comparison
    const ordersSnapshot = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
    }));

    // Analyze sessions
    const sessionAnalysis = sessions.data.map(session => {
      const matchingOrder = orders.find(order => order.paymentSessionId === session.id);
      
      return {
        sessionId: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        hasShipping: !!session.shipping,
        shippingData: session.shipping ? {
          name: session.shipping.name,
          address: session.shipping.address
        } : null,
        shippingAddressCollection: session.shipping_address_collection,
        metadata: session.metadata,
        matchingOrderId: matchingOrder?.id || null,
        orderHasShipping: matchingOrder ? !!matchingOrder.shippingAddress : null,
        orderShippingData: matchingOrder?.shippingAddress || null,
        created: new Date(session.created * 1000).toISOString()
      };
    });

    // Summary statistics
    const completedSessions = sessionAnalysis.filter(s => s.status === 'complete');
    const sessionsWithShipping = completedSessions.filter(s => s.hasShipping);
    const sessionsWithoutShipping = completedSessions.filter(s => !s.hasShipping);
    const sessionsWithShippingCollection = sessionAnalysis.filter(s => s.shippingAddressCollection);

    const summary = {
      totalSessions: sessions.data.length,
      completedSessions: completedSessions.length,
      sessionsWithShipping: sessionsWithShipping.length,
      sessionsWithoutShipping: sessionsWithoutShipping.length,
      sessionsWithShippingCollection: sessionsWithShippingCollection.length,
      percentageWithShipping: completedSessions.length > 0 
        ? Math.round((sessionsWithShipping.length / completedSessions.length) * 100) 
        : 0
    };

    return res.status(200).json({
      summary,
      sessions: sessionAnalysis,
      recentOrders: orders.slice(0, 10)
    });

  } catch (error) {
    console.error('Error analyzing Stripe sessions:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze Stripe sessions',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}