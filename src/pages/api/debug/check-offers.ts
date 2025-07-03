import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('GET /api/debug/check-offers START');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization token from the request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('No valid authorization header found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Initialize Firebase Admin
    getFirebaseAdmin();
    const auth = getAuth();
    const db = getFirestore();
    
    // Verify the token and get the user
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    console.log(`Debugging offers for user: ${userId}`);

    // Get all offers for this user (both sent and received)
    const allOffersSnapshot = await db
      .collection('offers')
      .get();

    const userOffers = [];
    const allOffers = [];

    allOffersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const offer = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
        expiresAt: data.expiresAt?.toDate?.() || data.expiresAt || null,
      };

      allOffers.push({
        id: offer.id,
        buyerId: offer.buyerId,
        sellerId: offer.sellerId,
        status: offer.status,
        cleared: offer.cleared,
        amount: offer.amount,
        listingId: offer.listingId,
        createdAt: offer.createdAt
      });

      // Check if this offer involves the current user
      if (offer.buyerId === userId || offer.sellerId === userId) {
        userOffers.push(offer);
      }
    });

    // Separate received and sent offers
    const receivedOffers = userOffers.filter(offer => offer.sellerId === userId && !offer.cleared);
    const sentOffers = userOffers.filter(offer => offer.buyerId === userId && !offer.cleared);

    // Get recent offers for debugging
    const recentOffers = allOffers
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return res.status(200).json({
      userId,
      summary: {
        totalOffersInDatabase: allOffers.length,
        userTotalOffers: userOffers.length,
        userReceivedOffers: receivedOffers.length,
        userSentOffers: sentOffers.length,
        userReceivedOffersNotCleared: receivedOffers.filter(o => !o.cleared).length,
        userSentOffersNotCleared: sentOffers.filter(o => !o.cleared).length
      },
      userOffers: {
        received: receivedOffers.map(offer => ({
          id: offer.id,
          buyerId: offer.buyerId,
          amount: offer.amount,
          status: offer.status,
          cleared: offer.cleared,
          listingTitle: offer.listingSnapshot?.title || 'No title',
          createdAt: offer.createdAt
        })),
        sent: sentOffers.map(offer => ({
          id: offer.id,
          sellerId: offer.sellerId,
          amount: offer.amount,
          status: offer.status,
          cleared: offer.cleared,
          listingTitle: offer.listingSnapshot?.title || 'No title',
          createdAt: offer.createdAt
        }))
      },
      recentOffersInDatabase: recentOffers
    });
  } catch (error: any) {
    console.error('Error debugging offers:', error);
    return res.status(500).json({ 
      error: 'Failed to debug offers',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    console.log('GET /api/debug/check-offers END');
  }
}