import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

type ResponseData = {
  success: boolean;
  message: string;
  reviews?: any[];
  total?: number;
  data?: any;
  debug?: any;
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
    
    // Get all reviews where the user is either the reviewer or the seller
    const reviewerQuery = db.collection('reviews')
      .where('reviewerId', '==', userId);
      
    const sellerQuery = db.collection('reviews')
      .where('sellerId', '==', userId);
    
    // Execute both queries
    const [reviewerSnapshot, sellerSnapshot] = await Promise.all([
      reviewerQuery.get(),
      sellerQuery.get()
    ]);
    
    console.log(`[inspect-user-reviews] Found ${reviewerSnapshot.size} reviews where user is reviewer`);
    console.log(`[inspect-user-reviews] Found ${sellerSnapshot.size} reviews where user is seller`);
    
    // Combine the results
    const reviewsMap = new Map();
    
    // Add reviewer reviews
    reviewerSnapshot.forEach(doc => {
      const data = doc.data();
      reviewsMap.set(doc.id, {
        id: doc.id,
        reviewerId: data.reviewerId,
        sellerId: data.sellerId,
        rating: data.rating,
        comment: data.comment,
        isPublic: data.isPublic,
        status: data.status,
        createdAt: data.createdAt?.toDate?.() || null,
        role: 'reviewer'
      });
    });
    
    // Add seller reviews
    sellerSnapshot.forEach(doc => {
      const data = doc.data();
      if (!reviewsMap.has(doc.id)) {
        reviewsMap.set(doc.id, {
          id: doc.id,
          reviewerId: data.reviewerId,
          sellerId: data.sellerId,
          rating: data.rating,
          comment: data.comment,
          isPublic: data.isPublic,
          status: data.status,
          createdAt: data.createdAt?.toDate?.() || null,
          role: 'seller'
        });
      } else {
        // If the review is already in the map, add the seller role
        const existingReview = reviewsMap.get(doc.id);
        existingReview.role = 'both';
        reviewsMap.set(doc.id, existingReview);
      }
    });
    
    // Convert the map to an array
    const reviews = Array.from(reviewsMap.values());
    
    // Format the results for the old response format for backward compatibility
    const reviewsWritten = reviews.filter(review => review.role === 'reviewer' || review.role === 'both');
    const reviewsReceived = reviews.filter(review => review.role === 'seller' || review.role === 'both');
    
    // Return the results
    return res.status(200).json({
      success: true,
      message: 'Reviews retrieved successfully',
      reviews,
      total: reviews.length,
      data: {
        reviewsWritten,
        reviewsReceived,
        counts: {
          written: reviewsWritten.length,
          received: reviewsReceived.length
        }
      },
      debug: {
        reviewerQuerySize: reviewerSnapshot.size,
        sellerQuerySize: sellerSnapshot.size,
        combinedUniqueReviews: reviews.length
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