import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

type ResponseData = {
  success: boolean;
  message: string;
  details?: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    console.log('[test-review-creation] Starting test');
    
    // Initialize Firebase Admin
    console.log('[test-review-creation] Initializing Firebase Admin');
    const { db } = initializeFirebaseAdmin();
    console.log('[test-review-creation] Firebase Admin initialized successfully');
    
    // Create test IDs
    const testOrderId = `test-order-${Date.now()}`;
    const testUserId = `test-user-${Date.now()}`;
    const testSellerId = `test-seller-${Date.now()}`;
    const testListingId = `test-listing-${Date.now()}`;
    
    console.log('[test-review-creation] Generated test IDs:', {
      testOrderId,
      testUserId,
      testSellerId,
      testListingId
    });
    
    // Create a test order document
    const orderData = {
      id: testOrderId,
      buyerId: testUserId,
      sellerId: testSellerId,
      listingId: testListingId,
      status: 'completed',
      reviewSubmitted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('[test-review-creation] Creating test order');
    try {
      await db.collection('orders').doc(testOrderId).set(orderData);
      console.log('[test-review-creation] Test order created successfully');
    } catch (orderError) {
      console.error('[test-review-creation] Error creating test order:', orderError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create test order',
        details: { error: orderError.message }
      });
    }
    
    // Create a test review
    const reviewId = uuidv4();
    const reviewData = {
      id: reviewId,
      orderId: testOrderId,
      listingId: testListingId,
      reviewerId: testUserId,
      sellerId: testSellerId,
      rating: 5,
      comment: 'Test review comment',
      title: 'Test review title',
      images: [],
      isVerifiedPurchase: true,
      isPublic: true,
      status: 'published',
      helpfulCount: 0,
      reportCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('[test-review-creation] Creating test review');
    try {
      await db.collection('reviews').doc(reviewId).set(reviewData);
      console.log('[test-review-creation] Test review created successfully');
    } catch (reviewError) {
      console.error('[test-review-creation] Error creating test review:', reviewError);
      
      // Try to clean up the order
      try {
        await db.collection('orders').doc(testOrderId).delete();
      } catch (cleanupError) {
        console.error('[test-review-creation] Error cleaning up order:', cleanupError);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to create test review',
        details: { error: reviewError.message }
      });
    }
    
    // Update the order to mark that a review has been submitted
    const orderUpdateData = {
      reviewSubmitted: true,
      reviewId,
      updatedAt: new Date()
    };
    
    console.log('[test-review-creation] Updating test order with review data');
    try {
      await db.collection('orders').doc(testOrderId).update(orderUpdateData);
      console.log('[test-review-creation] Test order updated successfully');
    } catch (updateError) {
      console.error('[test-review-creation] Error updating test order:', updateError);
      
      // Try to clean up
      try {
        await db.collection('reviews').doc(reviewId).delete();
        await db.collection('orders').doc(testOrderId).delete();
      } catch (cleanupError) {
        console.error('[test-review-creation] Error cleaning up:', cleanupError);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to update test order',
        details: { error: updateError.message }
      });
    }
    
    // Update the seller's review stats
    console.log('[test-review-creation] Creating/updating seller review stats');
    try {
      // Check if stats document exists
      const statsDoc = await db.collection('reviewStats').doc(testSellerId).get();
      
      if (statsDoc.exists) {
        // Update existing stats
        const stats = statsDoc.data();
        
        // Ensure totalReviews is a number
        const currentTotal = typeof stats.totalReviews === 'number' ? stats.totalReviews : 0;
        const currentAvg = typeof stats.averageRating === 'number' ? stats.averageRating : 0;
        
        const totalReviews = currentTotal + 1;
        const totalRatingPoints = currentAvg * currentTotal + 5; // 5 is the rating
        const newAverage = parseFloat((totalRatingPoints / totalReviews).toFixed(2));
        
        // Initialize ratingCounts with default values if missing or invalid
        let ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        // If stats.ratingCounts exists and is an object, merge it with our default
        if (stats.ratingCounts && typeof stats.ratingCounts === 'object') {
          ratingCounts = { ...ratingCounts, ...stats.ratingCounts };
        }
        
        // Increment the count for rating 5
        ratingCounts[5] = (typeof ratingCounts[5] === 'number' ? ratingCounts[5] : 0) + 1;
        
        const updateData = {
          totalReviews,
          averageRating: newAverage,
          ratingCounts,
          lastUpdated: new Date()
        };
        
        await db.collection('reviewStats').doc(testSellerId).update(updateData);
        console.log('[test-review-creation] Updated existing review stats');
      } else {
        // Create new stats document
        const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratingCounts[5] = 1; // 5 is the rating
        
        const newStats = {
          sellerId: testSellerId,
          totalReviews: 1,
          averageRating: 5, // 5 is the rating
          ratingCounts,
          lastUpdated: new Date()
        };
        
        await db.collection('reviewStats').doc(testSellerId).set(newStats);
        console.log('[test-review-creation] Created new review stats');
      }
    } catch (statsError) {
      console.error('[test-review-creation] Error updating review stats:', statsError);
      // Continue with the test even if stats update fails
    }
    
    // Clean up - delete the test documents
    console.log('[test-review-creation] Test completed, cleaning up test data');
    try {
      await db.collection('reviews').doc(reviewId).delete();
      await db.collection('orders').doc(testOrderId).delete();
      await db.collection('reviewStats').doc(testSellerId).delete();
      console.log('[test-review-creation] Cleanup successful');
    } catch (cleanupError) {
      console.error('[test-review-creation] Error during cleanup:', cleanupError);
      // Continue with the response even if cleanup fails
    }
    
    return res.status(200).json({
      success: true,
      message: 'Review creation test successful',
      details: {
        testOrderId,
        testUserId,
        testSellerId,
        reviewId
      }
    });
  } catch (error) {
    console.error('[test-review-creation] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error testing review creation process',
      details: {
        error: error.message,
        stack: error.stack
      }
    });
  }
}