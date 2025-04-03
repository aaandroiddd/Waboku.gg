import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { moderatorAuthMiddleware } from '@/middleware/moderatorAuth';

// Initialize Firestore using Firebase Admin
const { db } = getFirebaseAdmin();

// Create a handler with middleware
const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Query Firestore for listings that need review
    const listingsRef = db.collection('listings');
    const q = listingsRef
      .where('needsReview', '==', true)
      .where('status', '==', 'active');

    const querySnapshot = await q.get();
    
    // Convert query snapshot to array of listings
    const listings = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convert Firestore timestamps to ISO strings for serialization
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null;
      const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate().toISOString() : null;
      
      // Include the review reason if available
      const reviewReason = data.reviewReason || 'No specific reason provided';
      
      return {
        id: doc.id,
        ...data,
        createdAt,
        expiresAt,
        reviewReason
      };
    });

    // Return the listings
    return res.status(200).json({ 
      success: true,
      listings,
      count: listings.length
    });
  } catch (error) {
    console.error('Error fetching listings for moderation:', error);
    return res.status(500).json({ error: 'Failed to fetch listings for moderation' });
  }
};

// Apply the middleware and export
export default async function (req: NextApiRequest, res: NextApiResponse) {
  return moderatorAuthMiddleware(req, res, () => handler(req, res));
}