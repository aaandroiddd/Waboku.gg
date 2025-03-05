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
    
    try {
      // Verify the token and get the user
      console.log('Initializing Firebase Admin...');
      getFirebaseAdmin(); // Initialize Firebase Admin
      console.log('Getting Auth and Firestore instances...');
      const auth = getAuth();
      const db = getFirestore();
      
      console.log('Verifying token...');
      const decodedToken = await auth.verifyIdToken(token);
      const userId = decodedToken.uid;
      
      console.log(`Fetching offers for user: ${userId}`);

      try {
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
        const receivedOffers = receivedOffersSnapshot.docs
          .map(doc => {
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
              },
              // Ensure cleared property is properly typed
              cleared: data.cleared === true
            };
          })
          // Filter out cleared offers
          .filter(offer => !offer.cleared);

        const sentOffers = sentOffersSnapshot.docs
          .map(doc => {
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
              },
              // Ensure cleared property is properly typed
              cleared: data.cleared === true
            };
          })
          // Filter out cleared offers
          .filter(offer => !offer.cleared);

        console.log(`Found ${receivedOffers.length} received offers and ${sentOffers.length} sent offers`);
        
        return res.status(200).json({
          receivedOffers,
          sentOffers
        });
      } catch (queryError: any) {
        console.error('Error querying Firestore:', queryError);
        return res.status(500).json({ 
          error: 'Failed to query offers from Firestore',
          message: queryError.message,
          code: queryError.code
        });
      }
    } catch (authError: any) {
      console.error('Error with Firebase Admin or authentication:', authError);
      return res.status(500).json({ 
        error: 'Failed to authenticate or initialize Firebase',
        message: authError.message,
        code: authError.code
      });
    }
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