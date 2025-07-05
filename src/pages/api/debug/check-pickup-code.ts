import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

type ResponseData = {
  success: boolean;
  message: string;
  debug?: any;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { pickupCode, orderId } = req.body;

    if (!pickupCode && !orderId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Either pickup code or order ID is required' 
      });
    }

    const { db } = getFirebaseAdmin();
    
    let debugInfo: any = {
      searchCriteria: {},
      foundOrders: [],
      timestamp: new Date().toISOString()
    };

    if (pickupCode) {
      // Search by pickup code
      debugInfo.searchCriteria.pickupCode = pickupCode;
      
      const ordersQuery = db.collection('orders')
        .where('pickupCode', '==', pickupCode)
        .limit(5);
      
      const querySnapshot = await ordersQuery.get();
      
      debugInfo.foundOrders = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          pickupCode: data.pickupCode,
          pickupCodeExpiresAt: data.pickupCodeExpiresAt ? {
            type: typeof data.pickupCodeExpiresAt,
            value: data.pickupCodeExpiresAt,
            toDate: data.pickupCodeExpiresAt.toDate ? data.pickupCodeExpiresAt.toDate().toISOString() : null,
            seconds: data.pickupCodeExpiresAt.seconds || null
          } : null,
          pickupCodeCreatedAt: data.pickupCodeCreatedAt ? {
            type: typeof data.pickupCodeCreatedAt,
            value: data.pickupCodeCreatedAt,
            toDate: data.pickupCodeCreatedAt.toDate ? data.pickupCodeCreatedAt.toDate().toISOString() : null,
            seconds: data.pickupCodeCreatedAt.seconds || null
          } : null,
          isPickup: data.isPickup,
          pickupCompleted: data.pickupCompleted,
          status: data.status,
          buyerId: data.buyerId,
          sellerId: data.sellerId
        };
      });
    }

    if (orderId) {
      // Search by order ID
      debugInfo.searchCriteria.orderId = orderId;
      
      const orderDoc = await db.collection('orders').doc(orderId).get();
      
      if (orderDoc.exists) {
        const data = orderDoc.data();
        debugInfo.specificOrder = {
          id: orderDoc.id,
          pickupCode: data?.pickupCode,
          pickupCodeExpiresAt: data?.pickupCodeExpiresAt ? {
            type: typeof data.pickupCodeExpiresAt,
            value: data.pickupCodeExpiresAt,
            toDate: data.pickupCodeExpiresAt.toDate ? data.pickupCodeExpiresAt.toDate().toISOString() : null,
            seconds: data.pickupCodeExpiresAt.seconds || null
          } : null,
          pickupCodeCreatedAt: data?.pickupCodeCreatedAt ? {
            type: typeof data.pickupCodeCreatedAt,
            value: data.pickupCodeCreatedAt,
            toDate: data.pickupCodeCreatedAt.toDate ? data.pickupCodeCreatedAt.toDate().toISOString() : null,
            seconds: data.pickupCodeCreatedAt.seconds || null
          } : null,
          isPickup: data?.isPickup,
          pickupCompleted: data?.pickupCompleted,
          status: data?.status,
          buyerId: data?.buyerId,
          sellerId: data?.sellerId
        };
      } else {
        debugInfo.specificOrder = null;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Debug information retrieved',
      debug: debugInfo
    });

  } catch (error) {
    console.error('[check-pickup-code] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}