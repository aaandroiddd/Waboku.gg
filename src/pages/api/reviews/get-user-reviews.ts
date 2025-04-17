import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { Review } from '@/types/review';

type ResponseData = {
  success: boolean;
  message: string;
  reviews?: Review[];
  total?: number;
  debug?: any;
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
    const { userId, page = '1', limit: limitParam = '10', sortBy = 'newest', role = 'reviewer' } = req.query;

    if (!userId) {
      console.log('[get-user-reviews] Missing userId');
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    console.log('[get-user-reviews] Processing request:', { userId, page, limit: limitParam, sortBy, role });
    
    // Initialize Firebase Admin SDK
    const { db } = initializeFirebaseAdmin();
    
    // Build the query with constraints based on the user's role
    let reviewsQuery;
    
    if (role === 'seller') {
      // Get reviews where the user is the seller (reviews received)
      console.log('[get-user-reviews] Fetching reviews where user is the seller');
      reviewsQuery = db.collection('reviews')
        .where('sellerId', '==', userId)
        .where('isPublic', '==', true)
        .where('status', '==', 'published');
    } else {
      // Get reviews where the user is the reviewer (reviews written)
      console.log('[get-user-reviews] Fetching reviews where user is the reviewer');
      reviewsQuery = db.collection('reviews')
        .where('reviewerId', '==', userId)
        .where('isPublic', '==', true)
        .where('status', '==', 'published');
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
    
    // Apply sorting
    reviewsQuery = reviewsQuery.orderBy(sortField, sortDirection);
    
    // If not sorting by createdAt as primary field, add it as secondary sort
    if (sortField !== 'createdAt') {
      reviewsQuery = reviewsQuery.orderBy('createdAt', 'desc');
    }
    
    // Get total count first
    let totalCount = 0;
    try {
      const countSnapshot = await reviewsQuery.get();
      totalCount = countSnapshot.size;
      console.log('[get-user-reviews] Total reviews count:', totalCount);
    } catch (countError) {
      console.error('[get-user-reviews] Error getting total count:', countError);
      // Continue with totalCount = 0
    }
    
    // Apply pagination
    let pageSize = 10;
    let pageNumber = 1;
    
    try {
      pageSize = parseInt(limitParam as string);
      if (isNaN(pageSize) || pageSize < 1) pageSize = 10;
      
      pageNumber = parseInt(page as string);
      if (isNaN(pageNumber) || pageNumber < 1) pageNumber = 1;
    } catch (parseError) {
      console.error('[get-user-reviews] Error parsing pagination params:', parseError);
      // Use defaults
    }
    
    console.log('[get-user-reviews] Using pagination:', { pageSize, pageNumber });
    
    // If not first page, we need to use startAfter
    if (pageNumber > 1 && totalCount > 0) {
      try {
        // Get all documents up to the start of our page
        const previousPageQuery = reviewsQuery.limit((pageNumber - 1) * pageSize);
        const previousPageSnapshot = await previousPageQuery.get();
        
        if (previousPageSnapshot.empty) {
          console.log('[get-user-reviews] No documents found for previous pages');
          return res.status(200).json({
            success: true,
            message: 'No more reviews available',
            reviews: [],
            total: totalCount
          });
        }
        
        const lastVisible = previousPageSnapshot.docs[previousPageSnapshot.docs.length - 1];
        
        if (lastVisible) {
          reviewsQuery = reviewsQuery.startAfter(lastVisible);
        }
      } catch (paginationError) {
        console.error('[get-user-reviews] Pagination error:', paginationError);
        // If pagination fails, return empty results rather than error
        return res.status(200).json({
          success: true,
          message: 'No more reviews available',
          reviews: [],
          total: totalCount
        });
      }
    }
    
    // Add limit to query
    reviewsQuery = reviewsQuery.limit(pageSize);
    
    // Execute the query
    let reviews: Review[] = [];
    try {
      const reviewsSnapshot = await reviewsQuery.get();
      console.log('[get-user-reviews] Query returned documents:', reviewsSnapshot.size);
      
      // Convert the results to an array of reviews
      reviews = reviewsSnapshot.docs.map(doc => {
        const data = doc.data();
        const reviewId = doc.id;
        
        try {
          // Convert Firestore timestamps to JavaScript dates safely
          let createdAt = new Date();
          let updatedAt = new Date();
          
          try {
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
              createdAt = data.createdAt.toDate();
            }
          } catch (dateError) {
            console.error('[get-user-reviews] Error converting createdAt:', dateError);
          }
          
          try {
            if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
              updatedAt = data.updatedAt.toDate();
            }
          } catch (dateError) {
            console.error('[get-user-reviews] Error converting updatedAt:', dateError);
          }
          
          // Create the review object with safe defaults
          const review: Review = {
            id: reviewId,
            orderId: data.orderId || '',
            listingId: data.listingId || '',
            reviewerId: data.reviewerId || '',
            sellerId: data.sellerId || '',
            rating: typeof data.rating === 'number' ? data.rating : 0,
            comment: data.comment || '',
            title: data.title || undefined,
            images: Array.isArray(data.images) ? data.images : [],
            isVerifiedPurchase: !!data.isVerifiedPurchase,
            isPublic: data.isPublic !== false, // default to true
            status: data.status || 'published',
            helpfulCount: typeof data.helpfulCount === 'number' ? data.helpfulCount : 0,
            reportCount: typeof data.reportCount === 'number' ? data.reportCount : 0,
            createdAt,
            updatedAt
          };
          
          // Add seller response if it exists
          if (data.sellerResponse && typeof data.sellerResponse === 'object') {
            let responseCreatedAt = new Date();
            
            try {
              if (data.sellerResponse.createdAt && typeof data.sellerResponse.createdAt.toDate === 'function') {
                responseCreatedAt = data.sellerResponse.createdAt.toDate();
              }
            } catch (responseError) {
              console.error('[get-user-reviews] Error converting response date:', responseError);
            }
            
            review.sellerResponse = {
              comment: data.sellerResponse.comment || '',
              createdAt: responseCreatedAt
            };
          }
          
          return review;
        } catch (docError) {
          console.error('[get-user-reviews] Error processing review document:', docError, data);
          // Return a minimal valid review object if there's an error
          return {
            id: reviewId,
            orderId: data.orderId || '',
            listingId: data.listingId || '',
            reviewerId: data.reviewerId || '',
            sellerId: data.sellerId || '',
            rating: 0,
            comment: '',
            isVerifiedPurchase: false,
            isPublic: true,
            status: 'published',
            createdAt: new Date(),
            updatedAt: new Date()
          } as Review;
        }
      });
    } catch (queryError) {
      console.error('[get-user-reviews] Error executing query:', queryError);
      // Return empty array instead of failing
      reviews = [];
    }
    
    console.log('[get-user-reviews] Successfully processed reviews:', reviews.length, 'of total:', totalCount);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Reviews retrieved successfully',
      reviews,
      total: totalCount
    });
  } catch (error) {
    console.error('[get-user-reviews] Unhandled error:', error);
    
    // Create a safe error object for debugging
    let errorInfo: any = { message: 'Unknown error' };
    
    if (error instanceof Error) {
      errorInfo = {
        message: error.message,
        name: error.name,
        stack: error.stack
      };
    } else if (typeof error === 'string') {
      errorInfo = { message: error };
    } else if (error && typeof error === 'object') {
      try {
        errorInfo = JSON.parse(JSON.stringify(error));
      } catch (e) {
        errorInfo = { message: 'Unserializable error object' };
      }
    }
    
    // In development, include error details
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_CO_DEV_ENV) {
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error',
        debug: errorInfo
      });
    }
    
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}