import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('GET /api/debug/test-offer-creation START');
  
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
    
    console.log(`Testing offer creation for user: ${userId}`);

    // Get the most recent offer created by this user
    const recentOfferQuery = await db
      .collection('offers')
      .where('buyerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    let recentOffer = null;
    if (!recentOfferQuery.empty) {
      const doc = recentOfferQuery.docs[0];
      const data = doc.data();
      recentOffer = {
        id: doc.id,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        amount: data.amount,
        status: data.status,
        cleared: data.cleared,
        listingId: data.listingId,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        listingTitle: data.listingSnapshot?.title || 'No title'
      };
    }

    // Get all offers by this user (for comparison)
    const allUserOffersQuery = await db
      .collection('offers')
      .where('buyerId', '==', userId)
      .get();

    const allUserOffers = allUserOffersQuery.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        amount: data.amount,
        status: data.status,
        cleared: data.cleared,
        listingId: data.listingId,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        listingTitle: data.listingSnapshot?.title || 'No title'
      };
    });

    // Check if user ID matches exactly
    const userIdMatches = allUserOffers.filter(offer => offer.buyerId === userId);
    const userIdMismatches = allUserOffers.filter(offer => offer.buyerId !== userId);

    // Get user info for debugging
    const userRecord = await auth.getUser(userId);

    return res.status(200).json({
      userId,
      userEmail: userRecord.email,
      userDisplayName: userRecord.displayName,
      tokenValid: true,
      recentOffer,
      summary: {
        totalOffersCreatedByUser: allUserOffers.length,
        userIdMatches: userIdMatches.length,
        userIdMismatches: userIdMismatches.length,
        clearedOffers: allUserOffers.filter(o => o.cleared).length,
        activeOffers: allUserOffers.filter(o => !o.cleared).length
      },
      allUserOffers: allUserOffers.slice(0, 5), // Show first 5 for debugging
      userIdMismatches: userIdMismatches.length > 0 ? userIdMismatches : null
    });
  } catch (error: any) {
    console.error('Error testing offer creation:', error);
    return res.status(500).json({ 
      error: 'Failed to test offer creation',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    console.log('GET /api/debug/test-offer-creation END');
  }
}