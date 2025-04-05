import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';

type ResponseData = {
  success: boolean;
  message: string;
  helpfulCount?: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { reviewId, userId } = req.body;

    if (!reviewId || !userId) {
      console.log('[mark-review-helpful] Missing required fields:', { reviewId, userId });
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    console.log('[mark-review-helpful] Processing request:', { reviewId, userId });
    const { db } = getFirebaseServices();
    
    // Get the review document
    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) {
      console.log('[mark-review-helpful] Review not found:', reviewId);
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    
    // Check if the user is the reviewer or seller (they shouldn't mark their own reviews as helpful)
    const reviewData = reviewDoc.data();
    if (reviewData.reviewerId === userId || reviewData.sellerId === userId) {
      console.log('[mark-review-helpful] User cannot mark their own review as helpful:', { userId, reviewerId: reviewData.reviewerId, sellerId: reviewData.sellerId });
      return res.status(400).json({ success: false, message: 'You cannot mark your own review as helpful' });
    }
    
    try {
      // Update the review's helpful count
      await updateDoc(reviewRef, {
        helpfulCount: increment(1)
      });
      
      // Get the updated document to return the new count
      const updatedReviewDoc = await getDoc(reviewRef);
      const updatedReviewData = updatedReviewDoc.data();
      
      console.log('[mark-review-helpful] Review marked as helpful:', reviewId);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Review marked as helpful',
        helpfulCount: updatedReviewData.helpfulCount
      });
    } catch (error) {
      console.error('[mark-review-helpful] Error marking review as helpful:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to mark review as helpful. Please try again.' 
      });
    }
  } catch (error) {
    console.error('[mark-review-helpful] Error processing request:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}