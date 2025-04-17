import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

type ResponseData = {
  success: boolean;
  message: string;
  data?: any;
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
    const { reviewId, comment, userId } = req.body;

    if (!reviewId || !comment || !userId) {
      console.log('[respond-to-review] Missing required fields:', { reviewId, comment, userId });
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    console.log('[respond-to-review] Processing request:', { reviewId, userId });
    const { db } = getFirebaseServices();
    
    // Get the review document
    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) {
      console.log('[respond-to-review] Review not found:', reviewId);
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    
    const reviewData = reviewDoc.data();
    
    // Verify that the user is the seller of this review
    if (reviewData.sellerId !== userId) {
      console.log('[respond-to-review] Unauthorized: User is not the seller', { sellerId: reviewData.sellerId, userId });
      return res.status(403).json({ success: false, message: 'Unauthorized: Only the seller can respond to this review' });
    }
    
    try {
      // Update the review with the seller's response
      const sellerResponse = {
        comment,
        createdAt: serverTimestamp()
      };
      
      console.log('[respond-to-review] Adding response to review:', { reviewId, sellerResponse });
      
      await updateDoc(reviewRef, {
        sellerResponse,
        updatedAt: serverTimestamp()
      });
      
      // Also update in seller's subcollection if it exists
      try {
        const sellerReviewRef = doc(db, 'users', reviewData.sellerId, 'reviews', reviewId);
        const sellerReviewDoc = await getDoc(sellerReviewRef);
        
        if (sellerReviewDoc.exists()) {
          await updateDoc(sellerReviewRef, {
            sellerResponse,
            updatedAt: serverTimestamp()
          });
          console.log('[respond-to-review] Updated seller subcollection review');
        } else {
          console.log('[respond-to-review] Seller subcollection review does not exist, skipping update');
        }
      } catch (subcollectionError) {
        // Log but don't fail if the subcollection update fails
        console.error('[respond-to-review] Error updating seller subcollection:', subcollectionError);
      }
      
      console.log('[respond-to-review] Response added successfully to review:', reviewId);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Response added successfully'
      });
    } catch (error) {
      console.error('[respond-to-review] Error adding response:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to add response. Please try again.' 
      });
    }
  } catch (error) {
    console.error('[respond-to-review] Error processing response:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}