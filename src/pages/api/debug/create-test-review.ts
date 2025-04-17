import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

type ResponseData = {
  success: boolean;
  message: string;
  reviewId?: string;
  debug?: any;
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
    console.log('[create-test-review] Request body:', JSON.stringify(req.body));
    
    // Extract required fields
    const { 
      sellerId,
      buyerId,
      listingId,
      orderId,
      rating = 5,
      comment = 'This is a test review created for debugging purposes.',
      title = 'Test Review'
    } = req.body;

    if (!sellerId || !buyerId) {
      return res.status(400).json({ success: false, message: 'Seller ID and Buyer ID are required' });
    }

    // Generate IDs if not provided
    const actualListingId = listingId || uuidv4();
    const actualOrderId = orderId || uuidv4();
    
    console.log('[create-test-review] Creating test review:', { 
      sellerId, 
      buyerId, 
      listingId: actualListingId,
      orderId: actualOrderId
    });
    
    // Initialize Firebase Admin SDK
    const { db } = initializeFirebaseAdmin();
    
    // Create a new review document
    const reviewId = uuidv4();
    const now = new Date();
    
    const reviewData = {
      id: reviewId,
      orderId: actualOrderId,
      listingId: actualListingId,
      reviewerId: buyerId,
      sellerId: sellerId,
      rating: parseInt(rating.toString()),
      comment: comment || '',
      title: title || '',
      images: [],
      isVerifiedPurchase: true,
      isPublic: true,
      status: 'published',
      helpfulCount: 0,
      reportCount: 0,
      createdAt: now,
      updatedAt: now
    };
    
    console.log('[create-test-review] Review data:', JSON.stringify(reviewData));
    
    // Save to both locations
    const results = {
      mainCollection: true,
      userSubcollection: true
    };
    
    try {
      // Save to main reviews collection
      await db.collection('reviews').doc(reviewId).set(reviewData);
      console.log('[create-test-review] Saved to main reviews collection');
    } catch (error) {
      console.error('[create-test-review] Error saving to main collection:', error);
      results.mainCollection = false;
    }
    
    try {
      // Save to user subcollection
      await db.collection('users').doc(sellerId).collection('reviews').doc(reviewId).set(reviewData);
      console.log('[create-test-review] Saved to user subcollection');
    } catch (error) {
      console.error('[create-test-review] Error saving to user subcollection:', error);
      results.userSubcollection = false;
    }
    
    // Create or update order if needed
    if (!orderId) {
      try {
        const orderData = {
          id: actualOrderId,
          buyerId: buyerId,
          sellerId: sellerId,
          listingId: actualListingId,
          status: 'completed',
          reviewSubmitted: true,
          reviewId: reviewId,
          createdAt: now,
          updatedAt: now
        };
        
        await db.collection('orders').doc(actualOrderId).set(orderData);
        console.log('[create-test-review] Created test order');
        results.orderCreated = true;
      } catch (error) {
        console.error('[create-test-review] Error creating test order:', error);
        results.orderCreated = false;
      }
    }
    
    // Update seller review stats
    try {
      await updateSellerReviewStats(db, sellerId, parseInt(rating.toString()));
      console.log('[create-test-review] Updated seller review stats');
      results.statsUpdated = true;
    } catch (error) {
      console.error('[create-test-review] Error updating seller stats:', error);
      results.statsUpdated = false;
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Test review created successfully',
      reviewId,
      debug: results
    });
  } catch (error) {
    console.error('[create-test-review] Unhandled error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Helper function to update seller's review statistics
async function updateSellerReviewStats(db, sellerId: string, newRating: number) {
  if (!sellerId) {
    throw new Error('Missing sellerId');
  }
  
  // Validate rating is a number between 1-5
  if (typeof newRating !== 'number' || newRating < 1 || newRating > 5) {
    throw new Error('Invalid rating value: ' + newRating);
  }
  
  // Ensure rating is an integer
  const rating = Math.round(newRating);
  
  const statsDoc = await db.collection('reviewStats').doc(sellerId).get();
  
  if (statsDoc.exists) {
    // Update existing stats
    const stats = statsDoc.data();
    
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
    
    await db.collection('reviewStats').doc(sellerId).update(updateData);
  } else {
    // Create new stats document
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingCounts[rating] = 1;
    
    const newStats = {
      sellerId,
      totalReviews: 1,
      averageRating: rating,
      ratingCounts,
      lastUpdated: new Date()
    };
    
    await db.collection('reviewStats').doc(sellerId).set(newStats);
  }
  
  return true;
}