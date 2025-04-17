import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  updateDoc,
  serverTimestamp,
  limit 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Fetch reviews received by a seller
 * @param {string} sellerId - The seller's user ID
 * @param {number} limitCount - Optional limit on number of reviews to fetch
 * @returns {Promise<Array>} Array of review objects
 */
export const fetchReviewsForSeller = async (sellerId, limitCount = 50) => {
  try {
    const reviewsRef = collection(db, 'reviews');
    
    const q = query(
      reviewsRef,
      where('sellerId', '==', sellerId),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const reviewsSnapshot = await getDocs(q);
    
    return reviewsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching reviews for seller:', error);
    throw error;
  }
};

/**
 * Fetch reviews written by a buyer
 * @param {string} buyerId - The buyer/reviewer's user ID
 * @param {number} limitCount - Optional limit on number of reviews to fetch
 * @returns {Promise<Array>} Array of review objects
 */
export const fetchReviewsByBuyer = async (buyerId, limitCount = 50) => {
  try {
    const reviewsRef = collection(db, 'reviews');
    
    const q = query(
      reviewsRef,
      where('reviewerId', '==', buyerId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const reviewsSnapshot = await getDocs(q);
    
    return reviewsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching reviews by buyer:', error);
    throw error;
  }
};

/**
 * Get review statistics for a seller
 * @param {string} sellerId - The seller's user ID
 * @returns {Promise<Object>} Review statistics
 */
export const getSellerReviewStats = async (sellerId) => {
  try {
    const statsRef = doc(db, 'reviewStats', sellerId);
    const statsDoc = await getDoc(statsRef);
    
    if (statsDoc.exists()) {
      return statsDoc.data();
    } else {
      // Return default values if no stats exist yet
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingCounts: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        lastUpdated: null
      };
    }
  } catch (error) {
    console.error('Error getting seller review stats:', error);
    throw error;
  }
};

/**
 * Update the review statistics for a seller
 * @param {string} sellerId - The seller's user ID
 * @returns {Promise<Object>} Updated review statistics
 */
export const updateSellerReviewStats = async (sellerId) => {
  try {
    // Get all published reviews for this seller
    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('sellerId', '==', sellerId),
      where('status', '==', 'published')
    );
    
    const reviewsSnapshot = await getDocs(q);
    const reviews = reviewsSnapshot.docs.map(doc => doc.data());
    
    // Calculate statistics
    const totalReviews = reviews.length;
    
    // Initialize rating counts
    const ratingCounts = {
      '1': 0, '2': 0, '3': 0, '4': 0, '5': 0
    };
    
    // Calculate sum of ratings and count by rating value
    let ratingSum = 0;
    reviews.forEach(review => {
      const rating = review.rating.toString();
      ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
      ratingSum += review.rating;
    });
    
    // Calculate average rating (default to 0 if no reviews)
    const averageRating = totalReviews > 0 ? (ratingSum / totalReviews) : 0;
    
    // Update the reviewStats document
    const statsRef = doc(db, 'reviewStats', sellerId);
    const stats = {
      totalReviews,
      averageRating,
      ratingCounts,
      lastUpdated: serverTimestamp()
    };
    
    await setDoc(statsRef, stats, { merge: true });
    
    return stats;
  } catch (error) {
    console.error('Error updating seller review stats:', error);
    throw error;
  }
};

/**
 * Submit a new review
 * @param {Object} reviewData - The review data
 * @returns {Promise<string>} The ID of the created review
 */
export const submitReview = async (reviewData) => {
  try {
    // Create a new review document in the main reviews collection
    const reviewsRef = collection(db, 'reviews');
    const newReviewRef = doc(reviewsRef);
    const reviewId = newReviewRef.id;
    
    const reviewToSubmit = {
      ...reviewData,
      id: reviewId,
      status: 'published',
      isPublic: true,
      helpfulCount: 0,
      reportCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Add to main reviews collection
    await setDoc(newReviewRef, reviewToSubmit);
    
    // Add to seller's subcollection for faster access
    const sellerReviewRef = doc(db, 'users', reviewData.sellerId, 'reviews', reviewId);
    await setDoc(sellerReviewRef, reviewToSubmit);
    
    // Update the order to mark as reviewed
    const orderRef = doc(db, 'orders', reviewData.orderId);
    await updateDoc(orderRef, {
      hasReview: true,
      reviewId: reviewId,
      updatedAt: serverTimestamp()
    });
    
    // Update seller stats
    await updateSellerReviewStats(reviewData.sellerId);
    
    return reviewId;
  } catch (error) {
    console.error('Error submitting review:', error);
    throw error;
  }
};

/**
 * Mark a review as helpful
 * @param {string} reviewId - The review ID
 * @returns {Promise<void>}
 */
export const markReviewAsHelpful = async (reviewId) => {
  try {
    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) {
      throw new Error('Review not found');
    }
    
    const currentCount = reviewDoc.data().helpfulCount || 0;
    
    await updateDoc(reviewRef, {
      helpfulCount: currentCount + 1,
      updatedAt: serverTimestamp()
    });
    
    // Also update in seller's subcollection
    const review = reviewDoc.data();
    const sellerReviewRef = doc(db, 'users', review.sellerId, 'reviews', reviewId);
    
    await updateDoc(sellerReviewRef, {
      helpfulCount: currentCount + 1,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error marking review as helpful:', error);
    throw error;
  }
};

/**
 * Add a seller response to a review
 * @param {string} reviewId - The review ID
 * @param {string} responseText - The seller's response
 * @returns {Promise<void>}
 */
export const addSellerResponse = async (reviewId, responseText) => {
  try {
    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) {
      throw new Error('Review not found');
    }
    
    const sellerResponse = {
      content: responseText,
      createdAt: serverTimestamp()
    };
    
    await updateDoc(reviewRef, {
      sellerResponse,
      updatedAt: serverTimestamp()
    });
    
    // Also update in seller's subcollection
    const review = reviewDoc.data();
    const sellerReviewRef = doc(db, 'users', review.sellerId, 'reviews', reviewId);
    
    await updateDoc(sellerReviewRef, {
      sellerResponse,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error adding seller response:', error);
    throw error;
  }
};