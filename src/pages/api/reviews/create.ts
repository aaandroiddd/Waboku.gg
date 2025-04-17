import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
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
    console.log('[create-review] Request body:', JSON.stringify(req.body));
    
    // Use server-side Firebase Admin SDK instead of client-side Firebase
    const { db: adminDb } = initializeFirebaseAdmin();
    console.log('[create-review] Firebase Admin initialized successfully');
    
    const { 
      orderId, 
      rating, 
      comment, 
      title, 
      images = [],
      userId 
    } = req.body;

    console.log('[create-review] Extracted fields:', { 
      orderId, 
      rating, 
      commentLength: comment ? comment.length : 0, 
      title, 
      imagesCount: images.length, 
      userId 
    });

    if (!orderId || !rating || !userId) {
      console.log('[create-review] Missing required fields:', { orderId, rating, userId });
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (rating < 1 || rating > 5) {
      console.log('[create-review] Invalid rating value:', rating);
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    console.log('[create-review] Processing request:', { orderId, userId });
    
    try {
      console.log('[create-review] Using Firebase Admin for database operations');
      
      // Get the order document to verify the user is the buyer
      console.log('[create-review] Getting order document:', orderId);
      const orderDoc = await adminDb.collection('orders').doc(orderId).get();
      
      if (!orderDoc.exists()) {
        console.log('[create-review] Order not found:', orderId);
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      
      const orderData = orderDoc.data();
      console.log('[create-review] Order data retrieved:', { 
        buyerId: orderData.buyerId, 
        sellerId: orderData.sellerId,
        status: orderData.status,
        reviewSubmitted: orderData.reviewSubmitted
      });
      
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
        console.log('[create-review] Generated review ID:', reviewId);
        
        const now = new Date();
        
        const reviewData = {
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
        };
        
        console.log('[create-review] Creating review document with data:', JSON.stringify(reviewData));
        await adminDb.collection('reviews').doc(reviewId).set(reviewData);
        console.log('[create-review] Review document created successfully');
        
        // Update the order to mark that a review has been submitted
        const orderUpdateData = {
          reviewSubmitted: true,
          reviewId,
          updatedAt: now
        };
        
        console.log('[create-review] Updating order with data:', orderUpdateData);
        await adminDb.collection('orders').doc(orderId).update(orderUpdateData);
        console.log('[create-review] Order updated successfully');
        
        // Update the seller's review stats
        console.log('[create-review] Updating seller review stats for:', orderData.sellerId);
        try {
          const statsUpdateResult = await updateSellerReviewStats(orderData.sellerId, rating);
          console.log('[create-review] Stats update result:', statsUpdateResult);
        } catch (statsError) {
          // Log the error but don't fail the review creation
          console.error('[create-review] Error updating seller stats, but continuing:', statsError);
        }
        
        console.log('[create-review] Review created successfully:', reviewId);
        
        return res.status(200).json({ 
          success: true, 
          message: 'Review submitted successfully',
          reviewId
        });
      } catch (error) {
        console.error('[create-review] Error creating review document:', error);
        console.error('[create-review] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to submit review. Please try again.' 
        });
      }
    } catch (error) {
      console.error('[create-review] Error accessing Firebase:', error);
      console.error('[create-review] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      return res.status(500).json({ 
        success: false, 
        message: 'Database error. Please try again later.' 
      });
    }
  } catch (error) {
    console.error('[create-review] Error processing review:', error);
    console.error('[create-review] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Helper function to update seller's review statistics
async function updateSellerReviewStats(sellerId: string, newRating: number) {
  try {
    console.log('[update-review-stats] Updating stats for seller:', sellerId, 'with rating:', newRating);
    
    if (!sellerId) {
      console.error('[update-review-stats] Missing sellerId');
      return;
    }
    
    // Use Firebase Admin SDK
    const { db: adminDb } = initializeFirebaseAdmin();
    
    // Validate rating is a number between 1-5
    if (typeof newRating !== 'number' || newRating < 1 || newRating > 5) {
      console.error('[update-review-stats] Invalid rating value:', newRating);
      return;
    }
    
    // Ensure rating is an integer
    const rating = Math.round(newRating);
    
    try {
      console.log('[update-review-stats] Creating document reference for:', sellerId);
      
      console.log('[update-review-stats] Getting document data');
      const statsDoc = await adminDb.collection('reviewStats').doc(sellerId).get();
      
      if (statsDoc.exists) {
        // Update existing stats
        const stats = statsDoc.data();
        console.log('[update-review-stats] Existing stats:', JSON.stringify(stats));
        
        // Ensure totalReviews is a number
        const currentTotal = typeof stats.totalReviews === 'number' ? stats.totalReviews : 0;
        const currentAvg = typeof stats.averageRating === 'number' ? stats.averageRating : 0;
        
        const totalReviews = currentTotal + 1;
        const totalRatingPoints = currentAvg * currentTotal + rating;
        const newAverage = parseFloat((totalRatingPoints / totalReviews).toFixed(2));
        
        // Initialize ratingCounts with default values if missing or invalid
        let ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        // If stats.ratingCounts exists and is an object, merge it with our default
        if (stats.ratingCounts && typeof stats.ratingCounts === 'object') {
          ratingCounts = { ...ratingCounts, ...stats.ratingCounts };
        }
        
        // Ensure the rating key exists and is a number
        ratingCounts[rating] = (typeof ratingCounts[rating] === 'number' ? ratingCounts[rating] : 0) + 1;
        
        const updateData = {
          totalReviews,
          averageRating: newAverage,
          ratingCounts,
          lastUpdated: new Date()
        };
        
        console.log('[update-review-stats] Updating with data:', JSON.stringify(updateData));
        await adminDb.collection('reviewStats').doc(sellerId).update(updateData);
        console.log('[update-review-stats] Document updated successfully');
      } else {
        // Create new stats document
        console.log('[update-review-stats] No existing stats, creating new document');
        const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratingCounts[rating] = 1;
        
        const newStats = {
          sellerId,
          totalReviews: 1,
          averageRating: rating,
          ratingCounts,
          lastUpdated: new Date()
        };
        
        console.log('[update-review-stats] Creating new stats:', JSON.stringify(newStats));
        await adminDb.collection('reviewStats').doc(sellerId).set(newStats);
        console.log('[update-review-stats] New document created successfully');
      }
      
      console.log('[update-review-stats] Successfully updated review stats for seller:', sellerId);
      return true;
    } catch (error) {
      console.error('[update-review-stats] Error in Firestore operations:', error);
      console.error('[update-review-stats] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      // Don't throw the error to prevent the review creation from failing
      return false;
    }
  } catch (error) {
    console.error('[update-review-stats] Error updating review stats:', error);
    console.error('[update-review-stats] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    // Don't throw the error, just log it to prevent the review creation from failing
    return false;
  }
}