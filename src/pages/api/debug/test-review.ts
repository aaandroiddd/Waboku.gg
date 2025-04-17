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
    console.log('[test-review] Testing review creation process');
    
    // Initialize Firebase Admin
    const { db } = initializeFirebaseAdmin();
    
    // Create test IDs
    const testOrderId = `test-order-${Date.now()}`;
    const testUserId = `test-user-${Date.now()}`;
    const testSellerId = `test-seller-${Date.now()}`;
    const testListingId = `test-listing-${Date.now()}`;
    
    // Create a test order document
    const orderData = {
      id: testOrderId,
      buyerId: testUserId,
      sellerId: testSellerId,
      listingId: testListingId,
      status: 'completed',
      reviewSubmitted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('[test-review] Creating test order:', testOrderId);
    await db.collection('orders').doc(testOrderId).set(orderData);
    
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
    
    console.log('[test-review] Creating test review:', reviewId);
    await db.collection('reviews').doc(reviewId).set(reviewData);
    
    // Update the order to mark that a review has been submitted
    const orderUpdateData = {
      reviewSubmitted: true,
      reviewId,
      updatedAt: new Date()
    };
    
    console.log('[test-review] Updating test order with review data');
    await db.collection('orders').doc(testOrderId).update(orderUpdateData);
    
    // Update the seller's review stats
    console.log('[test-review] Updating seller review stats');
    
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
    }
    
    // Clean up - delete the test documents
    console.log('[test-review] Test completed, cleaning up test data');
    await db.collection('orders').doc(testOrderId).delete();
    await db.collection('reviews').doc(reviewId).delete();
    await db.collection('reviewStats').doc(testSellerId).delete();
    
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
  } catch (error: any) {
    console.error('[test-review] Error:', error);
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