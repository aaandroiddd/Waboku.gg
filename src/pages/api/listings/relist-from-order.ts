import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { verifyIdToken } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const { db } = getFirebaseServices();

    // Get the order to verify ownership and get listing data
    const orderDoc = await getDoc(doc(db, 'orders', orderId));
    
    if (!orderDoc.exists()) {
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
      sellerId: userId,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      views: 0,
      favorites: 0,
      isGraded: listingSnapshot.isGraded || false,
      gradeLevel: listingSnapshot.gradeLevel || null,
      gradingCompany: listingSnapshot.gradingCompany || null,
      finalSale: listingSnapshot.finalSale || false,
      // Add any other fields that might be in the snapshot
      ...(listingSnapshot.cardNumber && { cardNumber: listingSnapshot.cardNumber }),
      ...(listingSnapshot.setName && { setName: listingSnapshot.setName }),
      ...(listingSnapshot.rarity && { rarity: listingSnapshot.rarity }),
      ...(listingSnapshot.language && { language: listingSnapshot.language }),
      ...(listingSnapshot.foil && { foil: listingSnapshot.foil }),
      ...(listingSnapshot.edition && { edition: listingSnapshot.edition }),
    };

    // Create the new listing
    const newListingRef = await addDoc(collection(db, 'listings'), newListingData);

    console.log(`Successfully relisted item from order ${orderId} as new listing ${newListingRef.id}`);

    return res.status(200).json({ 
      success: true, 
      listingId: newListingRef.id,
      message: 'Item successfully relisted'
    });

  } catch (error) {
    console.error('Error relisting item:', error);
    return res.status(500).json({ 
      error: 'Failed to relist item',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}