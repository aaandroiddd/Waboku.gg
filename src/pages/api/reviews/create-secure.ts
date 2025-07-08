import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-utils';
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
    console.log('[create-review-secure] Request received');
    
    // SECURITY FIX: Verify authentication token
    const authResult = await verifyAuthToken(req);
    if (!authResult.success) {
      console.log('[create-review-secure] Authentication failed:', authResult.error);
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    
    const authenticatedUserId = authResult.uid!;
    console.log('[create-review-secure] Authenticated user:', authenticatedUserId);
    
    // Extract required fields
    const { 
      orderId, 
      rating, 
      comment, 
      title, 
      images = []
    } = req.body;

    console.log('[create-review-secure] Extracted fields:', { 
      orderId, 
      rating, 
      commentLength: comment ? comment.length : 0, 
      title, 
      imagesCount: images.length
    });

    // SECURITY FIX: Validate required fields
    if (!orderId || !rating) {
      console.log('[create-review-secure] Missing required fields');
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // SECURITY FIX: Validate rating range
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      console.log('[create-review-secure] Invalid rating value:', rating);
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    // SECURITY FIX: Validate comment length
    if (comment && comment.length > 1000) {
      return res.status(400).json({ success: false, message: 'Comment too long (max 1000 characters)' });
    }

    // SECURITY FIX: Validate images array
    if (!Array.isArray(images) || images.length > 5) {
      return res.status(400).json({ success: false, message: 'Invalid images data (max 5 images)' });
    }
    
    // Initialize Firebase Admin SDK
    const { db: adminDb } = getFirebaseAdmin();
    
    // SECURITY FIX: Get and verify order ownership
    console.log('[create-review-secure] Verifying order ownership:', orderId);
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      console.log('[create-review-secure] Order not found:', orderId);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const orderData = orderDoc.data()!;
    console.log('[create-review-secure] Order data retrieved:', { 
      buyerId: orderData.buyerId, 
      sellerId: orderData.sellerId,
      status: orderData.status,
      reviewSubmitted: orderData.reviewSubmitted
    });

    // SECURITY FIX: Verify user is the buyer (not just trust client data)
    if (orderData.buyerId !== authenticatedUserId) {
      console.log('[create-review-secure] Unauthorized: User is not the buyer', { 
        buyerId: orderData.buyerId, 
        authenticatedUserId 
      });
      return res.status(403).json({ success: false, message: 'Unauthorized: Only the buyer can leave a review' });
    }
    
    // SECURITY FIX: Verify order is completed
    if (orderData.status !== 'completed') {
      console.log('[create-review-secure] Order not completed:', orderData.status);
      return res.status(400).json({ 
        success: false, 
        message: 'Reviews can only be left for completed orders' 
      });
    }
    
    // SECURITY FIX: Check if review already exists
    if (orderData.reviewSubmitted) {
      console.log('[create-review-secure] Review already submitted for order:', orderId);
      return res.status(400).json({ 
        success: false, 
        message: 'A review has already been submitted for this order' 
      });
    }

    // Get the reviewer's profile data
    console.log('[create-review-secure] Getting reviewer profile data:', authenticatedUserId);
    const reviewerDoc = await adminDb.collection('users').doc(authenticatedUserId).get();
    let reviewerUsername = 'Anonymous User';
    let reviewerAvatarUrl = null;
    
    if (reviewerDoc.exists) {
      const reviewerData = reviewerDoc.data()!;
      reviewerUsername = reviewerData.username || reviewerData.displayName || 'Anonymous User';
      reviewerAvatarUrl = reviewerData.avatarUrl || reviewerData.photoURL || null;
    }
    
    // Create review with verified data
    const reviewId = uuidv4();
    const now = new Date();
    
    const reviewData = {
      id: reviewId,
      orderId,
      listingId: orderData.listingId,
      reviewerId: authenticatedUserId, // Use verified user ID
      reviewerUsername,
      reviewerAvatarUrl,
      sellerId: orderData.sellerId,
      rating: Math.round(rating), // Ensure integer rating
      comment: comment || '',
      title: title || '',
      images: images.slice(0, 5), // Limit to 5 images
      isVerifiedPurchase: true,
      isPublic: true,
      status: 'published',
      helpfulCount: 0,
      reportCount: 0,
      createdAt: now,
      updatedAt: now
    };
    
    console.log('[create-review-secure] Creating review with verified data');
    
    // Save review using transaction for consistency
    await adminDb.runTransaction(async (transaction) => {
      // Create review document
      const reviewRef = adminDb.collection('reviews').doc(reviewId);
      transaction.set(reviewRef, reviewData);
      
      // Update order to mark review as submitted
      const orderRef = adminDb.collection('orders').doc(orderId);
      transaction.update(orderRef, {
        reviewSubmitted: true,
        reviewId,
        updatedAt: now
      });
      
      // Also save to seller's reviews subcollection
      const sellerReviewRef = adminDb.collection('users').doc(orderData.sellerId).collection('reviews').doc(reviewId);
      transaction.set(sellerReviewRef, reviewData);
    });
    
    // Update seller review stats
    await updateSellerReviewStats(adminDb, orderData.sellerId, Math.round(rating));
    
    console.log('[create-review-secure] Review created successfully:', reviewId);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Review submitted successfully',
      reviewId
    });
    
  } catch (error) {
    console.error('[create-review-secure] Error processing review:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Helper function to update seller's review statistics
async function updateSellerReviewStats(adminDb: any, sellerId: string, newRating: number) {
  try {
    console.log('[update-review-stats-secure] Updating stats for seller:', sellerId, 'with rating:', newRating);
    
    if (!sellerId || typeof newRating !== 'number' || newRating < 1 || newRating > 5) {
      console.error('[update-review-stats-secure] Invalid parameters');
      return;
    }
    
    const rating = Math.round(newRating);
    
    await adminDb.runTransaction(async (transaction: any) => {
      const statsRef = adminDb.collection('reviewStats').doc(sellerId);
      const statsDoc = await transaction.get(statsRef);
      
      if (statsDoc.exists) {
        const stats = statsDoc.data();
        const currentTotal = typeof stats.totalReviews === 'number' ? stats.totalReviews : 0;
        const currentAvg = typeof stats.averageRating === 'number' ? stats.averageRating : 0;
        
        const totalReviews = currentTotal + 1;
        const totalRatingPoints = currentAvg * currentTotal + rating;
        const newAverage = parseFloat((totalRatingPoints / totalReviews).toFixed(2));
        
        let ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        if (stats.ratingCounts && typeof stats.ratingCounts === 'object') {
          ratingCounts = { ...ratingCounts, ...stats.ratingCounts };
        }
        ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
        
        transaction.update(statsRef, {
          totalReviews,
          averageRating: newAverage,
          ratingCounts,
          lastUpdated: new Date()
        });
      } else {
        const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratingCounts[rating] = 1;
        
        transaction.set(statsRef, {
          sellerId,
          totalReviews: 1,
          averageRating: rating,
          ratingCounts,
          lastUpdated: new Date()
        });
      }
    });
    
    console.log('[update-review-stats-secure] Successfully updated review stats');
  } catch (error) {
    console.error('[update-review-stats-secure] Error updating review stats:', error);
  }
}