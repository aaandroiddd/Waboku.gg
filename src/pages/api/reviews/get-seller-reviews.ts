import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { Review, ReviewStats } from '@/types/review';

type ResponseData = {
  success: boolean;
  message: string;
  reviews?: Review[];
  stats?: ReviewStats;
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
    const { sellerId, page = '1', limit: limitParam = '10', rating, sortBy = 'newest' } = req.query;

    if (!sellerId) {
      console.log('[get-seller-reviews] Missing sellerId');
      return res.status(400).json({ success: false, message: 'Seller ID is required' });
    }

    console.log('[get-seller-reviews] Processing request:', { sellerId, page, limit: limitParam, rating, sortBy });
    
    // Initialize Firebase Admin SDK
    const { db } = initializeFirebaseAdmin();
    
    // Get the seller's review stats
    let stats: ReviewStats;
    try {
      const statsRef = db.collection('reviewStats').doc(sellerId as string);
      const statsDoc = await statsRef.get();
      
      if (statsDoc.exists) {
        const statsData = statsDoc.data();
        console.log('[get-seller-reviews] Found stats for seller:', sellerId, statsData);
        
        // Ensure the stats object has all required fields
        stats = {
          sellerId: sellerId as string,
          totalReviews: statsData?.totalReviews || 0,
          averageRating: statsData?.averageRating || 0,
          ratingCounts: {
            1: (statsData?.ratingCounts && statsData.ratingCounts[1]) || 0,
            2: (statsData?.ratingCounts && statsData.ratingCounts[2]) || 0,
            3: (statsData?.ratingCounts && statsData.ratingCounts[3]) || 0,
            4: (statsData?.ratingCounts && statsData.ratingCounts[4]) || 0,
            5: (statsData?.ratingCounts && statsData.ratingCounts[5]) || 0
          },
          lastUpdated: statsData?.lastUpdated?.toDate?.() || new Date()
        };
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
    } catch (statsError) {
      console.error('[get-seller-reviews] Error fetching stats:', statsError);
      // Create default stats object if there's an error
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
    
    // Build the query with constraints
    console.log('[get-seller-reviews] Building query for sellerId:', sellerId, 'in collection: reviews');
    
    // First, check if any reviews exist for this seller in any collection
    const checkCollections = ['reviews', '/reviews', 'users/' + sellerId + '/reviews'];
    let reviewsFound = false;
    let correctCollection = 'reviews';
    
    for (const collection of checkCollections) {
      try {
        console.log('[get-seller-reviews] Checking collection:', collection);
        let checkQuery;
        
        if (collection.includes('/')) {
          // This is a subcollection path
          checkQuery = db.collection(collection);
        } else {
          // This is a top-level collection
          checkQuery = db.collection(collection).where('sellerId', '==', sellerId);
        }
        
        const checkSnapshot = await checkQuery.limit(1).get();
        console.log('[get-seller-reviews] Collection', collection, 'has', checkSnapshot.size, 'documents');
        
        if (checkSnapshot.size > 0) {
          reviewsFound = true;
          correctCollection = collection;
          console.log('[get-seller-reviews] Found reviews in collection:', collection);
          console.log('[get-seller-reviews] Sample document:', JSON.stringify(checkSnapshot.docs[0].data()));
          break;
        }
      } catch (error) {
        console.error('[get-seller-reviews] Error checking collection:', collection, error);
      }
    }
    
    if (!reviewsFound) {
      console.log('[get-seller-reviews] No reviews found in any checked collection for seller:', sellerId);
    } else {
      console.log('[get-seller-reviews] Using collection:', correctCollection, 'for seller:', sellerId);
    }
    
    // Use the correct collection path
    let reviewsQuery;
    
    if (correctCollection.includes('/')) {
      // This is a subcollection path
      reviewsQuery = db.collection(correctCollection);
    } else {
      // This is a top-level collection
      reviewsQuery = db.collection(correctCollection).where('sellerId', '==', sellerId);
    }
    
    // Only add these filters if we're not in a testing environment
    if (process.env.NODE_ENV !== 'development' && !process.env.NEXT_PUBLIC_CO_DEV_ENV) {
      reviewsQuery = reviewsQuery
        .where('isPublic', '==', true)
        .where('status', '==', 'published');
    }
    
    console.log('[get-seller-reviews] Query built for sellerId:', sellerId, 'using collection:', correctCollection);
    
    // Add rating filter if provided
    if (rating) {
      try {
        const ratingValue = parseInt(rating as string);
        if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
          reviewsQuery = reviewsQuery.where('rating', '==', ratingValue);
        }
      } catch (ratingError) {
        console.error('[get-seller-reviews] Invalid rating parameter:', rating, ratingError);
      }
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
      console.log('[get-seller-reviews] Total reviews count:', totalCount);
      
      // Log the first few documents for debugging
      if (totalCount > 0) {
        console.log('[get-seller-reviews] First review document sample:');
        const sampleDoc = countSnapshot.docs[0].data();
        console.log(JSON.stringify({
          id: countSnapshot.docs[0].id,
          sellerId: sampleDoc.sellerId,
          reviewerId: sampleDoc.reviewerId,
          rating: sampleDoc.rating,
          isPublic: sampleDoc.isPublic,
          status: sampleDoc.status
        }));
      } else {
        console.log('[get-seller-reviews] No reviews found for seller:', sellerId);
        
        // Check if there are any reviews at all for this seller without filters
        const allReviewsQuery = db.collection('reviews').where('sellerId', '==', sellerId);
        const allReviewsSnapshot = await allReviewsQuery.get();
        console.log('[get-seller-reviews] Total unfiltered reviews for seller:', allReviewsSnapshot.size);
        
        if (allReviewsSnapshot.size > 0) {
          console.log('[get-seller-reviews] Sample unfiltered review:');
          const sampleDoc = allReviewsSnapshot.docs[0].data();
          console.log(JSON.stringify({
            id: allReviewsSnapshot.docs[0].id,
            sellerId: sampleDoc.sellerId,
            reviewerId: sampleDoc.reviewerId,
            rating: sampleDoc.rating,
            isPublic: sampleDoc.isPublic,
            status: sampleDoc.status
          }));
        }
      }
    } catch (countError) {
      console.error('[get-seller-reviews] Error getting total count:', countError);
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
      console.error('[get-seller-reviews] Error parsing pagination params:', parseError);
      // Use defaults
    }
    
    console.log('[get-seller-reviews] Using pagination:', { pageSize, pageNumber });
    
    // If not first page, we need to use startAfter
    if (pageNumber > 1 && totalCount > 0) {
      try {
        // Get all documents up to the start of our page
        const previousPageQuery = reviewsQuery.limit((pageNumber - 1) * pageSize);
        const previousPageSnapshot = await previousPageQuery.get();
        
        if (previousPageSnapshot.empty) {
          console.log('[get-seller-reviews] No documents found for previous pages');
          return res.status(200).json({
            success: true,
            message: 'No more reviews available',
            reviews: [],
            stats,
            total: totalCount
          });
        }
        
        const lastVisible = previousPageSnapshot.docs[previousPageSnapshot.docs.length - 1];
        
        if (lastVisible) {
          reviewsQuery = reviewsQuery.startAfter(lastVisible);
        }
      } catch (paginationError) {
        console.error('[get-seller-reviews] Pagination error:', paginationError);
        // If pagination fails, return empty results rather than error
        return res.status(200).json({
          success: true,
          message: 'No more reviews available',
          reviews: [],
          stats,
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
      console.log('[get-seller-reviews] Query returned documents:', reviewsSnapshot.size);
      
      // Convert the results to an array of reviews
      reviews = reviewsSnapshot.docs.map(doc => {
        const data = doc.data();
        const reviewId = doc.id;
        
        try {
          // Convert Firestore timestamps to JavaScript dates safely
          let createdAt = new Date();
          let updatedAt = new Date();
          
          try {
            if (data.createdAt) {
              if (typeof data.createdAt.toDate === 'function') {
                createdAt = data.createdAt.toDate();
              } else if (data.createdAt._seconds) {
                // Handle Firestore timestamp in serialized form
                createdAt = new Date(data.createdAt._seconds * 1000);
              } else if (typeof data.createdAt === 'string') {
                // Handle ISO string date
                createdAt = new Date(data.createdAt);
              }
            }
          } catch (dateError) {
            console.error('[get-seller-reviews] Error converting createdAt:', dateError);
          }
          
          try {
            if (data.updatedAt) {
              if (typeof data.updatedAt.toDate === 'function') {
                updatedAt = data.updatedAt.toDate();
              } else if (data.updatedAt._seconds) {
                // Handle Firestore timestamp in serialized form
                updatedAt = new Date(data.updatedAt._seconds * 1000);
              } else if (typeof data.updatedAt === 'string') {
                // Handle ISO string date
                updatedAt = new Date(data.updatedAt);
              }
            }
          } catch (dateError) {
            console.error('[get-seller-reviews] Error converting updatedAt:', dateError);
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
              if (data.sellerResponse.createdAt) {
                if (typeof data.sellerResponse.createdAt.toDate === 'function') {
                  responseCreatedAt = data.sellerResponse.createdAt.toDate();
                } else if (data.sellerResponse.createdAt._seconds) {
                  // Handle Firestore timestamp in serialized form
                  responseCreatedAt = new Date(data.sellerResponse.createdAt._seconds * 1000);
                } else if (typeof data.sellerResponse.createdAt === 'string') {
                  // Handle ISO string date
                  responseCreatedAt = new Date(data.sellerResponse.createdAt);
                }
              }
            } catch (responseError) {
              console.error('[get-seller-reviews] Error converting response date:', responseError);
            }
            
            review.sellerResponse = {
              comment: data.sellerResponse.comment || '',
              createdAt: responseCreatedAt
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
      console.error('[get-seller-reviews] Error executing query:', queryError);
      // Return empty array instead of failing
      reviews = [];
    }
    
    console.log('[get-seller-reviews] Successfully processed reviews:', reviews.length, 'of total:', totalCount);
    
    // Include debug information in development environment
    const responseData: ResponseData = { 
      success: true, 
      message: 'Reviews retrieved successfully',
      reviews,
      stats,
      total: totalCount
    };
    
    // Add debug info in development or when CO_DEV_ENV is set
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_CO_DEV_ENV) {
      // Log the first review in detail for debugging
      if (reviews.length > 0) {
        console.log('[get-seller-reviews] First review details:', JSON.stringify({
          id: reviews[0].id,
          sellerId: reviews[0].sellerId,
          reviewerId: reviews[0].reviewerId,
          rating: reviews[0].rating,
          comment: reviews[0].comment?.substring(0, 50) + (reviews[0].comment?.length > 50 ? '...' : ''),
          createdAt: reviews[0].createdAt,
          hasSellerResponse: !!reviews[0].sellerResponse
        }));
      }
      
      responseData.debug = {
        checkedCollections: checkCollections,
        usedCollection: correctCollection,
        reviewsFound,
        reviewsCount: reviews.length,
        filters: {
          sellerId,
          rating,
          sortBy,
          isPublicFilter: process.env.NODE_ENV !== 'development' && !process.env.NEXT_PUBLIC_CO_DEV_ENV
        },
        reviewSample: reviews.length > 0 ? {
          id: reviews[0].id,
          sellerId: reviews[0].sellerId,
          reviewerId: reviews[0].reviewerId,
          rating: reviews[0].rating,
          hasComment: !!reviews[0].comment,
          hasSellerResponse: !!reviews[0].sellerResponse
        } : null
      };
    }
    
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('[get-seller-reviews] Unhandled error:', error);
    
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