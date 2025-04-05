import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc } from 'firebase/firestore';
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
    
    // Apply pagination manually (Firestore doesn't have a built-in offset)
    const paginatedReviews = allReviews.slice(startAt, startAt + pageSize);
    
    console.log('[get-seller-reviews] Found reviews:', paginatedReviews.length);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Reviews retrieved successfully',
      reviews: paginatedReviews,
      stats: stats as ReviewStats,
      total: allReviews.length
    });
  } catch (error) {
    console.error('[get-seller-reviews] Error retrieving reviews:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}