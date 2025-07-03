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
  limit,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFirebaseServices } from '../lib/firebase';

// Utility function to safely convert Firestore timestamps to JavaScript Date objects
const convertTimestamps = (data) => {
  if (!data) return data;
  
  // Create a copy of the data to avoid modifying the original
  const result = { ...data };
  
  // Convert createdAt and updatedAt if they exist
  if (result.createdAt && typeof result.createdAt.toDate === 'function') {
    result.createdAt = result.createdAt.toDate();
  }
  
  if (result.updatedAt && typeof result.updatedAt.toDate === 'function') {
    result.updatedAt = result.updatedAt.toDate();
  }
  
  // Convert sellerResponse timestamps if they exist
  if (result.sellerResponse && result.sellerResponse.createdAt) {
    if (typeof result.sellerResponse.createdAt.toDate === 'function') {
      result.sellerResponse.createdAt = result.sellerResponse.createdAt.toDate();
    }
  }
  
  return result;
};

/**
 * Fetch reviews received by a seller
 * @param {string} sellerId - The seller's user ID
 * @param {number} limitCount - Optional limit on number of reviews to fetch
 * @returns {Promise<Array>} Array of review objects
 */
export const fetchReviewsForSeller = async (sellerId, limitCount = 50) => {
  try {
    const { db } = getFirebaseServices();
    if (!db) {
      throw new Error('Firestore database is not initialized');
    }
    
    const reviewsRef = collection(db, 'reviews');
    
    const q = query(
      reviewsRef,
      where('sellerId', '==', sellerId),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const reviewsSnapshot = await getDocs(q);
    
    return reviewsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...convertTimestamps(data)
      };
    });
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
    const { db } = getFirebaseServices();
    if (!db) {
      throw new Error('Firestore database is not initialized');
    }
    
    const reviewsRef = collection(db, 'reviews');
    
    const q = query(
      reviewsRef,
      where('reviewerId', '==', buyerId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const reviewsSnapshot = await getDocs(q);
    
    return reviewsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...convertTimestamps(data)
      };
    });
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
    const { db } = getFirebaseServices();
    if (!db) {
      throw new Error('Firestore database is not initialized');
    }
    
    const statsRef = doc(db, 'reviewStats', sellerId);
    const statsDoc = await getDoc(statsRef);
    
    if (statsDoc.exists()) {
      const data = statsDoc.data();
      return convertTimestamps(data);
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
    const { db } = getFirebaseServices();
    if (!db) {
      throw new Error('Firestore database is not initialized');
    }
    
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
    console.log('submitReview service: Submitting review via API endpoint', reviewData);
    
    // Get the current user from Firebase Auth
    const { auth } = getFirebaseServices();
    if (!auth || !auth.currentUser) {
      throw new Error('User must be logged in to submit a review');
    }
    
    const userId = auth.currentUser.uid;
    
    // Prepare the data for the API endpoint
    const apiData = {
      orderId: reviewData.orderId,
      rating: reviewData.rating,
      comment: reviewData.comment || '',
      title: reviewData.title || '',
      images: reviewData.images || [],
      userId: userId
    };
    
    console.log('submitReview service: Calling API with data:', apiData);
    
    // Call the API endpoint
    const response = await fetch('/api/reviews/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiData),
    });
    
    const result = await response.json();
    console.log('submitReview service: API response:', result);
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to submit review');
    }
    
    if (!result.success) {
      throw new Error(result.message || 'Review submission failed');
    }
    
    return result.reviewId;
  } catch (error) {
    console.error('Error submitting review:', error);
    throw error;
  }
};

/**
 * Toggle a review's helpful status
 * @param {string} reviewId - The review ID
 * @returns {Promise<Object>} - Object containing the updated helpful count and marked status
 */
export const toggleReviewHelpful = async (reviewId) => {
  try {
    const { db } = getFirebaseServices();
    if (!db) {
      throw new Error('Firestore database is not initialized');
    }
    
    // Get the current user
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('User must be logged in to mark a review as helpful');
    }
    
    const userId = currentUser.uid;
    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) {
      throw new Error('Review not found');
    }
    
    const review = reviewDoc.data();
    
    // Don't allow marking your own review as helpful
    if (userId === review.reviewerId || userId === review.sellerId) {
      throw new Error('You cannot mark your own review as helpful');
    }
    
    // Check if user has already marked this review as helpful
    const helpfulRef = doc(db, 'reviews', reviewId, 'helpfulUsers', userId);
    const helpfulDoc = await getDoc(helpfulRef);
    const hasMarked = helpfulDoc.exists();
    
    let currentCount = review.helpfulCount || 0;
    let newCount = currentCount;
    let isMarked = hasMarked;
    
    if (!hasMarked) {
      // Mark as helpful
      newCount = currentCount + 1;
      isMarked = true;
      
      // Record that this user has marked the review as helpful
      await setDoc(helpfulRef, {
        userId,
        timestamp: serverTimestamp()
      });
    } else {
      // Unmark as helpful
      newCount = Math.max(0, currentCount - 1);
      isMarked = false;
      
      // Remove the record that this user has marked the review as helpful
      await deleteDoc(helpfulRef);
    }
    
    // Update the review's helpful count
    await updateDoc(reviewRef, {
      helpfulCount: newCount,
      updatedAt: serverTimestamp()
    });
    
    // Also update in seller's subcollection if it exists
    try {
      const sellerReviewRef = doc(db, 'users', review.sellerId, 'reviews', reviewId);
      const sellerReviewDoc = await getDoc(sellerReviewRef);
      
      if (sellerReviewDoc.exists()) {
        await updateDoc(sellerReviewRef, {
          helpfulCount: newCount,
          updatedAt: serverTimestamp()
        });
      }
    } catch (subcollectionError) {
      // Log but don't fail if the subcollection update fails
      console.error('Error updating seller subcollection:', subcollectionError);
    }
    
    return { helpfulCount: newCount, isMarked };
  } catch (error) {
    console.error('Error toggling review helpful status:', error);
    throw error;
  }
};

/**
 * Mark a review as helpful (legacy function, now uses toggle)
 * @param {string} reviewId - The review ID
 * @returns {Promise<number>} - The updated helpful count
 */
export const markReviewAsHelpful = async (reviewId) => {
  try {
    const result = await toggleReviewHelpful(reviewId);
    return result.helpfulCount;
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
    console.log('Adding seller response to review:', reviewId);
    
    const { db } = getFirebaseServices();
    if (!db) {
      throw new Error('Firestore database is not initialized');
    }
    
    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) {
      console.error('Review not found:', reviewId);
      throw new Error('Review not found');
    }
    
    const sellerResponse = {
      comment: responseText,
      createdAt: serverTimestamp()
    };
    
    console.log('Updating review with seller response:', sellerResponse);
    
    // Update in main reviews collection
    await updateDoc(reviewRef, {
      sellerResponse,
      updatedAt: serverTimestamp()
    });
    
    // Also update in seller's subcollection if it exists
    try {
      const review = reviewDoc.data();
      if (review && review.sellerId) {
        const sellerReviewRef = doc(db, 'users', review.sellerId, 'reviews', reviewId);
        const sellerReviewDoc = await getDoc(sellerReviewRef);
        
        if (sellerReviewDoc.exists()) {
          await updateDoc(sellerReviewRef, {
            sellerResponse,
            updatedAt: serverTimestamp()
          });
          console.log('Updated seller subcollection review');
        } else {
          console.log('Seller subcollection review does not exist, skipping update');
        }
      }
    } catch (subcollectionError) {
      // Log but don't fail if the subcollection update fails
      console.error('Error updating seller subcollection:', subcollectionError);
    }
    
    console.log('Seller response added successfully');
    return true;
  } catch (error) {
    console.error('Error adding seller response:', error);
    throw error;
  }
};