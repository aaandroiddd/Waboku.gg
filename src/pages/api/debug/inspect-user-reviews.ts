import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

type ResponseData = {
  success: boolean;
  message: string;
  data?: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow in development or when CO_DEV_ENV is set
  if (process.env.NODE_ENV !== 'development' && !process.env.NEXT_PUBLIC_CO_DEV_ENV) {
    return res.status(403).json({ success: false, message: 'Forbidden in production' });
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    console.log('[inspect-user-reviews] Inspecting reviews for user:', userId);
    
    // Initialize Firebase Admin SDK
    const { db } = initializeFirebaseAdmin();
    
    // Get reviews where user is the reviewer (reviews written)
    const reviewsWrittenQuery = db.collection('reviews').where('reviewerId', '==', userId);
    const reviewsWrittenSnapshot = await reviewsWrittenQuery.get();
    
    // Get reviews where user is the seller (reviews received)
    const reviewsReceivedQuery = db.collection('reviews').where('sellerId', '==', userId);
    const reviewsReceivedSnapshot = await reviewsReceivedQuery.get();
    
    // Format the results
    const reviewsWritten = reviewsWrittenSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        reviewerId: data.reviewerId,
        sellerId: data.sellerId,
        rating: data.rating,
        comment: data.comment,
        isPublic: data.isPublic,
        status: data.status,
        createdAt: data.createdAt?.toDate?.() || null
      };
    });
    
    const reviewsReceived = reviewsReceivedSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        reviewerId: data.reviewerId,
        sellerId: data.sellerId,
        rating: data.rating,
        comment: data.comment,
        isPublic: data.isPublic,
        status: data.status,
        createdAt: data.createdAt?.toDate?.() || null
      };
    });
    
    return res.status(200).json({
      success: true,
      message: 'Reviews retrieved successfully',
      data: {
        reviewsWritten,
        reviewsReceived,
        counts: {
          written: reviewsWritten.length,
          received: reviewsReceived.length
        }
      }
    });
  } catch (error) {
    console.error('[inspect-user-reviews] Error:', error);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      data: error instanceof Error ? { message: error.message } : undefined
    });
  }
}