import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Relist API: Starting request processing');
    const { orderId, idToken } = req.body;

    console.log('Relist API: Request body received', {
      hasOrderId: !!orderId,
      hasIdToken: !!idToken,
      idTokenLength: idToken ? idToken.length : 0
    });

    if (!orderId) {
      console.log('Relist API: Missing order ID');
      return res.status(400).json({ error: 'Order ID is required' });
    }

    if (!idToken) {
      console.log('Relist API: Missing ID token');
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    console.log('Relist API: Attempting to verify ID token');
    const decodedToken = await verifyIdToken(idToken);
    console.log('Relist API: Token verified successfully for user:', decodedToken.uid);
    const userId = decodedToken.uid;

    const { db } = getFirebaseAdmin();

    // Get the order to verify ownership and get listing data
    const orderDoc = await db.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data();

    // Verify that the current user is the seller of this order
    if (orderData.sellerId !== userId) {
      return res.status(403).json({ error: 'You can only relist your own items' });
    }

    // Verify that the order has a completed refund
    if (orderData.refundStatus !== 'completed') {
      return res.status(400).json({ error: 'Can only relist items from completed refunds' });
    }

    // Get the listing snapshot from the order
    const listingSnapshot = orderData.listingSnapshot;
    if (!listingSnapshot) {
      return res.status(400).json({ error: 'No listing information available to relist' });
    }

    // Create a new listing based on the snapshot
    const newListingData = {
      title: listingSnapshot.title || '',
      description: listingSnapshot.description || '',
      price: listingSnapshot.price || 0,
      game: listingSnapshot.game || 'other',
      condition: listingSnapshot.condition || 'near_mint',
      imageUrl: listingSnapshot.imageUrl || '',
      images: listingSnapshot.images || [],
      imageUrls: listingSnapshot.imageUrls || listingSnapshot.images || [],
      userId: userId, // Use userId instead of sellerId for consistency with dashboard queries
      username: listingSnapshot.username || 'Anonymous',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      views: 0,
      favorites: 0,
      isGraded: listingSnapshot.isGraded || false,
      gradeLevel: listingSnapshot.gradeLevel || null,
      gradingCompany: listingSnapshot.gradingCompany || null,
      finalSale: listingSnapshot.finalSale || false,
      coverImageIndex: listingSnapshot.coverImageIndex || 0,
      // Add any other fields that might be in the snapshot
      ...(listingSnapshot.cardNumber && { cardNumber: listingSnapshot.cardNumber }),
      ...(listingSnapshot.setName && { setName: listingSnapshot.setName }),
      ...(listingSnapshot.rarity && { rarity: listingSnapshot.rarity }),
      ...(listingSnapshot.language && { language: listingSnapshot.language }),
      ...(listingSnapshot.foil && { foil: listingSnapshot.foil }),
      ...(listingSnapshot.edition && { edition: listingSnapshot.edition }),
      ...(listingSnapshot.city && { city: listingSnapshot.city }),
      ...(listingSnapshot.state && { state: listingSnapshot.state }),
    };

    // Create the new listing
    const newListingRef = await db.collection('listings').add(newListingData);

    console.log(`Successfully relisted item from order ${orderId} as new listing ${newListingRef.id}`);

    return res.status(200).json({ 
      success: true, 
      listingId: newListingRef.id,
      message: 'Item successfully relisted'
    });

  } catch (error) {
    console.error('Relist API: Error relisting item:', error);
    
    // Provide more specific error details for debugging
    if (error instanceof Error) {
      console.error('Relist API: Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      
      // Check for specific Firebase Admin errors
      if (error.message.includes('Firebase ID token') || 
          error.message.includes('Token used too early') ||
          error.message.includes('Token expired') ||
          error.message.includes('Invalid token')) {
        return res.status(401).json({ 
          error: 'Authentication failed',
          details: 'Invalid or expired authentication token. Please try logging out and back in.'
        });
      }
      
      if (error.message.includes('Missing or insufficient permissions')) {
        return res.status(403).json({ 
          error: 'Permission denied',
          details: 'You do not have permission to perform this action.'
        });
      }
    }
    
    return res.status(500).json({ 
      error: 'Failed to relist item',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}