import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

type ResponseData = {
  success: boolean;
  message: string;
  helpfulCount?: number;
  isMarked?: boolean;
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
    const { reviewId, userId, action = 'toggle' } = req.body;

    if (!reviewId || !userId) {
      console.log('[mark-review-helpful] Missing required fields:', { reviewId, userId });
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    console.log('[mark-review-helpful] Processing request:', { reviewId, userId, action });
    
    // Get Firebase Admin services
    let db;
    try {
      const { db: adminDb } = getFirebaseAdmin();
      db = adminDb;
      if (!db) {
        throw new Error('Firebase Admin database not initialized');
      }
      console.log('[mark-review-helpful] Firebase Admin initialized successfully');
    } catch (firebaseError) {
      console.error('[mark-review-helpful] Firebase Admin initialization error:', firebaseError);
      return res.status(500).json({ 
        success: false, 
        message: 'Firebase service initialization failed' 
      });
    }
    
    // Get the review document
    let reviewDoc;
    try {
      const reviewRef = db.collection('reviews').doc(reviewId);
      reviewDoc = await reviewRef.get();
      
      if (!reviewDoc.exists) {
        console.log('[mark-review-helpful] Review not found:', reviewId);
        return res.status(404).json({ success: false, message: 'Review not found' });
      }
    } catch (reviewError) {
      console.error('[mark-review-helpful] Error fetching review:', reviewError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch review data' 
      });
    }
    
    // Check if the user is the reviewer or seller (they shouldn't mark their own reviews as helpful)
    const reviewData = reviewDoc.data();
    if (reviewData.reviewerId === userId || reviewData.sellerId === userId) {
      console.log('[mark-review-helpful] User cannot mark their own review as helpful:', { userId, reviewerId: reviewData.reviewerId, sellerId: reviewData.sellerId });
      return res.status(400).json({ success: false, message: 'You cannot mark your own review as helpful' });
    }
    
    // Check if user has already marked this review as helpful
    let helpfulDoc;
    try {
      const helpfulRef = db.collection('reviews').doc(reviewId).collection('helpfulUsers').doc(userId);
      helpfulDoc = await helpfulRef.get();
    } catch (helpfulError) {
      console.error('[mark-review-helpful] Error checking helpful status:', helpfulError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to check helpful status' 
      });
    }
    
    const hasMarked = helpfulDoc.exists;
    
    try {
      let newCount = reviewData.helpfulCount || 0;
      let isMarked = hasMarked;
      
      // Toggle or explicit action
      if ((action === 'toggle' && !hasMarked) || action === 'mark') {
        // Mark as helpful
        try {
          const helpfulRef = db.collection('reviews').doc(reviewId).collection('helpfulUsers').doc(userId);
          await helpfulRef.set({
            userId,
            timestamp: FieldValue.serverTimestamp()
          });
        } catch (markError) {
          console.error('[mark-review-helpful] Error marking as helpful:', markError);
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to mark review as helpful' 
          });
        }
        
        // Update the review's helpful count
        try {
          const reviewRef = db.collection('reviews').doc(reviewId);
          await reviewRef.update({
            helpfulCount: FieldValue.increment(1)
          });
        } catch (updateError) {
          console.error('[mark-review-helpful] Error updating helpful count:', updateError);
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to update helpful count' 
          });
        }
        
        newCount += 1;
        isMarked = true;
        console.log('[mark-review-helpful] Review marked as helpful:', reviewId);
      } else if ((action === 'toggle' && hasMarked) || action === 'unmark') {
        // Unmark as helpful
        try {
          const helpfulRef = db.collection('reviews').doc(reviewId).collection('helpfulUsers').doc(userId);
          await helpfulRef.delete();
        } catch (unmarkError) {
          console.error('[mark-review-helpful] Error unmarking as helpful:', unmarkError);
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to unmark review as helpful' 
          });
        }
        
        // Update the review's helpful count (ensure it doesn't go below 0)
        newCount = Math.max(0, newCount - 1);
        try {
          const reviewRef = db.collection('reviews').doc(reviewId);
          await reviewRef.update({
            helpfulCount: newCount
          });
        } catch (updateError) {
          console.error('[mark-review-helpful] Error updating helpful count:', updateError);
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to update helpful count' 
          });
        }
        
        isMarked = false;
        console.log('[mark-review-helpful] Review unmarked as helpful:', reviewId);
      }
      
      // Also update in seller's subcollection if it exists
      try {
        const sellerReviewRef = db.collection('users').doc(reviewData.sellerId).collection('reviews').doc(reviewId);
        const sellerReviewDoc = await sellerReviewRef.get();
        
        if (sellerReviewDoc.exists) {
          await sellerReviewRef.update({
            helpfulCount: newCount,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      } catch (subcollectionError) {
        // Log but don't fail if the subcollection update fails
        console.error('[mark-review-helpful] Error updating seller subcollection:', subcollectionError);
      }
      
      return res.status(200).json({ 
        success: true, 
        message: isMarked ? 'Review marked as helpful' : 'Review unmarked as helpful',
        helpfulCount: newCount,
        isMarked
      });
    } catch (error) {
      console.error('[mark-review-helpful] Error updating helpful status:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to update helpful status. Please try again.' 
      });
    }
  } catch (error) {
    console.error('[mark-review-helpful] Error processing request:', error);
    return res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}