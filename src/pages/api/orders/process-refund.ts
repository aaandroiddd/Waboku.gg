import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import { emailService } from '@/lib/email-service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, action, refundAmount, sellerNotes, adminOverride } = req.body;

    console.log('=== REFUND PROCESSING DEBUG START ===');
    console.log('Process refund API called with:', { orderId, action, hasToken: !!req.headers.authorization });
    console.log('Environment check:');
    console.log('- FIREBASE_PROJECT_ID:', !!process.env.FIREBASE_PROJECT_ID);
    console.log('- FIREBASE_CLIENT_EMAIL:', !!process.env.FIREBASE_CLIENT_EMAIL);
    console.log('- FIREBASE_PRIVATE_KEY:', !!process.env.FIREBASE_PRIVATE_KEY);

    if (!orderId || !action) {
      return res.status(400).json({ error: 'Order ID and action are required' });
    }

    if (!['approve', 'deny'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be approve or deny' });
    }

    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No valid authorization header provided');
      return res.status(401).json({ error: 'No valid authorization header' });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log('Token length:', token.length);
    console.log('Token starts with:', token.substring(0, 20) + '...');
    
    // Initialize Firebase Admin with detailed logging
    let auth;
    try {
      console.log('Attempting to get Firebase Admin...');
      const firebaseAdmin = getFirebaseAdmin();
      auth = firebaseAdmin.auth;
      console.log('Firebase Admin initialized successfully');
      console.log('Auth object type:', typeof auth);
      console.log('Auth has verifyIdToken:', typeof auth.verifyIdToken === 'function');
    } catch (initError: any) {
      console.error('Firebase Admin initialization failed:', initError.message);
      console.error('Init error stack:', initError.stack);
      return res.status(500).json({ 
        error: 'Internal server error', 
        details: 'Firebase initialization failed: ' + initError.message 
      });
    }
    
    // Verify authentication with comprehensive error handling
    let decodedToken;
    let userId;
    
    try {
      console.log('Attempting to verify token for process-refund API');
      
      // Check if auth is properly initialized
      if (!auth || typeof auth.verifyIdToken !== 'function') {
        throw new Error('Firebase Auth not properly initialized');
      }
      
      decodedToken = await auth.verifyIdToken(token);
      userId = decodedToken.uid;
      console.log('Token verified successfully for user:', userId);
      console.log('Token claims:', Object.keys(decodedToken));
    } catch (tokenError: any) {
      console.error('Token verification failed in process-refund:', {
        error: tokenError.message,
        code: tokenError.code,
        stack: tokenError.stack?.split('\n').slice(0, 5).join('\n')
      });
      
      // Provide more specific error messages
      if (tokenError.code === 'auth/id-token-expired') {
        return res.status(401).json({ 
          error: 'Token expired', 
          details: 'Please refresh and try again.' 
        });
      } else if (tokenError.code === 'auth/invalid-id-token') {
        return res.status(401).json({ 
          error: 'Invalid token', 
          details: 'Authentication token is invalid.' 
        });
      } else if (tokenError.code === 'auth/project-not-found') {
        return res.status(500).json({ 
          error: 'Configuration error', 
          details: 'Firebase project configuration issue.' 
        });
      } else {
        return res.status(500).json({ 
          error: 'Internal server error',
          details: 'Authentication failed: ' + tokenError.message
        });
      }
    }

    // Get the order using Firebase Admin SDK
    let order;
    let orderRef;
    try {
      console.log('Fetching order document using Firebase Admin...');
      const firebaseAdmin = getFirebaseAdmin();
      const adminDb = firebaseAdmin.db;
      
      orderRef = adminDb.collection('orders').doc(orderId);
      const orderDoc = await orderRef.get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      order = orderDoc.data();
      console.log('Order found successfully');
    } catch (dbError: any) {
      console.error('Database error:', dbError.message);
      return res.status(500).json({ 
        error: 'Database error', 
        details: dbError.message 
      });
    }
    console.log('Order found:', { orderId, sellerId: order.sellerId, buyerId: order.buyerId, refundStatus: order.refundStatus });

    // Check if user is authorized (seller or admin)
    const isAdmin = decodedToken.admin === true;
    const isSeller = order.sellerId === userId;

    console.log('Authorization check:', { userId, isAdmin, isSeller, sellerId: order.sellerId });

    if (!isSeller && !isAdmin && !adminOverride) {
      return res.status(403).json({ error: 'Not authorized to process this refund' });
    }

    // Check if refund is in requested or failed status (allow retry for failed refunds)
    if (order.refundStatus !== 'requested' && order.refundStatus !== 'failed') {
      return res.status(400).json({ error: 'Refund is not in requested or failed status' });
    }

    if (action === 'approve') {
      // Process the refund through Stripe
      if (!order.paymentIntentId) {
        return res.status(400).json({ error: 'No payment intent found for this order' });
      }

      try {
        // Determine refund amount (full refund if not specified)
        const refundAmountCents = refundAmount ? Math.round(refundAmount * 100) : order.amount * 100;
        
        // Extract payment intent ID - handle both string and object cases
        let paymentIntentId = order.paymentIntentId;
        
        // If paymentIntentId is an object (stored as string), extract the ID
        if (typeof paymentIntentId === 'string' && paymentIntentId.startsWith('{')) {
          try {
            // This might be a stringified object, try to parse it
            const parsed = JSON.parse(paymentIntentId);
            paymentIntentId = parsed.id || paymentIntentId;
          } catch (parseError) {
            console.error('Failed to parse payment intent object:', parseError);
            // If parsing fails, try to extract ID using regex
            const idMatch = paymentIntentId.match(/pi_[a-zA-Z0-9_]+/);
            if (idMatch) {
              paymentIntentId = idMatch[0];
            }
          }
        }
        
        // Validate payment intent ID format
        if (!paymentIntentId || typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
          throw new Error(`Invalid payment intent ID format: ${paymentIntentId}`);
        }
        
        console.log('Processing refund for payment intent:', paymentIntentId);
        
        // Create refund in Stripe
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: refundAmountCents,
          reason: 'requested_by_customer',
          metadata: {
            orderId: orderId,
            processedBy: userId,
            sellerNotes: sellerNotes || '',
          },
        });

        // Update order in Firestore using Firebase Admin SDK
        const isPartialRefund = refundAmountCents < (order.amount * 100);
        const updateData: any = {
          refundStatus: 'completed',
          refundAmount: refundAmountCents / 100,
          refundProcessedAt: new Date(),
          refundId: refund.id,
          refundNotes: sellerNotes || '',
          status: isPartialRefund ? 'partially_refunded' : 'refunded',
          updatedAt: new Date(),
        };

        await orderRef.update(updateData);

        // Send notifications to buyer and seller
        try {
          // Get user details for notifications using Firebase Admin SDK
          const firebaseAdmin = getFirebaseAdmin();
          const adminDb = firebaseAdmin.db;
          
          const buyerDoc = await adminDb.collection('users').doc(order.buyerId).get();
          const sellerDoc = await adminDb.collection('users').doc(order.sellerId).get();
          
          const buyerData = buyerDoc.exists ? buyerDoc.data() : null;
          const sellerData = sellerDoc.exists ? sellerDoc.data() : null;

          // Notify buyer - refund approved
          if (buyerData?.email) {
            await emailService.sendNotificationEmail({
              to: buyerData.email,
              type: 'refund-approved',
              data: {
                buyerName: buyerData.displayName || buyerData.username || 'Customer',
                orderNumber: orderId.slice(-8).toUpperCase(),
                refundAmount: (refundAmountCents / 100).toFixed(2),
                listingTitle: order.listingSnapshot?.title || 'Item',
                isPartialRefund,
                sellerNotes: sellerNotes || '',
                processingTime: '5-10 business days',
              },
            });
          }

          // Notify seller - refund processed
          if (sellerData?.email) {
            await emailService.sendNotificationEmail({
              to: sellerData.email,
              type: 'refund-processed',
              data: {
                sellerName: sellerData.displayName || sellerData.username || 'Seller',
                orderNumber: orderId.slice(-8).toUpperCase(),
                refundAmount: (refundAmountCents / 100).toFixed(2),
                listingTitle: order.listingSnapshot?.title || 'Item',
                isPartialRefund,
                buyerName: buyerData?.displayName || buyerData?.username || 'Customer',
              },
            });
          }
        } catch (emailError) {
          console.error('Error sending refund notification emails:', emailError);
          // Don't fail the refund process if email fails
        }

        return res.status(200).json({ 
          success: true, 
          message: 'Refund processed successfully',
          refundId: refund.id,
          refundAmount: refundAmountCents / 100,
        });

      } catch (stripeError: any) {
        console.error('Stripe refund error:', stripeError);
        
        // Update order status to failed using Firebase Admin SDK
        await orderRef.update({
          refundStatus: 'failed',
          refundNotes: `Refund failed: ${stripeError.message}`,
          updatedAt: new Date(),
        });

        return res.status(400).json({ 
          error: 'Failed to process refund through Stripe',
          details: stripeError.message,
        });
      }

    } else if (action === 'deny') {
      // Deny the refund request using Firebase Admin SDK
      await orderRef.update({
        refundStatus: 'cancelled',
        refundNotes: sellerNotes || 'Refund request denied by seller',
        refundProcessedAt: new Date(),
        updatedAt: new Date(),
      });

      // Send notification to buyer - refund denied
      try {
        const firebaseAdmin = getFirebaseAdmin();
        const adminDb = firebaseAdmin.db;
        
        const buyerDoc = await adminDb.collection('users').doc(order.buyerId).get();
        const buyerData = buyerDoc.exists ? buyerDoc.data() : null;

        if (buyerData?.email) {
          await emailService.sendNotificationEmail({
            to: buyerData.email,
            type: 'refund-denied',
            data: {
              buyerName: buyerData.displayName || buyerData.username || 'Customer',
              orderNumber: orderId.slice(-8).toUpperCase(),
              listingTitle: order.listingSnapshot?.title || 'Item',
              denialReason: sellerNotes || 'The seller has reviewed your refund request and determined it does not meet the refund criteria.',
              contactSupport: true,
            },
          });
        }
      } catch (emailError) {
        console.error('Error sending refund denial email:', emailError);
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Refund request denied',
      });
    }

  } catch (error) {
    console.error('Error processing refund:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}