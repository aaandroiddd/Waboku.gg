import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

type ResponseData = {
  success: boolean;
  message: string;
  reviewData?: any;
  error?: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Only allow in development or CO_DEV_ENV
  if (process.env.NODE_ENV !== 'development' && !process.env.NEXT_PUBLIC_CO_DEV_ENV) {
    return res.status(403).json({ success: false, message: 'Forbidden in production' });
  }

  try {
    const { reviewId, sellerId } = req.query;

    if (!reviewId && !sellerId) {
      return res.status(400).json({ success: false, message: 'Review ID or Seller ID is required' });
    }

    // Initialize Firebase Admin SDK
    const { db } = initializeFirebaseAdmin();
    
    let reviewData: any = null;
    
    // If reviewId is provided, get that specific review
    if (reviewId) {
      console.log(`[inspect-review] Fetching review with ID: ${reviewId}`);
      const reviewDoc = await db.collection('reviews').doc(reviewId as string).get();
      
      if (reviewDoc.exists) {
        reviewData = {
          id: reviewDoc.id,
          ...reviewDoc.data(),
          exists: true,
          path: reviewDoc.ref.path
        };
        
        // Convert timestamps to ISO strings for serialization
        if (reviewData.createdAt && typeof reviewData.createdAt.toDate === 'function') {
          reviewData.createdAt = reviewData.createdAt.toDate().toISOString();
        }
        if (reviewData.updatedAt && typeof reviewData.updatedAt.toDate === 'function') {
          reviewData.updatedAt = reviewData.updatedAt.toDate().toISOString();
        }
        
        // Check comment field specifically
        reviewData._commentInfo = {
          type: typeof reviewData.comment,
          exists: reviewData.comment !== undefined,
          isNull: reviewData.comment === null,
          isEmpty: reviewData.comment === '',
          length: reviewData.comment?.length || 0,
          sample: reviewData.comment?.substring(0, 100) || 'No content'
        };
      } else {
        reviewData = { exists: false, id: reviewId };
      }
    }
    // If sellerId is provided, get all reviews for that seller
    else if (sellerId) {
      console.log(`[inspect-review] Fetching reviews for seller: ${sellerId}`);
      const reviewsSnapshot = await db.collection('reviews')
        .where('sellerId', '==', sellerId)
        .limit(5)
        .get();
      
      if (!reviewsSnapshot.empty) {
        reviewData = reviewsSnapshot.docs.map(doc => {
          const data = doc.data();
          
          // Convert timestamps to ISO strings for serialization
          let createdAt = data.createdAt;
          let updatedAt = data.updatedAt;
          
          if (createdAt && typeof createdAt.toDate === 'function') {
            createdAt = createdAt.toDate().toISOString();
          }
          if (updatedAt && typeof updatedAt.toDate === 'function') {
            updatedAt = updatedAt.toDate().toISOString();
          }
          
          // Check comment field specifically
          const commentInfo = {
            type: typeof data.comment,
            exists: data.comment !== undefined,
            isNull: data.comment === null,
            isEmpty: data.comment === '',
            length: data.comment?.length || 0,
            sample: data.comment?.substring(0, 100) || 'No content'
          };
          
          return {
            id: doc.id,
            sellerId: data.sellerId,
            reviewerId: data.reviewerId,
            rating: data.rating,
            status: data.status,
            isPublic: data.isPublic,
            createdAt,
            updatedAt,
            _commentInfo: commentInfo,
            path: doc.ref.path
          };
        });
      } else {
        reviewData = [];
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Review data retrieved successfully',
      reviewData
    });
  } catch (error) {
    console.error('[inspect-review] Error:', error);
    
    let errorInfo: any = { message: 'Unknown error' };
    
    if (error instanceof Error) {
      errorInfo = {
        message: error.message,
        name: error.name,
        stack: error.stack
      };
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error inspecting review',
      error: errorInfo
    });
  }
}