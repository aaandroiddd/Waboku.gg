import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

type ResponseData = {
  success: boolean;
  message: string;
  reviewId?: string;
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
    console.log('[create-review] Request body:', req.body);
    
    const { 
      orderId, 
      rating, 
      comment, 
      title, 
      images = [],
      userId 
    } = req.body;

    if (!orderId || !rating || !userId) {
      console.log('[create-review] Missing required fields:', { orderId, rating, userId });
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (rating < 1 || rating > 5) {
      console.log('[create-review] Invalid rating value:', rating);
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    console.log('[create-review] Processing request:', { orderId, userId });
    const { db } = getFirebaseServices();
    
    // Get the order document to verify the user is the buyer
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      console.log('[create-review] Order not found:', orderId);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const orderData = orderDoc.data();
    
    // Verify that the user is the buyer of this order
    if (orderData.buyerId !== userId) {
      console.log('[create-review] Unauthorized: User is not the buyer', { buyerId: orderData.buyerId, userId });
      return res.status(403).json({ success: false, message: 'Unauthorized: Only the buyer can leave a review' });
    }
    
    // Verify the order is completed
    if (orderData.status !== 'completed') {
      console.log('[create-review] Order not completed:', orderData.status);
      return res.status(400).json({ 
        success: false, 
        message: 'Reviews can only be left for completed orders' 
      });
    }
    
    // Check if a review already exists for this order
    if (orderData.reviewSubmitted) {
      console.log('[create-review] Review already submitted for order:', orderId);
      return res.status(400).json({ 
        success: false, 
        message: 'A review has already been submitted for this order' 
      });
    }
    
    try {
      // Create a new review document
      const reviewId = uuidv4();
      const reviewRef = doc(db, 'reviews', reviewId);
      const now = Timestamp.now();
      
      await setDoc(reviewRef, {
        id: reviewId,
        orderId,
        listingId: orderData.listingId,
        reviewerId: userId,
        sellerId: orderData.sellerId,
        rating,
        comment: comment || '',
        title: title || '',
        images: images || [],
        isVerifiedPurchase: true,
        isPublic: true,
        status: 'published',
        helpfulCount: 0,
        reportCount: 0,
        createdAt: now,
        updatedAt: now
      });
      
      // Update the order to mark that a review has been submitted
      await updateDoc(orderRef, {
        reviewSubmitted: true,
        reviewId,
        updatedAt: now
      });
      
      // Update the seller's review stats
      await updateSellerReviewStats(db, orderData.sellerId, rating);
      
      console.log('[create-review] Review created successfully:', reviewId);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Review submitted successfully',
        reviewId
      });
    } catch (error) {
      console.error('[create-review] Error creating review:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to submit review. Please try again.' 
      });
    }
  } catch (error) {
    console.error('[create-review] Error processing review:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Helper function to update seller's review statistics
async function updateSellerReviewStats(db: any, sellerId: string, newRating: number) {
  try {
    console.log('[update-review-stats] Updating stats for seller:', sellerId, 'with rating:', newRating);
    
    if (!sellerId) {
      console.error('[update-review-stats] Missing sellerId');
      return;
    }
    
    const statsRef = doc(db, 'reviewStats', sellerId);
    const statsDoc = await getDoc(statsRef);
    
    if (statsDoc.exists()) {
      // Update existing stats
      const stats = statsDoc.data();
      console.log('[update-review-stats] Existing stats:', stats);
      
      // Ensure totalReviews is a number
      const currentTotal = typeof stats.totalReviews === 'number' ? stats.totalReviews : 0;
      const currentAvg = typeof stats.averageRating === 'number' ? stats.averageRating : 0;
      
      const totalReviews = currentTotal + 1;
      const totalRatingPoints = currentAvg * currentTotal + newRating;
      const newAverage = totalRatingPoints / totalReviews;
      
      // Update the rating counts
      const ratingCounts = stats.ratingCounts || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      ratingCounts[newRating] = (ratingCounts[newRating] || 0) + 1;
      
      const updateData = {
        totalReviews,
        averageRating: newAverage,
        ratingCounts,
        lastUpdated: Timestamp.now()
      };
      
      console.log('[update-review-stats] Updating with data:', updateData);
      await updateDoc(statsRef, updateData);
    } else {
      // Create new stats document
      const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      ratingCounts[newRating] = 1;
      
      const newStats = {
        sellerId,
        totalReviews: 1,
        averageRating: newRating,
        ratingCounts,
        lastUpdated: Timestamp.now()
      };
      
      console.log('[update-review-stats] Creating new stats:', newStats);
      await setDoc(statsRef, newStats);
    }
    
    console.log('[update-review-stats] Successfully updated review stats for seller:', sellerId);
  } catch (error) {
    console.error('[update-review-stats] Error updating review stats:', error);
    // Don't throw the error, just log it to prevent the review creation from failing
  }
}