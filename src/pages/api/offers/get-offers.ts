import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('GET /api/offers/get-offers START');
  
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
    
    // Verify the token and get the user
    const admin = getFirebaseAdmin();
    const auth = getAuth(admin);
    const db = getFirestore(admin);
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    console.log(`Fetching offers for user: ${userId}`);

    // Fetch received offers (where user is the seller)
    const receivedOffersSnapshot = await db
      .collection('offers')
      .where('sellerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    // Fetch sent offers (where user is the buyer)
    const sentOffersSnapshot = await db
      .collection('offers')
      .where('buyerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    // Process the offers data
    const receivedOffers = receivedOffersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        // Ensure listingSnapshot has all required fields
        listingSnapshot: {
          title: data.listingSnapshot?.title || 'Unknown Listing',
          price: data.listingSnapshot?.price || 0,
          imageUrl: data.listingSnapshot?.imageUrl || '',
        }
      };
    });

    const sentOffers = sentOffersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        // Ensure listingSnapshot has all required fields
        listingSnapshot: {
          title: data.listingSnapshot?.title || 'Unknown Listing',
          price: data.listingSnapshot?.price || 0,
          imageUrl: data.listingSnapshot?.imageUrl || '',
        }
      };
    });

    console.log(`Found ${receivedOffers.length} received offers and ${sentOffers.length} sent offers`);
    
    return res.status(200).json({
      receivedOffers,
      sentOffers
    });
  } catch (error: any) {
    console.error('Error fetching offers:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch offers',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    console.log('GET /api/offers/get-offers END');
  }
}