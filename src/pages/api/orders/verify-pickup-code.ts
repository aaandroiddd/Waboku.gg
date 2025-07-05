import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

type ResponseData = {
  success: boolean;
  message: string;
  orderDetails?: {
    orderId: string;
    listingTitle: string;
    sellerName?: string;
    amount?: number;
    pickupToken?: string;
  };
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { pickupCode, userId } = req.body;

    if (!pickupCode) {
      return res.status(400).json({ success: false, message: 'Pickup code is required' });
    }

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Validate pickup code format (6 digits)
    if (!/^\d{6}$/.test(pickupCode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid pickup code format. Must be 6 digits.' 
      });
    }

    console.log('[verify-pickup-code] Verifying code for user:', userId);

    // Get Firebase Admin services
    const { db } = getFirebaseAdmin();
    
    // Find the order with the matching pickup code
    const ordersQuery = db.collection('orders')
      .where('pickupCode', '==', pickupCode)
      .where('isPickup', '==', true)
      .where('pickupCompleted', '==', false)
      .limit(1);
    
    const querySnapshot = await ordersQuery.get();
    
    if (querySnapshot.empty) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid or expired pickup code' 
      });
    }
    
    const orderDoc = querySnapshot.docs[0];
    const orderData = orderDoc.data();
    const orderId = orderDoc.id;
    
    if (!orderData) {
      return res.status(500).json({ 
        success: false, 
        message: 'Invalid order data' 
      });
    }

    // Verify the user is the buyer for this order
    if (orderData.buyerId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'This pickup code is not for your order' 
      });
    }

    // Check if pickup is already completed
    if (orderData.pickupCompleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'Pickup has already been completed for this order' 
      });
    }

    // Check if code has expired (30 minutes)
    const codeCreatedAt = orderData.pickupCodeCreatedAt;
    if (codeCreatedAt) {
      const codeAge = Date.now() - (codeCreatedAt.seconds * 1000);
      const thirtyMinutes = 30 * 60 * 1000;
      
      if (codeAge > thirtyMinutes) {
        return res.status(400).json({ 
          success: false, 
          message: 'Pickup code has expired. Please ask the seller to generate a new one.' 
        });
      }
    }

    // Get seller information for display
    let sellerName = 'Unknown Seller';
    try {
      const sellerDoc = await db.collection('users').doc(orderData.sellerId).get();
      if (sellerDoc.exists) {
        const sellerData = sellerDoc.data();
        sellerName = sellerData?.displayName || sellerData?.username || 'Unknown Seller';
      }
    } catch (error) {
      console.error('[verify-pickup-code] Error fetching seller info:', error);
    }

    // Generate a pickup token for the final confirmation step
    // This ensures the buyer still needs to confirm after code verification
    const pickupToken = `pickup_${orderId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update the order with the pickup token for final confirmation
    try {
      const orderRef = db.collection('orders').doc(orderId);
      await orderRef.update({
        pickupToken: pickupToken,
        pickupTokenCreatedAt: new Date(),
        pickupTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        updatedAt: new Date()
      });
    } catch (updateError) {
      console.error('[verify-pickup-code] Error updating order with pickup token:', updateError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to process pickup code verification' 
      });
    }

    // Return order details for confirmation
    return res.status(200).json({
      success: true,
      message: 'Pickup code verified successfully. Please confirm the pickup details.',
      orderDetails: {
        orderId,
        listingTitle: orderData.listingSnapshot?.title || 'Unknown Item',
        sellerName,
        amount: orderData.amount,
        pickupToken: pickupToken
      }
    });

  } catch (error) {
    console.error('[verify-pickup-code] Unhandled error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}