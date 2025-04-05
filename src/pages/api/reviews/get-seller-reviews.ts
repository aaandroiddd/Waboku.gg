import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, orderBy, limit as firestoreLimit, getDocs, getDoc, doc, startAfter } from 'firebase/firestore';
import { Review, ReviewStats } from '@/types/review';

type ResponseData = {
  success: boolean;
  message: string;
  reviews?: Review[];
  stats?: ReviewStats;
  total?: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { sellerId, page = '1', limit: limitParam = '10', rating, sortBy = 'newest' } = req.query;

    if (!sellerId) {
      console.log('[get-seller-reviews] Missing sellerId');
      return res.status(400).json({ success: false, message: 'Seller ID is required' });
    }

    console.log('[get-seller-reviews] Processing request:', { sellerId, page, limit: limitParam });
    const { db } = getFirebaseServices();
    
    // Get the seller's review stats
    const statsRef = doc(db, 'reviewStats', sellerId as string);
    const statsDoc = await getDoc(statsRef);
    let stats = null;
    
    if (statsDoc.exists()) {
      stats = statsDoc.data() as ReviewStats;
    } else {
      console.log('[get-seller-reviews] No stats found for seller:', sellerId);
      // Create default stats object if none exists
      stats = {
        sellerId: sellerId as string,
        totalReviews: 0,
        averageRating: 0,
        ratingCounts: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0
        },
        lastUpdated: new Date()
      };
    }
    
    // Build the query
    let reviewsQuery = query(
      collection(db, 'reviews'),
      where('sellerId', '==', sellerId),
      where('isPublic', '==', true),
      where('status', '==', 'published')
    );
    
    // Add rating filter if provided
    if (rating) {
      reviewsQuery = query(
        reviewsQuery,
        where('rating', '==', parseInt(rating as string))
      );
    }
    
    // Add sorting
    let sortField = 'createdAt';
    let sortDirection: 'asc' | 'desc' = 'desc';
    
    switch (sortBy) {
      case 'oldest':
        sortDirection = 'asc';
        break;
      case 'highest_rating':
        sortField = 'rating';
        sortDirection = 'desc';
        break;
      case 'lowest_rating':
        sortField = 'rating';
        sortDirection = 'asc';
        break;
      case 'most_helpful':
        sortField = 'helpfulCount';
        sortDirection = 'desc';
        break;
      case 'newest':
      default:
        // Default is already set
        break;
    }
    
    reviewsQuery = query(reviewsQuery, orderBy(sortField, sortDirection));
    
    // If not sorting by createdAt as primary field, add it as secondary sort
    if (sortField !== 'createdAt') {
      reviewsQuery = query(reviewsQuery, orderBy('createdAt', 'desc'));
    }
    
    // Get total count first
    const countSnapshot = await getDocs(reviewsQuery);
    const totalCount = countSnapshot.size;
    
    // Apply pagination
    const pageSize = parseInt(limitParam as string);
    const pageNumber = parseInt(page as string);
    
    // Add limit to query
    reviewsQuery = query(reviewsQuery, firestoreLimit(pageSize));
    
    // If not first page, we need to use startAfter
    if (pageNumber > 1) {
      try {
        // Get all documents up to the start of our page
        const previousPageQuery = query(
          collection(db, 'reviews'),
          where('sellerId', '==', sellerId),
          where('isPublic', '==', true),
          where('status', '==', 'published'),
          orderBy(sortField, sortDirection),
          firestoreLimit((pageNumber - 1) * pageSize)
        );
        
        const previousPageSnapshot = await getDocs(previousPageQuery);
        const lastVisible = previousPageSnapshot.docs[previousPageSnapshot.docs.length - 1];
        
        if (lastVisible) {
          reviewsQuery = query(reviewsQuery, startAfter(lastVisible));
        }
      } catch (paginationError) {
        console.error('[get-seller-reviews] Pagination error:', paginationError);
        // If pagination fails, return empty results rather than error
        return res.status(200).json({
          success: true,
          message: 'No more reviews available',
          reviews: [],
          stats: stats as ReviewStats,
          total: totalCount
        });
      }
    }
    
    // Execute the query
    const reviewsSnapshot = await getDocs(reviewsQuery);
    
    // Convert the results to an array of reviews
    const reviews = reviewsSnapshot.docs.map(doc => {
      const data = doc.data();
      const reviewId = doc.id;
      
      try {
        // Convert Firestore timestamps to JavaScript dates
        const createdAt = data.createdAt?.toDate?.() || new Date();
        const updatedAt = data.updatedAt?.toDate?.() || new Date();
        
        const review: Review = {
          id: reviewId,
          orderId: data.orderId || '',
          listingId: data.listingId || '',
          reviewerId: data.reviewerId || '',
          sellerId: data.sellerId || '',
          rating: data.rating || 0,
          comment: data.comment || '',
          title: data.title,
          images: data.images || [],
          isVerifiedPurchase: data.isVerifiedPurchase || false,
          isPublic: data.isPublic || true,
          status: data.status || 'published',
          helpfulCount: data.helpfulCount || 0,
          reportCount: data.reportCount || 0,
          createdAt,
          updatedAt
        };
        
        // Add seller response if it exists
        if (data.sellerResponse) {
          review.sellerResponse = {
            comment: data.sellerResponse.comment || '',
            createdAt: data.sellerResponse.createdAt?.toDate?.() || new Date()
          };
        }
        
        return review;
      } catch (docError) {
        console.error('[get-seller-reviews] Error processing review document:', docError, data);
        // Return a minimal valid review object if there's an error
        return {
          id: reviewId,
          orderId: data.orderId || '',
          listingId: data.listingId || '',
          reviewerId: data.reviewerId || '',
          sellerId: data.sellerId || '',
          rating: data.rating || 0,
          comment: data.comment || '',
          isVerifiedPurchase: false,
          isPublic: true,
          status: 'published',
          createdAt: new Date(),
          updatedAt: new Date()
        } as Review;
      }
    });
    
    console.log('[get-seller-reviews] Found reviews:', reviews.length, 'of total:', totalCount);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Reviews retrieved successfully',
      reviews,
      stats: stats as ReviewStats,
      total: totalCount
    });
  } catch (error) {
    console.error('[get-seller-reviews] Error retrieving reviews:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}