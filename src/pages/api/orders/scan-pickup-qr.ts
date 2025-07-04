import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

type ResponseData = {
  success: boolean;
  message: string;
  orderDetails?: {
    orderId: string;
    listingTitle: string;
    sellerName?: string;
    amount?: number;
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
    const { qrData, userId } = req.body;

    if (!qrData) {
      return res.status(400).json({ success: false, message: 'QR code data is required' });
    }

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    console.log('[scan-pickup-qr] Processing QR scan for user:', userId);

    // Parse QR code data
    let parsedData;
    try {
      parsedData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch (parseError) {
      console.error('[scan-pickup-qr] Invalid QR code format:', parseError);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid QR code format' 
      });
    }

    // Validate QR code structure
    if (parsedData.type !== 'pickup_confirmation') {
      return res.status(400).json({ 
        success: false, 
        message: 'This QR code is not for pickup confirmation' 
      });
    }

    const { orderId, token, buyerId, sellerId, listingTitle } = parsedData;

    if (!orderId || !token || !buyerId || !sellerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid QR code: missing required information' 
      });
    }

    // Verify the user is the buyer for this order
    if (buyerId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'This QR code is not for your order' 
      });
    }

    // Get Firebase Admin services
    const { db } = getFirebaseAdmin();
    
    // Get the order document
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    const orderData = orderDoc.data();
    
    if (!orderData) {
      return res.status(500).json({ 
        success: false, 
        message: 'Invalid order data' 
      });
    }

    // Verify this is a pickup order
    if (!orderData.isPickup) {
      return res.status(400).json({ 
        success: false, 
        message: 'This is not a pickup order' 
      });
    }

    // Check if pickup is already completed
    if (orderData.pickupCompleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'Pickup has already been completed for this order' 
      });
    }

    // Verify the pickup token matches
    if (orderData.pickupToken !== token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired QR code' 
      });
    }

    // Check if token has expired (24 hours)
    const tokenCreatedAt = orderData.pickupTokenCreatedAt;
    if (tokenCreatedAt) {
      const tokenAge = Date.now() - (tokenCreatedAt.seconds * 1000);
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (tokenAge > twentyFourHours) {
        return res.status(400).json({ 
          success: false, 
          message: 'QR code has expired. Please ask the seller to generate a new one.' 
        });
      }
    }

    // Get seller information for display
    let sellerName = 'Unknown Seller';
    try {
      const sellerDoc = await db.collection('users').doc(sellerId).get();
      if (sellerDoc.exists) {
        const sellerData = sellerDoc.data();
        sellerName = sellerData?.displayName || sellerData?.username || 'Unknown Seller';
      }
    } catch (error) {
      console.error('[scan-pickup-qr] Error fetching seller info:', error);
    }

    // Return order details for confirmation
    return res.status(200).json({
      success: true,
      message: 'QR code verified successfully. Please confirm the pickup details.',
      orderDetails: {
        orderId,
        listingTitle: listingTitle || orderData.listingSnapshot?.title || 'Unknown Item',
        sellerName,
        amount: orderData.amount
      }
    });

  } catch (error) {
    console.error('[scan-pickup-qr] Unhandled error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}