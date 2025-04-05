import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

type ResponseData = {
  success: boolean;
  message: string;
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
      const now = Timestamp.now();
      
      await updateDoc(reviewRef, {
        sellerResponse: {
          comment,
          createdAt: now
        },
        updatedAt: now
      });
      
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