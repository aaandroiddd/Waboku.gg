import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Review } from '@/types/review';

type ResponseData = {
  success: boolean;
  message: string;
  reviews?: Review[];
  total?: number;
  averageRating?: number;
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
    const { listingId, page = '1', limit: limitParam = '10', rating, sortBy = 'newest' } = req.query;

    if (!listingId) {
      console.log('[get-product-reviews] Missing listingId');
      return res.status(400).json({ success: false, message: 'Listing ID is required' });
    }

    console.log('[get-product-reviews] Processing request:', { listingId, page, limit: limitParam });
    const { db } = getFirebaseServices();
    
    // Build the query
    let reviewsQuery = query(
      collection(db, 'reviews'),
      where('listingId', '==', listingId),
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
    switch (sortBy) {
      case 'oldest':
        reviewsQuery = query(reviewsQuery, orderBy('createdAt', 'asc'));
        break;
      case 'highest_rating':
        reviewsQuery = query(reviewsQuery, orderBy('rating', 'desc'), orderBy('createdAt', 'desc'));
        break;
      case 'lowest_rating':
        reviewsQuery = query(reviewsQuery, orderBy('rating', 'asc'), orderBy('createdAt', 'desc'));
        break;
      case 'most_helpful':
        reviewsQuery = query(reviewsQuery, orderBy('helpfulCount', 'desc'), orderBy('createdAt', 'desc'));
        break;
      case 'newest':
      default:
        reviewsQuery = query(reviewsQuery, orderBy('createdAt', 'desc'));
        break;
    }
    
    // Add pagination
    const pageSize = parseInt(limitParam as string);
    const pageNumber = parseInt(page as string);
    const startAt = (pageNumber - 1) * pageSize;
    
    // Execute the query
    const reviewsSnapshot = await getDocs(reviewsQuery);
    
    // Convert the results to an array of reviews
    const allReviews = reviewsSnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convert Firestore timestamps to JavaScript dates
      const createdAt = data.createdAt?.toDate?.() || new Date();
      const updatedAt = data.updatedAt?.toDate?.() || new Date();
      
      return {
        ...data,
        createdAt,
        updatedAt,
        sellerResponse: data.sellerResponse ? {
          ...data.sellerResponse,
          createdAt: data.sellerResponse.createdAt?.toDate?.() || new Date()
        } : undefined
      } as Review;
    });
    
    // Calculate average rating
    const totalRating = allReviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = allReviews.length > 0 ? totalRating / allReviews.length : 0;
    
    // Apply pagination manually (Firestore doesn't have a built-in offset)
    const paginatedReviews = allReviews.slice(startAt, startAt + pageSize);
    
    console.log('[get-product-reviews] Found reviews:', paginatedReviews.length);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Reviews retrieved successfully',
      reviews: paginatedReviews,
      total: allReviews.length,
      averageRating
    });
  } catch (error) {
    console.error('[get-product-reviews] Error retrieving reviews:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}